import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  dateKey,
  dateLabel,
  monthCells,
  monthKey,
  moveMonth,
} from "../src/calendar";
import { CalendarEvent, timeLabel } from "../src/events";
import { useStore } from "../src/store";
import { colors, ui } from "../src/theme";
export default function CalendarScreen() {
  const { repository, revision } = useStore();
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(monthKey(today));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const changeMonth = useCallback((offset: number) => {
    setMonth((current) => {
      const next = moveMonth(current, offset);
      setSelected(`${next}-01`);
      return next;
    });
  }, []);
  const changeRef = useRef(changeMonth);
  changeRef.current = changeMonth;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 25 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > 50) changeRef.current(g.dx < 0 ? 1 : -1);
        },
      }),
    [],
  );
  useEffect(() => {
    const update = () => setToday(dateKey(new Date()));
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    const timer = setInterval(update, 30000);
    return () => {
      listener.remove();
      clearInterval(timer);
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      setEvents([]);
      void repository
        .month(month)
        .then((rows) => {
          if (active) setEvents(rows);
        })
        .catch(() => {
          if (active) setError("日程加载失败，请重试。已保存的数据不会丢失。");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [repository, month, revision, attempt]),
  );
  const cells = useMemo(() => monthCells(month), [month]);
  const marked = useMemo(
    () => new Set(events.map((event) => event.date)),
    [events],
  );
  const dayEvents = useMemo(
    () => events.filter((event) => event.date === selected),
    [events, selected],
  );
  const goToday = () => {
    const now = dateKey(new Date());
    setToday(now);
    setSelected(now);
    setMonth(monthKey(now));
  };
  const [year, monthNumber] = month.split("-");
  return (
    <SafeAreaView style={ui.page} edges={["top", "left", "right", "bottom"]}>
      <View style={ui.top}>
        <View>
          <Text style={s.eyebrow}>给每一天，留一点空间</Text>
          <Text style={ui.heading}>我的日历</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开设置和备份"
          style={ui.softButton}
          onPress={() => router.push("/settings")}
        >
          <Text style={ui.link}>设置</Text>
        </Pressable>
      </View>
      <FlatList
        data={loading || error ? [] : dayEvents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.content}
        ListHeaderComponent={
          <>
            <View style={s.calendar} {...pan.panHandlers}>
              <View style={s.monthBar}>
                <Text accessibilityRole="header" style={s.monthTitle}>
                  {year}年{Number(monthNumber)}月
                </Text>
                <View style={s.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="上个月"
                    style={s.arrow}
                    onPress={() => changeMonth(-1)}
                  >
                    <Text style={s.arrowText}>‹</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={s.todayButton}
                    onPress={goToday}
                  >
                    <Text style={ui.link}>今天</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="下个月"
                    style={s.arrow}
                    onPress={() => changeMonth(1)}
                  >
                    <Text style={s.arrowText}>›</Text>
                  </Pressable>
                </View>
              </View>
              <View style={s.grid}>
                {["一", "二", "三", "四", "五", "六", "日"].map((day, i) => (
                  <View style={s.week} key={day}>
                    <Text
                      style={[s.weekText, i > 4 && { color: colors.primary }]}
                    >
                      {day}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={s.grid}>
                {cells.map((date, i) => (
                  <View key={date ?? `blank-${i}`} style={s.cell}>
                    {date && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${date}${date === today ? "，今天" : ""}${marked.has(date) ? "，有安排" : ""}`}
                        accessibilityState={{ selected: selected === date }}
                        style={[
                          s.day,
                          date === today && s.today,
                          date === selected && s.selected,
                        ]}
                        onPress={() => setSelected(date)}
                      >
                        <Text
                          style={[
                            s.dayText,
                            date === today && s.todayText,
                            date === selected && s.selectedText,
                          ]}
                        >
                          {Number(date.slice(-2))}
                        </Text>
                        <View
                          style={[
                            s.dot,
                            {
                              backgroundColor: marked.has(date)
                                ? selected === date
                                  ? "#FFFFFF"
                                  : colors.primary
                                : "transparent",
                            },
                          ]}
                        />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
              <View style={s.legend}>
                <View style={[s.dot, { backgroundColor: colors.primary }]} />
                <Text style={s.legendText}>有安排的日子，都在这里</Text>
              </View>
            </View>
            <View style={s.section}>
              <View>
                <Text accessibilityRole="header" style={ui.title}>
                  {dateLabel(selected)}
                </Text>
                <Text style={ui.sub}>
                  {selected === today ? "今天" : selected.slice(0, 4) + "年"} ·{" "}
                  {loading ? "正在加载" : `${dayEvents.length} 项安排`}
                </Text>
              </View>
              <Text style={s.sectionMark}>日程</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={s.empty}>
              <ActivityIndicator color={colors.primary} />
              <Text style={ui.sub}>正在读取安排…</Text>
            </View>
          ) : error ? (
            <View style={s.empty}>
              <Text style={ui.error}>{error}</Text>
              <Pressable
                style={ui.softButton}
                onPress={() => setAttempt((x) => x + 1)}
              >
                <Text style={ui.link}>重新加载</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[ui.card, s.empty]}>
              <View style={s.emptyIcon}>
                <Text style={s.emptyGlyph}>＋</Text>
              </View>
              <Text style={ui.title}>这一天，还留着空白</Text>
              <Text style={[ui.sub, { textAlign: "center" }]}>
                记下一个计划，或是生活里的小事。{"\n"}你的每一天，都值得被记住。
              </Text>
              <Pressable
                style={ui.softButton}
                onPress={() =>
                  router.push({
                    pathname: "/event",
                    params: { date: selected },
                  })
                }
              >
                <Text style={ui.link}>写下第一项安排</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`编辑${item.title}，${timeLabel(item)}`}
            style={s.event}
            onPress={() =>
              router.push({ pathname: "/event", params: { id: item.id } })
            }
          >
            <View style={s.eventStripe} />
            <View style={s.eventBody}>
              <Text style={s.time}>{timeLabel(item)}</Text>
              <Text style={s.eventTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {!!item.note && (
                <Text style={s.note} numberOfLines={3}>
                  {item.note}
                </Text>
              )}
            </View>
            <Text style={s.chevron}>›</Text>
          </Pressable>
        )}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`为${selected}添加日程`}
        style={s.fab}
        onPress={() =>
          router.push({ pathname: "/event", params: { date: selected } })
        }
      >
        <Text style={s.fabPlus}>＋</Text>
        <Text style={s.fabText}>添加日程</Text>
      </Pressable>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  eyebrow: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
    letterSpacing: 1,
  },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 112 },
  calendar: {
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
    paddingVertical: 8,
  },
  row: { flexDirection: "row", alignItems: "center" },
  arrow: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowText: { fontSize: 30, color: colors.muted },
  todayButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  week: { width: "14.285714%", alignItems: "center", paddingVertical: 10 },
  weekText: { fontSize: 13, color: colors.muted },
  cell: {
    width: "14.285714%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 49,
  },
  day: {
    width: "96%",
    minHeight: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 5,
  },
  dayText: { color: colors.ink, fontSize: 16, fontWeight: "500" },
  today: { backgroundColor: colors.pale, borderColor: "#B8CDF4" },
  todayText: { color: colors.primary, fontWeight: "700" },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectedText: { color: "#FFFFFF", fontWeight: "700" },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 12,
  },
  legendText: { fontSize: 11, color: colors.muted },
  section: {
    paddingVertical: 22,
    paddingHorizontal: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionMark: { color: colors.muted, fontSize: 12, letterSpacing: 2 },
  empty: { padding: 25, alignItems: "center", gap: 13 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyGlyph: { color: colors.primary, fontSize: 28 },
  event: {
    backgroundColor: colors.card,
    borderRadius: 18,
    marginBottom: 12,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  eventStripe: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: "#B8CDF4",
    borderRadius: 3,
  },
  eventBody: { flex: 1, gap: 6 },
  time: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  eventTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 25,
  },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  chevron: { color: "#A2AFC3", fontSize: 24 },
  fab: {
    position: "absolute",
    bottom: 28,
    right: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 22,
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    elevation: 5,
    boxShadow: "0 5px 16px #487BDF35",
  },
  fabPlus: { color: "#FFFFFF", fontSize: 25 },
  fabText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
});
