/**
 * Demo clock (client). The event is in the future, so the UI runs on a demo
 * clock seeded from NEXT_PUBLIC_DEMO_NOW. We want it to *keep running* across
 * page refreshes (not reset to the frozen instant every load), so we anchor the
 * first-ever load: store {demo, real} once, then current demo time =
 * demoStart + (Date.now() - realStart).
 *
 * The server's own getCurrentTime() returns a FROZEN DEMO_NOW, so the client is
 * the source of truth for "now": data hooks forward `?now=clientNow()` to the
 * API routes (see lib/fetcher usage) so the server tracks this advancing clock.
 *
 * If NEXT_PUBLIC_DEMO_NOW is unset, this is just the real wall clock.
 */

const ANCHOR_KEY = "ec.democlock.anchor.v1";
/**
 * Upper bound for the advancing demo clock: end of Day 5 + 12h buffer (epoch ms,
 * GMT+7). Without this, a tab left open (or the persisted anchor) would race
 * arbitrarily far past the event, flipping the UI to "ended" while other panels
 * still read mid-event. Clamping keeps the demo coherent over long sessions.
 */
const DEMO_CLOCK_CEILING = Date.parse("2026-07-13T12:00:00+07:00");

interface Anchor {
  demo: number; // demo epoch ms at first load
  real: number; // real epoch ms at first load
}

function demoStartMs(): number | null {
  const d = process.env.NEXT_PUBLIC_DEMO_NOW;
  if (!d) return null;
  const ms = Date.parse(d);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Deterministic, SSR-safe seed. Returns the *un-advanced* demo start (or the
 * real clock when no demo is configured) WITHOUT touching localStorage — so the
 * server render and the client's first render agree (no hydration mismatch).
 * The running/anchored value comes from {@link clientNow} after mount.
 */
export function clockSeed(): number {
  return demoStartMs() ?? Date.now();
}

function loadAnchor(demo: number): Anchor {
  // SSR / no storage → ephemeral anchor pinned to this render's real time.
  if (typeof window === "undefined") return { demo, real: Date.now() };
  try {
    const raw = window.localStorage.getItem(ANCHOR_KEY);
    if (raw) {
      const a = JSON.parse(raw) as Anchor;
      // Re-anchor if the configured demo start changed (new DEMO_NOW value).
      if (a.demo === demo && typeof a.real === "number") return a;
    }
    const fresh: Anchor = { demo, real: Date.now() };
    window.localStorage.setItem(ANCHOR_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return { demo, real: Date.now() };
  }
}

/**
 * Current demo "now" in epoch ms — advances with real elapsed time and persists
 * its anchor across refreshes. Returns the real wall clock when no demo clock
 * is configured.
 */
export function clientNow(): number {
  const demo = demoStartMs();
  if (demo == null) return Date.now();
  const a = loadAnchor(demo);
  const advanced = a.demo + (Date.now() - a.real);
  // Clamp so a long-lived tab / persisted anchor can't drift past the event.
  return Math.min(advanced, DEMO_CLOCK_CEILING);
}
