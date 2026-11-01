import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import * as Crypto from "expo-crypto";
import { dateKey } from "../src/calendar";
import { validateInput } from "../src/events";
import { useStore } from "../src/store";
import { colors, ui } from "../src/theme";
export default function EventScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const id = typeof params.id === "string" ? params.id : undefined;
  const initialDate =
    typeof params.date === "string" ? params.date : dateKey(new Date());
  const { repository, changed } = useStore();
  const [date, setDate] = useState(initialDate);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [startTime, setStart] = useState("");
  const [endTime, setEnd] = useState("");
  const [isAllDay, setAllDay] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  usePreventRemove(busy || (dirty && !finished), ({ repeat }) => {
    if (busy) return;
    Alert.alert("放弃未保存的修改？", "离开后，本次修改不会保存。", [
      { text: "继续编辑", style: "cancel" },
      {
        text: "放弃修改",
        style: "destructive",
        onPress: () => {
          setDirty(false);
          repeat();
        },
      },
    ]);
  });
  useEffect(() => {
    if (finished && !busy) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }
  }, [finished, busy]);
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    void repository
      .get(id)
      .then((event) => {
        if (!active) return;
        if (!event) {
          setLoadError("这条日程已不存在，请返回日历。");
          return;
        }
        setDate(event.date);
        setTitle(event.title);
        setNote(event.note);
        setStart(event.startTime ?? "");
        setEnd(event.endTime ?? "");
        setAllDay(event.isAllDay);
      })
      .catch(() => {
        if (active) setLoadError("暂时无法读取这条日程，请重试。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, repository, attempt]);
  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setDirty(true);
    setError("");
  };
  const save = async () => {
    if (busyRef.current) return;
    try {
      const input = validateInput({
        date: date.trim(),
        title,
        note,
        startTime: isAllDay ? null : startTime.trim() || null,
        endTime: isAllDay ? null : endTime.trim() || null,
        isAllDay,
      });
      busyRef.current = true;
      setBusy(true);
      setError("");
      await repository.save(id ?? Crypto.randomUUID(), input, undefined, !!id);
      changed();
      setDirty(false);
      setFinished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const remove = () =>
    Alert.alert(
      "删除这条安排？",
      "删除后无法撤销。如果需要保留，请先导出备份。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            if (!id || busyRef.current) return;
            busyRef.current = true;
            setBusy(true);
            void repository
              .remove(id)
              .then(() => {
                changed();
                setDirty(false);
                setFinished(true);
              })
              .catch(() => setError("删除失败，请重试。"))
              .finally(() => {
                busyRef.current = false;
                setBusy(false);
              });
          },
        },
      ],
    );
  return (
    <SafeAreaView style={ui.page}>
      <View style={ui.top}>
        <Pressable
          accessibilityRole="button"
          style={ui.softButton}
          onPress={back}
          disabled={busy}
        >
          <Text style={ui.link}>‹ 返回</Text>
        </Pressable>
        <Text style={ui.title}>{id ? "编辑安排" : "新的安排"}</Text>
        <View style={{ width: 70 }} />
      </View>
      {loading ? (
        <View style={ui.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={ui.sub}>正在打开安排…</Text>
        </View>
      ) : loadError ? (
        <View style={ui.center}>
          <Text style={ui.error}>{loadError}</Text>
          <Pressable style={ui.button} onPress={() => retry((x) => x + 1)}>
            <Text style={ui.buttonText}>重试</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={s.intro}>
              <Text style={ui.heading}>
                {id ? "把计划再完善一点" : "留住一件重要的小事"}
              </Text>
              <Text style={ui.sub}>安排、灵感，或只是今天的一句话。</Text>
            </View>
            <View style={[ui.card, s.form]}>
              <View>
                <Text style={ui.label}>日期</Text>
                <TextInput
                  accessibilityLabel="日期，格式 YYYY-MM-DD"
                  style={ui.input}
                  value={date}
                  onChangeText={change(setDate)}
                  placeholder="2026-11-01"
                  placeholderTextColor={colors.muted}
                  maxLength={10}
                  autoCapitalize="none"
                  editable={!busy}
                />
              </View>
              <View>
                <Text style={ui.label}>
                  标题 <Text style={ui.sub}>必填</Text>
                </Text>
                <TextInput
                  accessibilityLabel="日程标题"
                  style={ui.input}
                  value={title}
                  onChangeText={change(setTitle)}
                  placeholder="这一天，想做些什么？"
                  placeholderTextColor={colors.muted}
                  maxLength={120}
                  editable={!busy}
                />
              </View>
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.label}>全天安排</Text>
                  <Text style={ui.sub}>不用具体到某一个时间</Text>
                </View>
                <Switch
                  accessibilityLabel="全天安排"
                  value={isAllDay}
                  onValueChange={(value) => {
                    setAllDay(value);
                    setDirty(true);
                    setError("");
                  }}
                  disabled={busy}
                  trackColor={{ false: "#DDE5F2", true: "#AFC7F4" }}
                  thumbColor={isAllDay ? colors.primary : "#FFFFFF"}
                />
              </View>
              {!isAllDay && (
                <View>
                  <View style={s.times}>
                    <View style={{ flex: 1 }}>
                      <Text style={ui.label}>开始时间</Text>
                      <TextInput
                        accessibilityLabel="开始时间，24 小时制"
                        style={ui.input}
                        value={startTime}
                        onChangeText={change(setStart)}
                        placeholder="09:00"
                        placeholderTextColor={colors.muted}
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        editable={!busy}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ui.label}>结束时间</Text>
                      <TextInput
                        accessibilityLabel="结束时间，24 小时制"
                        style={ui.input}
                        value={endTime}
                        onChangeText={change(setEnd)}
                        placeholder="10:00"
                        placeholderTextColor={colors.muted}
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        editable={!busy}
                      />
                    </View>
                  </View>
                  <Text style={[ui.sub, { marginTop: 8, fontSize: 12 }]}>
                    时间可留空作为纯备注；填写时使用 HH:mm。
                  </Text>
                </View>
              )}
              <View>
                <Text style={ui.label}>
                  详细备注 <Text style={ui.sub}>选填</Text>
                </Text>
                <TextInput
                  accessibilityLabel="详细备注"
                  style={[ui.input, s.note]}
                  value={note}
                  onChangeText={change(setNote)}
                  placeholder="写下细节，让心里轻松一点…"
                  placeholderTextColor={colors.muted}
                  multiline
                  textAlignVertical="top"
                  maxLength={20000}
                  editable={!busy}
                />
                <Text style={s.counter}>{note.length} / 20000</Text>
              </View>
            </View>
            {!!error && (
              <Text accessibilityRole="alert" style={ui.error}>
                {error}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              style={[ui.button, busy && { opacity: 0.5 }]}
              onPress={() => void save()}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={ui.buttonText}>保存安排</Text>
              )}
            </Pressable>
            {!!id && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={s.delete}
                onPress={remove}
              >
                <Text style={{ color: colors.danger, fontSize: 15 }}>
                  删除这条安排
                </Text>
              </Pressable>
            )}
            <Text style={[ui.sub, { textAlign: "center", fontSize: 12 }]}>
              仅保存在你的手机上，离线也能安心记录。
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 18 },
  intro: { gap: 10, marginBottom: 4 },
  form: { gap: 24 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  times: { flexDirection: "row", gap: 12 },
  note: { minHeight: 170, maxHeight: 360, lineHeight: 24 },
  counter: {
    textAlign: "right",
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
  },
  delete: { minHeight: 48, alignItems: "center", justifyContent: "center" },
});
