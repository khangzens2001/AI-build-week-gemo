import { describe, expect, test } from "bun:test";
import {
  eventTimeToEpoch,
  formatTimeLabel,
  getCurrentTime,
  isNowWithin,
  isoDateLabel,
} from "../src/time";

const DAY1 = "2026-07-08";

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

describe("getCurrentTime", () => {
  test("tracks the real wall clock", () => {
    expect(Math.abs(getCurrentTime() - Date.now())).toBeLessThan(1000);
  });
});

describe("isoDateLabel", () => {
  test("formats epoch ms to a GMT+7 ISO date", () => {
    expect(isoDateLabel(Date.parse("2026-07-08T10:00:00+07:00"))).toBe("2026-07-08");
  });

  test("rolls into the next GMT+7 day for late-UTC times", () => {
    // 2026-07-08 18:00 UTC === 2026-07-09 01:00 GMT+7.
    expect(isoDateLabel(Date.parse("2026-07-08T18:00:00Z"))).toBe("2026-07-09");
  });
});
