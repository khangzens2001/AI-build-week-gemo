import { clockSeed } from "./now";
import { EVENT_DAYS, type EventDay } from "./types";

/**
 * Human time + countdown helpers, all driven by the demo clock so the UI agrees
 * with the server. Times from the API are epoch ms (GMT+7 wall clock baked in).
 */

const HCMC_TZ = "Asia/Ho_Chi_Minh";
export { HCMC_TZ };

/** Single source of truth: Day 1 kickoff — 2026-07-08 09:00 GMT+7 (epoch ms). */
export const EVENT_START_MS = Date.parse("2026-07-08T09:00:00+07:00");
/** Event close — end of Day 5, 2026-07-12 23:59 GMT+7 (epoch ms). */
export const EVENT_END_MS = Date.parse("2026-07-12T23:59:00+07:00");

/** ISO date (YYYY-MM-DD) in the event timezone for an epoch ms. */
export function isoDateInTz(epochMs: number): string {
  // en-CA yields YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: HCMC_TZ }).format(new Date(epochMs));
}

/** The EVENT_DAYS entry matching `nowMs` (in event tz), or null if outside the window. */
export function currentEventDay(nowMs: number): EventDay | null {
  const today = isoDateInTz(nowMs);
  return EVENT_DAYS.find((d) => d.day === today) ?? null;
}

/** "10:00" style wall-clock label in event timezone. */
export function timeLabel(epochMs: number | null | undefined): string {
  if (epochMs == null) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: HCMC_TZ,
  }).format(new Date(epochMs));
}

/** "Wed, Jul 8" style date label in event timezone. */
export function dateLabel(epochMs: number | null | undefined): string {
  if (epochMs == null) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: HCMC_TZ,
  }).format(new Date(epochMs));
}

export type Countdown = {
  /** Whole ms remaining (negative once passed). */
  ms: number;
  past: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function countdownTo(target: number, from: number = clockSeed()): Countdown {
  const ms = target - from;
  const past = ms <= 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const seconds = Math.floor((abs % 60_000) / 1000);
  return { ms, past, days, hours, minutes, seconds };
}

/** Compact relative phrase: "in 25 min", "in 2h 10m", "in 3 days", "just now". */
export function relativePhrase(target: number, from: number = clockSeed()): string {
  const c = countdownTo(target, from);
  const sign = c.past ? "ago" : "in";
  if (c.days >= 1) {
    const d = c.days + (c.hours >= 12 ? 1 : 0);
    return `${sign === "in" ? "in " : ""}${d} day${d === 1 ? "" : "s"}${sign === "ago" ? " ago" : ""}`;
  }
  if (c.hours >= 1) {
    return `${sign === "in" ? "in " : ""}${c.hours}h ${c.minutes}m${sign === "ago" ? " ago" : ""}`;
  }
  if (c.minutes >= 1) {
    return `${sign === "in" ? "in " : ""}${c.minutes} min${sign === "ago" ? " ago" : ""}`;
  }
  return c.past ? "just now" : "any moment";
}

/** "1:23:45" / "12:05" clock string for a countdown, days folded into hours. */
export function clockString(c: Countdown): string {
  const totalHours = c.days * 24 + c.hours;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (totalHours > 0) return `${totalHours}:${pad(c.minutes)}:${pad(c.seconds)}`;
  return `${pad(c.minutes)}:${pad(c.seconds)}`;
}
