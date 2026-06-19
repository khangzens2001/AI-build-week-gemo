"use client";

import { cn } from "@/lib/cn";
import { countdownTo } from "@/lib/time";
import { Fragment } from "react";

/**
 * The pre-event centrepiece countdown: four flip-clock style unit cards —
 * DAYS : HRS : MIN : SEC — with big tabular-mono numerals and small labels.
 * Pure presentational; the ticking `now` is passed in so it stays in lockstep
 * with the demo clock that drives the rest of the home page.
 *
 * Three-hue discipline: numerals stay neutral (foreground white) so the count
 * reads as brand/neutral — not "live" (cyan) and not "urgent" (amber). The only
 * red is the brand-tinted separators (accent-text, AA-safe colored text). The
 * eye is drawn to the seconds by *motion*, not colour: it re-pops each tick.
 */
const UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hrs" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Sec" },
] as const;

export function CountdownSegments({
  target,
  now,
  className,
}: {
  target: number;
  now: number;
  className?: string;
}) {
  const c = countdownTo(target, now);
  const values: Record<(typeof UNITS)[number]["key"], number> = {
    days: c.days,
    hours: c.hours,
    minutes: c.minutes,
    seconds: c.seconds,
  };
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className={cn("flex items-start justify-center gap-1", className)}
      // The whole strip is one announceable value; the per-card text is hidden.
      role="timer"
      aria-label={`Kickoff in ${c.days} days, ${c.hours} hours, ${c.minutes} minutes`}
    >
      {UNITS.map((u, i) => {
        const isSeconds = u.key === "seconds";
        return (
          <Fragment key={u.key}>
            {i > 0 && (
              <span
                aria-hidden
                className="flex shrink-0 items-center pt-[0.9rem] font-display text-[1.5rem] font-bold leading-none text-accent-text/35 sm:pt-[1.1rem]"
              >
                :
              </span>
            )}
            <div
              aria-hidden
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-elevated/85 to-surface-2/70 px-1 pt-3 pb-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              style={{
                animation: "var(--animate-rise)",
                animationDelay: `${120 + i * 70}ms`,
              }}
            >
              {/* soft brand wash at the top of each card for warmth */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-6 h-10 opacity-50 blur-xl"
                style={{
                  background:
                    "radial-gradient(60% 100% at 50% 100%, rgba(233,48,28,0.35), transparent 70%)",
                }}
              />
              <span className="relative flex h-9 w-full items-center justify-center sm:h-11">
                {/* flip-clock hairline through the numeral's mid-line */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-bg/60"
                />
                <span
                  // Re-mount the seconds digit each tick so the pop animation replays.
                  key={isSeconds ? c.seconds : undefined}
                  className="tnum text-[1.9rem] font-bold leading-none text-foreground tabular-nums sm:text-[2.3rem]"
                  style={isSeconds ? { animation: "var(--animate-digit-pop)" } : undefined}
                  // Real-clock "now" differs between SSR and first hydration by a
                  // few seconds; the post-mount tick corrects it. Expected diff.
                  suppressHydrationWarning
                >
                  {pad(values[u.key])}
                </span>
              </span>
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-faint">
                {u.label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
