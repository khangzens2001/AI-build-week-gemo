import { afterEach, describe, expect, test } from "bun:test";
import { tools } from "../src/tools";

// Day 1, 11:00 GMT+7 — during the BytePlus workshop (10:00–12:00).
const DEMO = "2026-07-08T11:00:00+07:00";

// The AI SDK tool `execute` requires an options arg; tests don't use it.
const opts = {} as never;

afterEach(() => {
  process.env.DEMO_NOW = undefined;
});

describe("getNow tool", () => {
  test("returns in-progress sessions with venue + a now label", async () => {
    process.env.DEMO_NOW = DEMO;
    const out = await tools.getNow.execute({}, opts);
    expect(out.now).toBe("11:00");
    expect(out.sessions.length).toBeGreaterThan(0);
    expect(out.sessions[0]?.venue?.name).toBeTruthy();
  });
});

describe("getNext tool", () => {
  test("respects the limit and returns only future sessions", async () => {
    process.env.DEMO_NOW = DEMO;
    const out = await tools.getNext.execute({ limit: 3 }, opts);
    expect(out.sessions.length).toBeLessThanOrEqual(3);
    const now = Date.parse(DEMO);
    for (const s of out.sessions) expect((s?.startsAt ?? 0) > now).toBe(true);
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

  test("getDeadlines surfaces the submission deadline", async () => {
    process.env.DEMO_NOW = DEMO;
    const out = await tools.getDeadlines.execute({}, opts);
    expect(out.deadlines.some((d) => d.type === "submission")).toBe(true);
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
