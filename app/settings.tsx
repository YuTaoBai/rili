import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePreventRemove } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  makeBackup,
  MAX_BACKUP_BYTES,
  MAX_EVENTS,
  parseBackup,
  utf8Size,
} from "../src/events";
import { useStore } from "../src/store";
import { colors, ui } from "../src/theme";
function confirmImport(
  count: number,
  duplicateCount: number,
): Promise<"skip" | "replace" | null> {
  return new Promise((resolve) =>
    Alert.alert(
      "确认合并备份",
      `备份包含 ${count} 条安排，其中 ${duplicateCount} 条 ID 与本机重复。\n\n跳过重复：保留本机记录。\n覆盖重复：使用备份中的记录。\n\n不同 ID 的安排都会保留；导入不会清空日历。`,
      [
        { text: "取消", style: "cancel", onPress: () => resolve(null) },
        { text: "跳过重复", onPress: () => resolve("skip") },
        { text: "覆盖重复", onPress: () => resolve("replace") },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    ),
  );
}
export default function SettingsScreen() {
  const { repository, changed } = useStore();
  const [busy, setBusy] = useState("");
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  usePreventRemove(!!busy, () => {
    /* Keep the transaction and its status on screen. */
  });
  const run = async (label: string, task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(label);
    setMessage("");
    try {
      await task();
    } catch (error) {
      Alert.alert(
        "操作未完成",
        error instanceof Error ? error.message : "请稍后重试。",
      );
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  };
  const exportData = () =>
    run("正在准备备份…", async () => {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error(
          "当前设备无法分享文件，请在支持文件分享的 Android 手机上重试",
        );
      const events = await repository.all();
      if (events.length > MAX_EVENTS)
        throw new Error("单个备份最多支持 50000 条安排");
      const now = new Date();
      const content = makeBackup(events, now);
      if (utf8Size(content) > MAX_BACKUP_BYTES)
        throw new Error("当前备份超过 20 MB，暂时无法导出可恢复的备份");
      const file = new File(Paths.cache, `我的日历-${now.getTime()}.json`);
      file.create();
      file.write(content);
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "保存或分享日历备份",
        UTI: "public.json",
      });
      // The receiving app may still be reading the URI after the share sheet closes.
      // Leave this temporary copy in the OS-managed cache instead of deleting it early.
      setMessage(
        `已生成 ${events.length} 条安排的备份。请确认已在分享目标中保存文件；取消分享不会保存到外部。`,
      );
    });
  const importData = () =>
    run("正在读取备份…", async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/*", "application/octet-stream"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const file = new File(asset.uri);
      let events;
      try {
        if ((asset.size ?? file.size) > MAX_BACKUP_BYTES)
          throw new Error("备份文件超过 20 MB");
        events = parseBackup(await file.text());
      } finally {
        if (file.exists) file.delete();
      }
      if (!events.length) {
        setMessage("这个备份没有日程，本机数据保持不变。");
        return;
      }
      const existing = new Set(
        (await repository.all()).map((event) => event.id),
      );
      const duplicates = events.filter((event) =>
        existing.has(event.id),
      ).length;
      const mode = await confirmImport(events.length, duplicates);
      if (!mode) return;
      setBusy("正在合并安排，请稍候…");
      const stats = await repository.import(events, mode);
      changed();
      setMessage(
        `导入完成：新增 ${stats.added} 条，覆盖 ${stats.replaced} 条，跳过 ${stats.skipped} 条。`,
      );
    });
  return (
    <SafeAreaView style={ui.page}>
      <View style={ui.top}>
        <Pressable
          accessibilityRole="button"
          style={ui.softButton}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          disabled={!!busy}
        >
          <Text style={ui.link}>‹ 返回</Text>
        </Pressable>
        <Text style={ui.title}>设置与备份</Text>
        <View style={{ width: 70 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <Text style={s.heroSymbol}>▦</Text>
          <Text style={ui.heading}>生活的记录，自己保管</Text>
          <Text style={[ui.sub, { textAlign: "center" }]}>
            没有账号，也没有云端数据库。{"\n"}你的安排，只属于你。
          </Text>
        </View>
        <View style={[ui.card, s.card]}>
          <Text style={ui.title}>备份你的日历</Text>
          <Text style={ui.sub}>
            导出所有日程为 JSON
            文件，通过系统分享保存到文件管理器、发送给自己，或传到新手机。
          </Text>
          <Pressable
            accessibilityRole="button"
            style={ui.button}
            disabled={!!busy}
            onPress={() => void exportData()}
          >
            <Text style={ui.buttonText}>导出全部日程</Text>
          </Pressable>
          <View style={s.divider} />
          <Text style={ui.title}>从备份中恢复</Text>
          <Text style={ui.sub}>
            选择本应用导出的 JSON。先校验，再合并；相同 ID
            可跳过或覆盖，任何失败都会回滚本次导入。
          </Text>
          <Pressable
            accessibilityRole="button"
            style={ui.softButton}
            disabled={!!busy}
            onPress={() => void importData()}
          >
            <Text style={ui.link}>选择备份文件</Text>
          </Pressable>
        </View>
        {!!busy && (
          <View accessibilityLiveRegion="polite" style={s.status}>
            <ActivityIndicator color={colors.primary} />
            <Text style={ui.sub}>{busy}</Text>
          </View>
        )}
        {!!message && (
          <View style={[ui.card, { backgroundColor: colors.pale }]}>
            <Text
              accessibilityLiveRegion="polite"
              style={[ui.sub, { color: colors.primary }]}
            >
              {message}
            </Text>
          </View>
        )}
        <View style={[ui.card, s.card]}>
          <Text style={ui.title}>关于本地数据</Text>
          <Text style={ui.sub}>
            关闭应用或重启手机不会清除安排。卸载应用、清除应用数据或丢失手机会导致本机记录丢失，请定期备份到应用之外。
          </Text>
          <Text style={ui.sub}>
            备份文件是明文，可能含有私人信息，请妥善保管。更新应用时请使用相同包名和签名，并直接覆盖安装。
          </Text>
          <Text style={s.version}>我的日历 · 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 20 },
  hero: { alignItems: "center", gap: 12, paddingVertical: 18 },
  heroSymbol: { fontSize: 44, color: colors.primary },
  card: { gap: 16 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 6 },
  status: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  version: { color: colors.muted, fontSize: 12 },
});
