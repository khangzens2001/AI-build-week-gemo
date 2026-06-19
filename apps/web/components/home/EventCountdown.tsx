"use client";

import { useNowTick } from "@/hooks/useNowTick";
import { EVENT_END_MS, EVENT_START_MS, currentEventDay } from "@/lib/time";
import { EVENT_DAYS } from "@/lib/types";
import { CountdownSegments } from "../ui/CountdownSegments";
import { MascotBadge } from "../ui/MascotBadge";

/**
 * Home centrepiece that flips on state:
 *  - Before kickoff → big countdown to Day 1 start.
 *  - During the event → "Live · Day N" with the day theme.
 *  - After Day 5 → a calm "that's a wrap" state (never a stuck "Live").
 * Driven by the demo clock so it agrees with the server.
 */
export function EventCountdown() {
  const now = useNowTick(1000);
  const started = now >= EVENT_START_MS;
  const ended = now > EVENT_END_MS;
  const today = currentEventDay(now);
  // EVENT_DAYS is a non-empty const tuple; index 0 is always present.
  const liveDay = today ?? EVENT_DAYS[EVENT_DAYS.length - 1] ?? EVENT_DAYS[0]!;

  return (
    <section
      aria-label={
        ended ? "Build Week has ended" : started ? "Event is live" : "Countdown to kickoff"
      }
      className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-surface-2 to-surface p-5"
      style={{ animation: "var(--animate-rise)" }}
    >
      {/* atmospheric brand glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--color-accent), transparent 70%)",
          animation: started || ended ? undefined : "var(--animate-glow-breathe)",
        }}
        aria-hidden
      />

      {ended ? (
        <div className="relative flex items-center gap-4">
          <MascotBadge size={56} className="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
              That's a wrap
            </p>
            <p className="mt-1.5 font-display text-2xl font-bold leading-none tracking-tight">
              Build Week complete
            </p>
            <p className="mt-1.5 text-sm text-muted">
              Thanks for building with us in Ho Chi Minh City.
            </p>
          </div>
        </div>
      ) : started ? (
        <div className="relative flex items-center gap-4">
          <MascotBadge size={56} className="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full bg-live opacity-75"
                  style={{ animation: "var(--animate-pulse-ring)" }}
                />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-live">
                Live now
              </span>
            </div>
            <p className="mt-1.5 font-display text-2xl font-bold leading-none tracking-tight">
              Day {liveDay.number} · <span className="text-accent-text">{liveDay.theme}</span>
            </p>
            <p className="mt-1.5 text-sm text-muted">
              Agentic AI Build Week is underway in Ho Chi Minh City.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* kicker row: label + mascot, with a hairline rule for structure */}
          <div className="flex items-center gap-2.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              style={{ animation: "var(--animate-glow-breathe)" }}
              aria-hidden
            />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-faint">
              Counting down to kickoff
            </p>
            <span className="h-px flex-1 bg-line" aria-hidden />
            <MascotBadge size={34} className="rounded-xl" />
          </div>

          {/* the centrepiece: four ticking unit cards */}
          <CountdownSegments target={EVENT_START_MS} now={now} className="mt-4" />

          {/* title + subline anchored beneath the count */}
          <h2 className="mt-5 text-center font-display text-[1.7rem] font-bold leading-[1.05] tracking-tight">
            Agentic AI <span className="text-accent-text">Build Week</span>
          </h2>
          <p className="mx-auto mt-2 max-w-[19rem] text-center text-[13px] leading-snug text-muted">
            Jul 8–12 · Ho Chi Minh City
            <span className="mt-0.5 block text-faint">
              Day 1 — <span className="text-foreground">Enable</span> opens the week
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
