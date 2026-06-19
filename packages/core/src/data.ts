import snapshot from "../data/snapshot.json" with { type: "json" };
import type { Deadline, Perk, Session, Snapshot, Venue } from "./schemas";
import { getCurrentTime, isNowWithin } from "./time";

/**
 * Static event data, served from the bundled snapshot emitted by the seed
 * script. Reading from this in-memory snapshot (instead of D1 at request time)
 * keeps the hot path fast and sidesteps the Option-B global rate limit. D1
 * remains the system-of-record; runtime D1 reads are reserved for mutable user
 * data (see ./d1).
 */

const data = snapshot as Snapshot;

export function getSnapshotMeta(): { generatedAt: number; counts: Record<string, number> } {
  return {
    generatedAt: data.generatedAt,
    counts: {
      sessions: data.sessions.length,
      venues: data.venues.length,
      perks: data.perks.length,
      deadlines: data.deadlines.length,
    },
  };
}

export function allSessions(): Session[] {
  return data.sessions;
}

export function allVenues(): Venue[] {
  return data.venues;
}

export function allPerks(): Perk[] {
  return data.perks;
}

export function allDeadlines(): Deadline[] {
  return data.deadlines;
}

export function getSessionById(id: string): Session | undefined {
  return data.sessions.find((s) => s.id === id);
}

export function getDeadlineById(id: string): Deadline | undefined {
  return data.deadlines.find((d) => d.id === id);
}

export function getVenueById(id: string | null | undefined): Venue | undefined {
  if (!id) return undefined;
  return data.venues.find((v) => v.id === id);
}

/** Sessions sorted by start time (sessions without a start sort last). */
export function sessionsByStart(): Session[] {
  return [...data.sessions].sort(
    (a, b) => (a.startsAt ?? Number.POSITIVE_INFINITY) - (b.startsAt ?? Number.POSITIVE_INFINITY),
  );
}

/** Sessions currently in progress at `now` (demo-clock aware). */
export function getNowSessions(now: number = getCurrentTime()): Session[] {
  return data.sessions
    .filter((s) => isNowWithin(s.startsAt ?? null, s.endsAt ?? null, now))
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
}

/**
 * The next sessions starting after `now`. Returns up to `limit` sessions sorted
 * by start time; sessions sharing the same start (parallel tracks) keep their
 * relative order, so a tie at the limit boundary may be truncated.
 */
export function getNextSessions(now: number = getCurrentTime(), limit = 5): Session[] {
  const upcoming = data.sessions
    .filter((s) => s.startsAt != null && s.startsAt > now)
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
  return upcoming.slice(0, limit);
}

/** Upcoming deadlines after `now`, soonest first. */
export function getUpcomingDeadlines(now: number = getCurrentTime()): Deadline[] {
  return data.deadlines
    .filter((d) => d.dueAt == null || d.dueAt >= now)
    .sort((a, b) => (a.dueAt ?? Number.POSITIVE_INFINITY) - (b.dueAt ?? Number.POSITIVE_INFINITY));
}

/** Sessions on a given ISO date (e.g. "2026-07-08"). */
export function sessionsOnDay(isoDate: string): Session[] {
  return sessionsByStart().filter((s) => s.day === isoDate);
}

/** Filter sessions by a free-text query over title/partner/track/type. */
export function findSessions(query: string): Session[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return data.sessions.filter((s) =>
    [s.title, s.partner, s.track, s.type, s.dayTheme]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(q)),
  );
}
