import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateKey,
  dateLabel,
  monthCells,
  monthRange,
  moveMonth,
  parseDate,
} from "../src/calendar";
import {
  makeBackup,
  parseBackup,
  validateInput,
  EventInput,
} from "../src/events";
const base: EventInput = {
  date: "2028-02-29",
  title: "  面试  ",
  note: "第一行\n第二行",
  startTime: null,
  endTime: null,
  isAllDay: false,
};
test("Monday-first month layouts, real leap days, 4/5/6-week grids", () => {
  assert.equal(monthCells("2026-11").indexOf("2026-11-01"), 6);
  assert.equal(monthCells("2028-02").filter(Boolean).length, 29);
  assert.equal(monthCells("2027-02").filter(Boolean).length, 28);
  assert.equal(monthCells("2021-02").length, 28);
  assert.equal(monthCells("2026-11").length, 42);
  assert.equal(dateLabel("2028-02-29"), "2月29日 · 星期二");
  assert.throws(() => parseDate("2027-02-29"));
  assert.throws(() => parseDate("2028-04-31"));
  assert.throws(() => parseDate("2028-2-9"));
});
test("cross-year transitions and supported year bounds", () => {
  assert.equal(moveMonth("2026-12", 1), "2027-01");
  assert.equal(moveMonth("2027-01", -1), "2026-12");
  assert.deepEqual(monthRange("2026-12"), ["2026-12-01", "2027-01-01"]);
  assert.equal(moveMonth("1900-01", -1), "1900-01");
  assert.equal(moveMonth("9999-12", 1), "9999-12");
  assert.deepEqual(monthRange("9999-12"), ["9999-12-01", "9999-12-32"]);
});
test("local civil dates stay local in UTC-8, UTC+8, UTC+14 and DST transitions", () => {
  const old = process.env.TZ;
  try {
    for (const zone of [
      "UTC",
      "Asia/Shanghai",
      "America/Los_Angeles",
      "Pacific/Kiritimati",
      "America/Santiago",
    ]) {
      process.env.TZ = zone;
      for (const key of [
        "2028-02-29",
        "2026-03-08",
        "2026-11-01",
        "2026-09-06",
        "2027-01-01",
      ]) {
        assert.equal(dateKey(parseDate(key)), key, `${zone} ${key}`);
      }
      assert.equal(dateKey(new Date(2026, 10, 1, 0, 5)), "2026-11-01");
      assert.equal(dateKey(new Date(2026, 10, 1, 23, 55)), "2026-11-01");
    }
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test("title, multiline notes, optional times, all-day and invalid ranges", () => {
  assert.equal(validateInput(base).title, "面试");
  assert.equal(validateInput(base).note, base.note);
  assert.doesNotThrow(() =>
    validateInput({ ...base, startTime: "09:00", endTime: "09:00" }),
  );
  for (const patch of [
    { title: "" },
    { title: "x".repeat(121) },
    { note: "x".repeat(20001) },
    { startTime: "9:00" },
    { startTime: "24:00" },
    { endTime: "10:00" },
    { startTime: "10:00", endTime: "09:00" },
    { isAllDay: true, startTime: "10:00" },
  ]) {
    assert.throws(() => validateInput({ ...base, ...patch }));
  }
});
test("backup format validation rejects malformed entries before import", () => {
  const record = {
    ...base,
    title: "面试",
    id: "test-id",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
  assert.equal(parseBackup(makeBackup([record]))[0].id, "test-id");
  assert.deepEqual(parseBackup(makeBackup([])), []);
  assert.throws(() => parseBackup("not json"));
  assert.throws(() =>
    parseBackup('{"format":"unknown","version":1,"events":[]}'),
  );
  assert.throws(() => parseBackup(makeBackup([record, record])), /重复 ID/);
  for (const patch of [
    { date: "2027-02-29" },
    { id: "../bad" },
    { isAllDay: 1 },
    { createdAt: "not a date" },
    { updatedAt: "2025-11-01T00:00:00.000Z" },
    { title: null },
    { note: {} },
  ]) {
    assert.throws(() =>
      parseBackup(
        JSON.stringify({
          format: "my-calendar-backup",
          version: 1,
          events: [{ ...record, ...patch }],
        }),
      ),
    );
  }
});
