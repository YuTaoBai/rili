import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Database,
  EventRepository,
  migrate,
  SqlConnection,
  SqlValue,
} from "../src/database";
import {
  CalendarEvent,
  EventInput,
  makeBackup,
  parseBackup,
} from "../src/events";
class SQLiteAdapter implements Database {
  connection: DatabaseSync;
  constructor(path = ":memory:") {
    this.connection = new DatabaseSync(path);
  }
  async execAsync(sql: string) {
    this.connection.exec(sql);
  }
  async runAsync(sql: string, ...params: SqlValue[]) {
    return {
      changes: Number(this.connection.prepare(sql).run(...params).changes),
    };
  }
  async getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]> {
    return this.connection.prepare(sql).all(...params) as T[];
  }
  async getFirstAsync<T>(
    sql: string,
    ...params: SqlValue[]
  ): Promise<T | null> {
    return (this.connection.prepare(sql).get(...params) as T) ?? null;
  }
  async withExclusiveTransactionAsync(
    task: (tx: SqlConnection) => Promise<void>,
  ) {
    this.connection.exec("BEGIN IMMEDIATE");
    try {
      await task(this);
      this.connection.exec("COMMIT");
    } catch (error) {
      this.connection.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.connection.close();
  }
}
const input = (overrides: Partial<EventInput> = {}): EventInput => ({
  date: "2028-02-29",
  title: "参加面试",
  note: "多行备注\n' ; DROP TABLE events; --",
  startTime: null,
  endTime: null,
  isAllDay: false,
  ...overrides,
});
const stamp = "2026-11-01T01:00:00.000Z";
const event = (
  id: string,
  overrides: Partial<EventInput> = {},
): CalendarEvent => ({
  ...input(overrides),
  id,
  createdAt: stamp,
  updatedAt: stamp,
});
test("SQLite persists across close/reopen, supports multiple entries and parameterized CRUD", async () => {
  const dir = mkdtempSync(join(tmpdir(), "calendar-"));
  let db = new SQLiteAdapter(join(dir, "calendar.db"));
  try {
    await migrate(db);
    let repo = new EventRepository(db);
    await repo.save("first", input(), stamp);
    await repo.save("second", input({ title: "看医生" }), stamp);
    db.close();
    db = new SQLiteAdapter(join(dir, "calendar.db"));
    await migrate(db);
    repo = new EventRepository(db);
    const rows = await repo.month("2028-02");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].note, input().note);
    assert.equal((await repo.month("2028-03")).length, 0);
    await repo.save(
      "first",
      input({ date: "2028-03-01", title: "已修改" }),
      "2026-11-02T01:00:00.000Z",
      true,
    );
    assert.equal((await repo.month("2028-02")).length, 1);
    assert.equal((await repo.month("2028-03"))[0].title, "已修改");
    assert.equal((await repo.get("first"))?.createdAt, stamp);
    await repo.remove("first");
    assert.equal(await repo.get("first"), null);
    await assert.rejects(repo.save("first", input(), stamp, true), /不存在/);
    assert.equal((await repo.all()).length, 1);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("stable order: all-day, timed ascending, untimed; indexed month and cross-year boundaries", async () => {
  const db = new SQLiteAdapter();
  await migrate(db);
  const repo = new EventRepository(db);
  try {
    await repo.save("note", input(), stamp);
    await repo.save("late", input({ startTime: "18:00" }), stamp);
    await repo.save(
      "early",
      input({ startTime: "09:00", endTime: "10:00" }),
      stamp,
    );
    await repo.save("all", input({ isAllDay: true }), stamp);
    assert.deepEqual(
      (await repo.month("2028-02")).map((x) => x.id),
      ["all", "early", "late", "note"],
    );
    await repo.save("dec", input({ date: "2027-12-31" }), stamp);
    await repo.save("jan", input({ date: "2028-01-01" }), stamp);
    assert.deepEqual(
      (await repo.month("2027-12")).map((x) => x.id),
      ["dec"],
    );
    assert.deepEqual(
      (await repo.month("2028-01")).map((x) => x.id),
      ["jan"],
    );
    const plan = await db.getAllAsync<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT * FROM events WHERE date >= ? AND date < ?",
      "2028-02-01",
      "2028-03-01",
    );
    assert.ok(plan.some((row) => row.detail.includes("events_date_idx")));
  } finally {
    db.close();
  }
});
test("backup roundtrip, skip/replace conflicts, retain other entries, transaction rollback", async () => {
  const db = new SQLiteAdapter();
  await migrate(db);
  const repo = new EventRepository(db);
  try {
    await repo.save("old", input({ title: "本机内容" }), stamp);
    const backup = parseBackup(
      makeBackup([event("old", { title: "备份内容" }), event("new")]),
    );
    assert.deepEqual(await repo.import(backup, "skip"), {
      added: 1,
      replaced: 0,
      skipped: 1,
    });
    assert.equal((await repo.get("old"))?.title, "本机内容");
    assert.deepEqual(await repo.import(backup, "replace"), {
      added: 0,
      replaced: 2,
      skipped: 0,
    });
    assert.equal((await repo.get("old"))?.title, "备份内容");
    const snapshot = await repo.all();
    // Force a real SQLite write failure after the first row, not a mocked transaction.
    await db.execAsync(
      "CREATE TRIGGER reject_bad BEFORE INSERT ON events WHEN NEW.id = 'bad' BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END;",
    );
    await assert.rejects(
      repo.import([event("good"), event("bad")], "replace"),
      /simulated disk failure/,
    );
    assert.deepEqual(await repo.all(), snapshot);
    const restored = new SQLiteAdapter();
    await migrate(restored);
    try {
      const fresh = new EventRepository(restored);
      await fresh.import(parseBackup(makeBackup(snapshot)), "skip");
      assert.deepEqual(await fresh.all(), snapshot);
    } finally {
      restored.close();
    }
  } finally {
    db.close();
  }
});
test("migrations repeat safely and reject a newer database without altering it", async () => {
  const db = new SQLiteAdapter();
  try {
    await migrate(db);
    await migrate(db);
    await db.execAsync("PRAGMA user_version = 2;");
    await assert.rejects(migrate(db), /更新版本/);
    assert.equal(
      (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
        ?.user_version,
      2,
    );
  } finally {
    db.close();
  }
});
test("clock moving backwards cannot invalidate createdAt/updatedAt invariants", async () => {
  const db = new SQLiteAdapter();
  await migrate(db);
  const repo = new EventRepository(db);
  try {
    await repo.save("clock", input(), stamp);
    await repo.save("clock", input(), "2026-10-01T00:00:00.000Z", true);
    assert.equal(parseBackup(makeBackup(await repo.all())).length, 1);
  } finally {
    db.close();
  }
});
