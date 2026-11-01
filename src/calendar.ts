/** Calendar dates are local civil dates, never UTC instants. */
export function dateKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key))
    throw new Error("日期格式应为 YYYY-MM-DD");
  const [year, month, day] = key.split("-").map(Number);
  // Noon avoids midnight DST changes. setFullYear also handles years below 100.
  const date = new Date(2000, 0, 1, 12);
  date.setFullYear(year, month - 1, day);
  if (year < 1900 || year > 9999 || dateKey(date) !== key)
    throw new Error("请输入 1900 至 9999 年之间的有效日期");
  return date;
}
export function monthKey(key: string): string {
  return key.slice(0, 7);
}
export function moveMonth(month: string, offset: number): string {
  const date = parseDate(`${month}-01`);
  date.setMonth(date.getMonth() + offset);
  if (date.getFullYear() < 1900 || date.getFullYear() > 9999) return month;
  return dateKey(date).slice(0, 7);
}
export function monthRange(month: string): [string, string] {
  parseDate(`${month}-01`);
  const next = moveMonth(month, 1);
  return [`${month}-01`, next === month ? "9999-12-32" : `${next}-01`];
}
export function monthCells(month: string): (string | null)[] {
  const first = parseDate(`${month}-01`);
  const offset = (first.getDay() + 6) % 7;
  const last = new Date(first.getTime());
  last.setMonth(last.getMonth() + 1, 0);
  const count = last.getDate();
  const size = Math.ceil((offset + count) / 7) * 7;
  return Array.from({ length: size }, (_, i) =>
    i < offset || i >= offset + count
      ? null
      : `${month}-${String(i - offset + 1).padStart(2, "0")}`,
  );
}
export function dateLabel(key: string): string {
  const date = parseDate(key);
  return `${date.getMonth() + 1}月${date.getDate()}日 · 星期${"日一二三四五六"[date.getDay()]}`;
}
