/**
 * Time utilities + the demo clock.
 *
 * The event runs Jul 8–12 2026 (Asia/Ho_Chi_Minh, GMT+7) but the app may be
 * demoed earlier. To keep "now / next" meaningful, every time-aware code path
 * resolves "current time" through {@link getCurrentTime} instead of calling
 * `Date.now()` directly. Set `DEMO_NOW` (server) / `NEXT_PUBLIC_DEMO_NOW`
 * (client) to an ISO timestamp to freeze the clock at a point during the event.
 * Tool/API layers may also pass an explicit `now` (e.g. from a `?now=` query)
 * which always wins over the env default.
 */

/** Fixed UTC offset for Indochina Time (GMT+7). AABW has no DST. */
export const AABW_TZ_OFFSET = "+07:00";

/** Resolve the configured demo-clock override from env, if any. */
function demoNowFromEnv(): number | undefined {
  // NEXT_PUBLIC_ value is inlined on the client; DEMO_NOW is server-only.
  const raw =
    (typeof process !== "undefined" ? process.env?.DEMO_NOW : undefined) ??
    (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_DEMO_NOW : undefined);
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * The single source of truth for "now", in epoch ms. Returns the demo-clock
 * override when configured, otherwise the real wall clock.
 */
export function getCurrentTime(): number {
  return demoNowFromEnv() ?? Date.now();
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
