import { parseDate } from "./calendar";
export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  note: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
};
export type EventInput = Pick<
  CalendarEvent,
  "date" | "title" | "note" | "startTime" | "endTime" | "isAllDay"
>;
export const MAX_EVENTS = 50000;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
// Hermes-compatible UTF-8 size, including Chinese and emoji, without a web polyfill.
export function utf8Size(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validateInput(input: EventInput): EventInput {
  parseDate(input.date);
  if (typeof input.title !== "string" || !input.title.trim())
    throw new Error("请填写日程标题");
  if (input.title.trim().length > 120)
    throw new Error("标题不能超过 120 个字符");
  if (typeof input.note !== "string" || input.note.length > 20000)
    throw new Error("备注不能超过 20000 个字符");
  if (typeof input.isAllDay !== "boolean")
    throw new Error("全天标记格式不正确");
  for (const time of [input.startTime, input.endTime]) {
    if (time !== null && (typeof time !== "string" || !timePattern.test(time)))
      throw new Error("时间请使用 24 小时制 HH:mm，例如 09:30");
  }
  if (input.isAllDay && (input.startTime || input.endTime))
    throw new Error("全天安排不能同时包含时间");
  if (input.endTime && !input.startTime)
    throw new Error("填写结束时间前，请先填写开始时间");
  if (input.startTime && input.endTime && input.endTime < input.startTime)
    throw new Error("结束时间不能早于开始时间");
  return { ...input, title: input.title.trim() };
}
export function timeLabel(event: EventInput): string {
  if (event.isAllDay) return "全天";
  if (!event.startTime) return "随心记";
  return event.endTime
    ? `${event.startTime} – ${event.endTime}`
    : event.startTime;
}
export function makeBackup(events: CalendarEvent[], now = new Date()): string {
  return JSON.stringify(
    {
      format: "my-calendar-backup",
      version: 1,
      exportedAt: now.toISOString(),
      events,
    },
    null,
    2,
  );
}
export function parseBackup(text: string): CalendarEvent[] {
  if (utf8Size(text) > MAX_BACKUP_BYTES)
    throw new Error("备份文件超过 20 MB，请拆分后重试");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("无法读取 JSON，请选择本应用导出的备份文件");
  }
  if (!data || typeof data !== "object") throw new Error("备份格式不正确");
  const backup = data as Record<string, unknown>;
  if (
    backup.format !== "my-calendar-backup" ||
    backup.version !== 1 ||
    !Array.isArray(backup.events)
  )
    throw new Error("不支持此备份格式或版本");
  if (backup.events.length > MAX_EVENTS)
    throw new Error("单次最多导入 50000 条日程");
  const seen = new Set<string>();
  return backup.events.map((value: unknown, i: number) => {
    try {
      if (!value || typeof value !== "object")
        throw new Error("日程格式不正确");
      const row = value as CalendarEvent;
      if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id))
        throw new Error("日程 ID 格式不正确");
      if (seen.has(row.id)) throw new Error("备份内包含重复 ID");
      seen.add(row.id);
      for (const stamp of [row.createdAt, row.updatedAt]) {
        if (
          typeof stamp !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp) ||
          !Number.isFinite(Date.parse(stamp)) ||
          new Date(stamp).toISOString() !== stamp
        )
          throw new Error("创建或修改时间无效");
      }
      if (row.updatedAt < row.createdAt)
        throw new Error("修改时间不能早于创建时间");
      const input = validateInput(row);
      return {
        ...input,
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    } catch (error) {
      throw new Error(
        `第 ${i + 1} 条日程：${error instanceof Error ? error.message : "数据无效"}`,
      );
    }
  });
}
