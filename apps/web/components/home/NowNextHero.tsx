"use client";

import { useNext, useNow } from "@/hooks/useEventData";
import { useNowTick } from "@/hooks/useNowTick";
import { relativePhrase } from "@/lib/time";
import Link from "next/link";
import { ArrowRightIcon, PinIcon } from "../icons";
import { ClockIcon } from "../icons";
import { SessionCard } from "../session/SessionCard";
import { CountdownBadge } from "../ui/CountdownBadge";
import { CardSkeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/States";

/**
 * The home centrepiece. If something is live, it leads with a glowing "On now"
 * card. Otherwise it foregrounds the next session with a big live countdown.
 */
export function NowNextHero() {
  const now = useNow();
  const next = useNext(3);
  const tick = useNowTick(30_000);

  if (now.isLoading || next.isLoading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-44 rounded-3xl" />
        <CardSkeleton />
      </div>
    );
  }

  const live = now.data?.sessions ?? [];
  const upcoming = next.data?.sessions ?? [];
  const nextSession = upcoming[0];

  return (
    <div className="space-y-5">
      {/* HAPPENING NOW */}
      {live.length > 0 ? (
        <section aria-label="Happening now" className="stagger space-y-3">
          <div className="flex items-center gap-2" style={{ ["--i" as string]: 0 }}>
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full bg-live opacity-75"
                style={{ animation: "var(--animate-pulse-ring)" }}
              />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live" />
            </span>
            <h2 className="font-display text-base font-bold tracking-tight">Happening now</h2>
          </div>
          {live.map((s, i) => (
            <div key={s.id} style={{ ["--i" as string]: i + 1 }}>
              <SessionCard session={s} accent />
            </div>
          ))}
        </section>
      ) : (
        <section
          aria-label="Nothing live"
          className="card flex items-center gap-3 p-4"
          style={{ animation: "var(--animate-rise)" }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
            <ClockIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Nothing live right now</p>
            <p className="text-xs text-muted">Here's what's coming up next.</p>
          </div>
        </section>
      )}

      {/* NEXT UP */}
      {nextSession ? (
        <section
          aria-label="Next up"
          className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-surface-2 to-surface p-5"
          style={{ animation: "var(--animate-rise)" }}
        >
          {/* decorative corner glow */}
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl"
            style={{ background: "radial-gradient(circle, var(--color-accent), transparent 70%)" }}
            aria-hidden
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              Next up
            </p>
            {nextSession.startsAt && (
              <span className="text-xs font-medium text-muted">
                {relativePhrase(nextSession.startsAt, tick)}
              </span>
            )}
          </div>

          {nextSession.startsAt && (
            <div className="mt-2">
              <CountdownBadge target={nextSession.startsAt} variant="block" />
            </div>
          )}

          <p className="mt-3 text-lg font-bold leading-snug">{nextSession.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {nextSession.partner && (
              <span className="font-semibold text-foreground">{nextSession.partner}</span>
            )}
            <span className="tnum">
              {nextSession.startTimeLabel}
              {nextSession.endTimeLabel ? `–${nextSession.endTimeLabel}` : ""}
            </span>
            {nextSession.venue && (
              <span className="flex items-center gap-1">
                <PinIcon className="h-3.5 w-3.5" />
                {nextSession.venue.name}
              </span>
            )}
          </div>

          <Link
            href={`/chat?q=${encodeURIComponent("Where is the next session and how do I get there?")}`}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-accent py-2.5 text-sm font-bold text-accent-ink transition active:scale-[0.98]"
          >
            Get directions
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        live.length === 0 && (
          <EmptyState
            title="The schedule's wrapped"
            description="No more sessions on the clock. Check the full schedule for other days."
          />
        )
      )}
    </div>
  );
}
