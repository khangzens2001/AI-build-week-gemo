import { afterEach, describe, expect, test } from "bun:test";
import { eventTimeToEpoch, formatTimeLabel, getCurrentTime, isNowWithin } from "../src/time";

const DAY1 = "2026-07-08";

afterEach(() => {
  process.env.DEMO_NOW = undefined;
  process.env.NEXT_PUBLIC_DEMO_NOW = undefined;
});

describe("eventTimeToEpoch", () => {
  test("parses a GMT+7 wall-clock time to epoch ms", () => {
    const ms = eventTimeToEpoch(DAY1, "10:00");
    // 2026-07-08 10:00 +07:00 === 2026-07-08 03:00 UTC
    expect(ms).toBe(Date.parse("2026-07-08T03:00:00Z"));
  });

  test("pads single-digit hours", () => {
    expect(eventTimeToEpoch(DAY1, "9:00")).toBe(eventTimeToEpoch(DAY1, "09:00"));
  });

  test("returns null for missing/invalid input", () => {
    expect(eventTimeToEpoch(DAY1, null)).toBeNull();
    expect(eventTimeToEpoch(null, "10:00")).toBeNull();
    expect(eventTimeToEpoch(DAY1, "noon")).toBeNull();
  });
});

describe("formatTimeLabel", () => {
  test("formats epoch back to a GMT+7 HH:MM label", () => {
    const ms = eventTimeToEpoch(DAY1, "14:30");
    expect(formatTimeLabel(ms)).toBe("14:30");
  });

  test("empty string for null", () => {
    expect(formatTimeLabel(null)).toBe("");
  });
});

describe("isNowWithin", () => {
  const start = eventTimeToEpoch(DAY1, "10:00");
  const end = eventTimeToEpoch(DAY1, "12:00");

  test("true when now is inside the window", () => {
    expect(isNowWithin(start, end, eventTimeToEpoch(DAY1, "11:00")!)).toBe(true);
  });

  test("false before start and at/after end", () => {
    expect(isNowWithin(start, end, eventTimeToEpoch(DAY1, "09:59")!)).toBe(false);
    expect(isNowWithin(start, end, end!)).toBe(false);
  });

  test("open-ended block is ongoing once started", () => {
    expect(isNowWithin(start, null, eventTimeToEpoch(DAY1, "23:00")!)).toBe(true);
  });

  test("never ongoing without a start", () => {
    expect(isNowWithin(null, end, start!)).toBe(false);
  });
});

describe("getCurrentTime (demo clock)", () => {
  test("uses DEMO_NOW override when set", () => {
    process.env.DEMO_NOW = "2026-07-08T10:30:00+07:00";
    expect(getCurrentTime()).toBe(Date.parse("2026-07-08T03:30:00Z"));
  });

  test("falls back to wall clock when unset/invalid", () => {
    process.env.DEMO_NOW = "not-a-date";
    const before = Date.now();
    const now = getCurrentTime();
    expect(now).toBeGreaterThanOrEqual(before);
  });
});
