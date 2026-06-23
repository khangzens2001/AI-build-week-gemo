import { describe, expect, test } from "bun:test";
import { getNextSessions, getNowSessions, getUpcomingDeadlines } from "../src/data";
import { tools } from "../src/tools";

// Day 1, 11:00 GMT+7 — during the BytePlus workshop (10:00–12:00).
const DAY1_1100 = Date.parse("2026-07-08T11:00:00+07:00");

// The AI SDK tool `execute` requires an options arg; tests don't use it.
const opts = {} as never;

describe("getNow data layer", () => {
  test("returns in-progress sessions at 11:00 on Day 1", () => {
    const sessions = getNowSessions(DAY1_1100);
    expect(sessions.length).toBeGreaterThan(0);
    expect(
      sessions.some((s) => /byteplus/i.test(s.title) || /byteplus/i.test(s.partner ?? "")),
    ).toBe(true);
  });
});

describe("getNext data layer", () => {
  test("respects the limit and returns only future sessions", () => {
    const sessions = getNextSessions(DAY1_1100, 3);
    expect(sessions.length).toBeLessThanOrEqual(3);
    for (const s of sessions) expect((s.startsAt ?? 0) > DAY1_1100).toBe(true);
  });
});

describe("findWorkshops tool", () => {
  test("matches a partner and can filter by day", async () => {
    const out = await tools.findWorkshops.execute({ query: "byteplus", day: null }, opts);
    expect(out.sessions.length).toBeGreaterThan(0);

    const off = await tools.findWorkshops.execute({ query: "byteplus", day: "2026-07-12" }, opts);
    expect(off.sessions.length).toBe(0); // BytePlus is Day 1, not Day 5
  });
});

describe("getDirections tool", () => {
  test("resolves a venue via sessionId (session → venue → coords/mapUrl)", async () => {
    const out = await tools.getDirections.execute(
      { sessionId: "day01-byteplus", query: null },
      opts,
    );
    expect(out.found).toBe(true);
    if (out.found) {
      expect(out.venue.name).toBeTruthy();
      expect(out.venue.mapUrl).toBeTruthy();
    }
  });

  test("resolves by query when no id is given", async () => {
    const out = await tools.getDirections.execute({ sessionId: null, query: "byteplus" }, opts);
    expect(out.found).toBe(true);
  });

  test("reports not found for an unknown session", async () => {
    const out = await tools.getDirections.execute(
      { sessionId: "does-not-exist", query: null },
      opts,
    );
    expect(out.found).toBe(false);
  });
});

describe("listPerks + getDeadlines tools", () => {
  test("listPerks returns perks with claim info and sources", async () => {
    const out = await tools.listPerks.execute({}, opts);
    expect(out.perks.length).toBe(4);
    expect(out.perks.every((p) => p.sourceUrl)).toBe(true);
  });

  test("getUpcomingDeadlines surfaces an upcoming deadline", () => {
    const deadlines = getUpcomingDeadlines(DAY1_1100);
    expect(deadlines.length).toBeGreaterThan(0);
  });
});

describe("setReminder tool", () => {
  test("computes fireAt minutesBefore the session start", async () => {
    const out = await tools.setReminder.execute(
      { targetId: "day01-byteplus", targetKind: "session", minutesBefore: 15 },
      opts,
    );
    expect(out.confirmable).toBe(true);
    // BytePlus starts 10:00 GMT+7; 15 min before = 09:45 GMT+7.
    expect(out.intent.fireAt).toBe(Date.parse("2026-07-08T09:45:00+07:00"));
  });

  test("is not confirmable for a target without a start time", async () => {
    const out = await tools.setReminder.execute(
      { targetId: "unknown-id", targetKind: "session", minutesBefore: 10 },
      opts,
    );
    expect(out.confirmable).toBe(false);
  });
});
