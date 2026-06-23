/**
 * Time utilities for the AABW event (Asia/Ho_Chi_Minh, GMT+7).
 *
 * Everything runs on the real wall clock: {@link getCurrentTime} returns
 * `Date.now()`. The helpers below format epoch ms into GMT+7 wall-clock and
 * date labels and convert event-local times to epoch ms.
 */

/** Fixed UTC offset for Indochina Time (GMT+7). AABW has no DST. */
export const AABW_TZ_OFFSET = "+07:00";

/** The single source of truth for "now", in epoch ms — the real wall clock. */
export function getCurrentTime(): number {
  return Date.now();
}

/** Convenience: current time as a `Date`. */
export function getCurrentDate(): Date {
  return new Date(getCurrentTime());
}

/**
 * Convert an event-local date + "HH:MM" time into epoch ms, interpreting the
 * wall-clock time as Indochina Time (GMT+7). Returns null if either part is
 * missing or unparseable, so callers can treat times as optional.
 *
 * @param date ISO date, e.g. "2026-07-08"
 * @param time 24h clock, e.g. "10:00" (may be null for open-ended blocks)
 */
export function eventTimeToEpoch(
  date: string | null | undefined,
  time: string | null | undefined,
): number | null {
  if (!date || !time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match?.[1] || !match[2]) return null;
  const hh = match[1].padStart(2, "0");
  const mm = match[2];
  const ms = Date.parse(`${date}T${hh}:${mm}:00${AABW_TZ_OFFSET}`);
  return Number.isNaN(ms) ? null : ms;
}

/** Whether `nowMs` falls within [startsAt, endsAt). Open ends are treated leniently. */
export function isNowWithin(
  startsAt: number | null,
  endsAt: number | null,
  nowMs: number = getCurrentTime(),
): boolean {
  if (startsAt == null) return false;
  if (nowMs < startsAt) return false;
  if (endsAt == null) return true; // started, no known end → consider ongoing
  return nowMs < endsAt;
}

/** Format an epoch ms as a GMT+7 wall-clock label like "10:00". */
export function formatTimeLabel(epochMs: number | null): string {
  if (epochMs == null) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(epochMs));
}

/** Format an epoch ms as a GMT+7 date label like "Wednesday, 23/06/2026". */
export function formatDateLabel(epochMs: number = getCurrentTime()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(epochMs));
}

/** ISO date (YYYY-MM-DD) in the event timezone for an epoch ms. */
export function isoDateLabel(epochMs: number = getCurrentTime()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(epochMs),
  );
}
