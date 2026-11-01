import { monthRange } from "./calendar";
import { CalendarEvent, EventInput, validateInput } from "./events";
export type SqlValue = string | number | null;
/** Small interface shared by expo-sqlite and our real SQLite test adapter. */
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
}
export interface Database extends SqlConnection {
  withExclusiveTransactionAsync(
    task: (tx: SqlConnection) => Promise<void>,
  ): Promise<void>;
}
type Row = Omit<CalendarEvent, "isAllDay"> & { isAllDay: number };
const fromRow = (row: Row): CalendarEvent => ({
  ...row,
  isAllDay: row.isAllDay === 1,
});
const order =
  "CASE WHEN isAllDay = 1 THEN 0 WHEN startTime IS NOT NULL THEN 1 ELSE 2 END, startTime, createdAt, id";
export async function migrate(db: Database): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  await db.withExclusiveTransactionAsync(async (tx) => {
    const version =
      (await tx.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
        ?.user_version ?? 0;
    if (version > 1) throw new Error("数据库来自更新版本，请升级应用后再试");
    if (version < 1) {
      await tx.execAsync(`CREATE TABLE events (
        id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
        startTime TEXT, endTime TEXT, isAllDay INTEGER NOT NULL CHECK(isAllDay IN (0, 1)),
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
      );
      CREATE INDEX events_date_idx ON events(date);
      PRAGMA user_version = 1;`);
    }
  });
}
export class EventRepository {
  constructor(private db: Database) {}
  async month(month: string): Promise<CalendarEvent[]> {
    const [start, end] = monthRange(month);
    const rows = await this.db.getAllAsync<Row>(
      `SELECT * FROM events WHERE date >= ? AND date < ? ORDER BY date, ${order}`,
      start,
      end,
    );
    return rows.map(fromRow);
  }
  async all(): Promise<CalendarEvent[]> {
    return (
      await this.db.getAllAsync<Row>(
        `SELECT * FROM events ORDER BY date, ${order}`,
      )
    ).map(fromRow);
  }
  async get(id: string): Promise<CalendarEvent | null> {
    const row = await this.db.getFirstAsync<Row>(
      "SELECT * FROM events WHERE id = ?",
      id,
    );
    return row ? fromRow(row) : null;
  }
  async save(
    id: string,
    input: EventInput,
    now = new Date().toISOString(),
    editing = false,
  ): Promise<void> {
    const data = validateInput(input);
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      const old = await tx.getFirstAsync<Row>(
        "SELECT * FROM events WHERE id = ?",
        id,
      );
      if (editing && !old) throw new Error("此日程已不存在，请返回日历刷新");
      if (!editing && old) throw new Error("日程 ID 冲突，请重新添加");
      // A device clock moved backwards must not produce an invalid backup timestamp.
      await this.put(tx, {
        ...data,
        id,
        createdAt: old?.createdAt ?? now,
        updatedAt: old && old.createdAt > now ? old.createdAt : now,
      });
    });
  }
  async remove(id: string): Promise<void> {
    await this.db.runAsync("DELETE FROM events WHERE id = ?", id);
  }
  async import(
    events: CalendarEvent[],
    mode: "skip" | "replace",
  ): Promise<{ added: number; replaced: number; skipped: number }> {
    const result = { added: 0, replaced: 0, skipped: 0 };
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      for (const event of events) {
        validateInput(event);
        const exists = await tx.getFirstAsync<{ id: string }>(
          "SELECT id FROM events WHERE id = ?",
          event.id,
        );
        if (exists && mode === "skip") {
          result.skipped++;
          continue;
        }
        await this.put(tx, event);
        if (exists) result.replaced++;
        else result.added++;
      }
    });
    return result;
  }
  private async put(tx: SqlConnection, event: CalendarEvent): Promise<void> {
    await tx.runAsync(
      `INSERT INTO events (id, date, title, note, startTime, endTime, isAllDay, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET date=excluded.date, title=excluded.title, note=excluded.note,
      startTime=excluded.startTime, endTime=excluded.endTime, isAllDay=excluded.isAllDay,
      createdAt=excluded.createdAt, updatedAt=excluded.updatedAt`,
      event.id,
      event.date,
      event.title,
      event.note,
      event.startTime,
      event.endTime,
      event.isAllDay ? 1 : 0,
      event.createdAt,
      event.updatedAt,
    );
  }
}
