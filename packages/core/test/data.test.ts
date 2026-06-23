import { describe, expect, test } from "bun:test";
import {
  findSessions,
  getNextSessions,
  getNowSessions,
  getSnapshotMeta,
  getUpcomingDeadlines,
  getVenueById,
  sessionsOnDay,
} from "../src/data";

// Anchored mid Day-1 morning (BytePlus workshop runs 10:00–12:00 GMT+7).
const DAY1_1100 = Date.parse("2026-07-08T11:00:00+07:00");
const DAY1_0800 = Date.parse("2026-07-08T08:00:00+07:00");

describe("snapshot integrity", () => {
  test("has the expected seed counts", () => {
    const { counts } = getSnapshotMeta();
    expect(counts.sessions).toBe(29);
    expect(counts.venues).toBe(4);
    expect(counts.perks).toBe(4);
    expect(counts.deadlines).toBe(2);
  });
});

describe("getNowSessions", () => {
  test("returns in-progress sessions at 11:00 on Day 1", () => {
    const now = getNowSessions(DAY1_1100);
    expect(now.length).toBeGreaterThan(0);
    // Every returned session must actually straddle 11:00.
    for (const s of now) {
      expect(s.startsAt!).toBeLessThanOrEqual(DAY1_1100);
      expect(s.endsAt == null || s.endsAt > DAY1_1100).toBe(true);
    }
  });

  test("returns nothing before the event starts", () => {
    expect(getNowSessions(DAY1_0800)).toHaveLength(0);
  });
});

describe("getNextSessions", () => {
  test("returns upcoming sessions sorted by start", () => {
    const next = getNextSessions(DAY1_1100, 5);
    expect(next.length).toBeGreaterThan(0);
    for (const s of next) expect(s.startsAt!).toBeGreaterThan(DAY1_1100);
    const starts = next.map((s) => s.startsAt!);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});

describe("venues + days", () => {
  test("sessions link to resolvable venues", () => {
    const day1 = sessionsOnDay("2026-07-08");
    expect(day1.length).toBeGreaterThan(0);
    const withVenue = day1.filter((s) => s.venueId && getVenueById(s.venueId));
    expect(withVenue.length).toBeGreaterThan(0);
  });
});

describe("findSessions", () => {
  test("matches by partner name", () => {
    const hits = findSessions("byteplus");
    expect(hits.some((s) => /byteplus/i.test(s.title) || /byteplus/i.test(s.partner ?? ""))).toBe(
      true,
    );
  });
});

describe("getUpcomingDeadlines", () => {
  test("includes the submission deadline before it passes", () => {
    const deadlines = getUpcomingDeadlines(DAY1_1100);
    expect(deadlines.some((d) => d.type === "submission")).toBe(true);
  });
});
