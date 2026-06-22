import bundled from "../data/snapshot.json" with { type: "json" };
import {
  type Deadline,
  type Perk,
  type Session,
  type Snapshot,
  SnapshotSchema,
  type Venue,
} from "./schemas";
import { getCurrentTime, isNowWithin } from "./time";

/**
 * Static event data, served from a snapshot emitted by the seed script. Reading
 * from this in-memory snapshot (instead of D1 at request time) keeps the hot
 * path fast and sidesteps the Option-B global rate limit. D1 remains the
 * system-of-record; runtime D1 reads are reserved for mutable user data (see
 * ./d1).
 *
 * Two sources, in priority order:
 * - **Runtime file** (`SNAPSHOT_PATH`): on the VM the crawl→re-ingest loop writes
 *   a fresh snapshot to a mounted volume. We hot-reload it (mtime-cached) so the
 *   Schedule/now/next UI reflects new crawled content WITHOUT a rebuild+redeploy.
 * - **Bundled JSON** (build-time import): the ultimate fallback. Used when
 *   `SNAPSHOT_PATH` is unset (e.g. Vercel/local dev), the file is missing/invalid,
 *   or `node:fs` isn't available (Worker/edge). The app always has data.
 *
 * Safety: a runtime file is only adopted if it parses against SnapshotSchema AND
 * has at least `MIN_SESSIONS` sessions, so a brittle/partial crawl can't wipe the
 * Schedule UI down to zero.
 */

const bundledData = bundled as Snapshot;

// Path is read once at module load; only the VM web container sets it.
const SNAPSHOT_PATH = typeof process !== "undefined" ? process.env?.SNAPSHOT_PATH : undefined;
// Floor: never adopt a runtime snapshot with fewer than half the baked-in
// sessions (guards against a partial crawl emitting an near-empty snapshot).
const MIN_SESSIONS = Math.max(1, Math.floor(bundledData.sessions.length * 0.5));

let cached: Snapshot = bundledData;
let cachedMtimeMs = -1;
// undefined = not yet attempted, null = unavailable (non-node runtime) → give up.
let fsMod: typeof import("node:fs") | null | undefined;

/**
 * Lazily load + cache the runtime snapshot file when `SNAPSHOT_PATH` is set.
 * mtime-gated so a steady file costs only a `statSync` per call; the file is
 * re-parsed only when it actually changes. `node:fs` is required dynamically (not
 * statically imported) so this module stays importable on Worker/edge/bun, where
 * the require fails and we permanently fall back to the bundled snapshot.
 */
function refreshFromFile(): void {
  if (!SNAPSHOT_PATH) return;
  if (fsMod === undefined) {
    // `process.getBuiltinModule` (Node 22+) returns a core module without putting
    // `node:fs` in the static dependency graph, so this module stays importable on
    // Worker/edge/bun (where it's absent → we permanently fall back to bundled).
    const getBuiltin = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
      .process?.getBuiltinModule;
    fsMod = getBuiltin
      ? ((getBuiltin("node:fs") as typeof import("node:fs") | undefined) ?? null)
      : null;
  }
  if (!fsMod) return;

  try {
    const mtimeMs = fsMod.statSync(SNAPSHOT_PATH).mtimeMs;
    if (mtimeMs === cachedMtimeMs) return; // unchanged since last accepted load
    const parsed = SnapshotSchema.safeParse(JSON.parse(fsMod.readFileSync(SNAPSHOT_PATH, "utf8")));
    if (parsed.success && parsed.data.sessions.length >= MIN_SESSIONS) {
      cached = parsed.data;
      cachedMtimeMs = mtimeMs; // advance ONLY on an accepted load, so a rejected
      // file doesn't block retrying the next good one.
    }
  } catch {
    // Missing/locked/invalid file → keep the last-good (bundled or prior) data.
  }
}

/** Current snapshot: the freshest accepted runtime file, else the bundled one. */
function getData(): Snapshot {
  refreshFromFile();
  return cached;
}

export function getSnapshotMeta(): { generatedAt: number; counts: Record<string, number> } {
  const data = getData();
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
  return getData().sessions;
}

export function allVenues(): Venue[] {
  return getData().venues;
}

export function allPerks(): Perk[] {
  return getData().perks;
}

export function allDeadlines(): Deadline[] {
  return getData().deadlines;
}

export function getSessionById(id: string): Session | undefined {
  return getData().sessions.find((s) => s.id === id);
}

export function getDeadlineById(id: string): Deadline | undefined {
  return getData().deadlines.find((d) => d.id === id);
}

export function getVenueById(id: string | null | undefined): Venue | undefined {
  if (!id) return undefined;
  return getData().venues.find((v) => v.id === id);
}

/** Sessions sorted by start time (sessions without a start sort last). */
export function sessionsByStart(): Session[] {
  return [...getData().sessions].sort(
    (a, b) => (a.startsAt ?? Number.POSITIVE_INFINITY) - (b.startsAt ?? Number.POSITIVE_INFINITY),
  );
}

/** Sessions currently in progress at `now` (demo-clock aware). */
export function getNowSessions(now: number = getCurrentTime()): Session[] {
  return getData()
    .sessions.filter((s) => isNowWithin(s.startsAt ?? null, s.endsAt ?? null, now))
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
}

/**
 * The next sessions starting after `now`. Returns up to `limit` sessions sorted
 * by start time; sessions sharing the same start (parallel tracks) keep their
 * relative order, so a tie at the limit boundary may be truncated.
 */
export function getNextSessions(now: number = getCurrentTime(), limit = 5): Session[] {
  const upcoming = getData()
    .sessions.filter((s) => s.startsAt != null && s.startsAt > now)
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
  return upcoming.slice(0, limit);
}

/** Upcoming deadlines after `now`, soonest first. */
export function getUpcomingDeadlines(now: number = getCurrentTime()): Deadline[] {
  return getData()
    .deadlines.filter((d) => d.dueAt == null || d.dueAt >= now)
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
  return getData().sessions.filter((s) =>
    [s.title, s.partner, s.track, s.type, s.dayTheme]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(q)),
  );
}
