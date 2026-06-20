"use client";

import { useNowTick } from "@/hooks/useNowTick";
import { fetchJson } from "@/lib/fetcher";
import { clientNow } from "@/lib/now";
import { relativePhrase } from "@/lib/time";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRightIcon, ClockIcon, PinIcon, SparkIcon } from "../icons";
import { CitationLink } from "../ui/CitationLink";

type NudgeSuggestion = {
  sessionId: string;
  title: string;
  time: string;
  partner: string | null;
  venue: string | null;
  mapUrl: string | null;
  startsAt: number | null;
  reason: string;
  sourceUrl: string | null;
};

type NudgeResponse = {
  now: string;
  suggestions: NudgeSuggestion[];
  deadline: { title: string; dueAt: number | null; due: string } | null;
};

/**
 * Proactive nudge — POSTs /api/nudge (demo-clock aware on the server) and leads
 * with the single best "up next" suggestion, plus the nearest deadline. Bridges
 * to Chat for directions. Quiet when there's nothing ahead.
 */
export function NudgeCard() {
  const tick = useNowTick(60_000);
  const { data, isLoading } = useQuery({
    queryKey: ["nudge", tick],
    queryFn: () =>
      fetchJson<NudgeResponse>("/api/nudge", {
        method: "POST",
        // Send the advancing client demo clock so the server's suggestions stay
        // in lockstep with the countdown this card renders.
        body: JSON.stringify({ limit: 1, now: clientNow() }),
      }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="skeleton h-32 rounded-3xl" aria-hidden />;
  }

  const top = data?.suggestions?.[0];
  if (!top) return null;

  return (
    <section
      aria-label="Suggested next"
      className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-surface-2 to-surface p-5"
      style={{ animation: "var(--animate-rise)" }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl"
        style={{ background: "radial-gradient(circle, var(--color-accent), transparent 70%)" }}
        aria-hidden
      />

      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/12 text-accent-text">
          <SparkIcon className="h-4 w-4" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
          Suggested for you
        </p>
        {top.startsAt && (
          <span className="ml-auto text-xs font-medium text-muted">
            {relativePhrase(top.startsAt, tick)}
          </span>
        )}
      </div>

      <p className="mt-3 text-lg font-bold leading-snug">{top.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        {top.partner && <span className="font-semibold text-foreground">{top.partner}</span>}
        <span className="tnum flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          {top.time}
        </span>
        {top.venue && (
          <span className="flex items-center gap-1">
            <PinIcon className="h-3.5 w-3.5" />
            {top.venue}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs leading-snug text-faint">{top.reason}</p>

      <Link
        href={`/chat?q=${encodeURIComponent(`Where is "${top.title}" and how do I get there?`)}`}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-accent py-2.5 text-sm font-bold text-accent-ink transition active:scale-[0.98]"
      >
        Get directions
        <ArrowRightIcon className="h-4 w-4" />
      </Link>

      {(top.sourceUrl || data?.deadline?.dueAt) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {top.sourceUrl && <CitationLink url={top.sourceUrl} />}
          {data?.deadline && (
            <Link
              href="/perks#deadlines"
              className="inline-flex items-center gap-1 rounded-md bg-warn/12 px-2 py-0.5 text-[11px] font-semibold text-warn ring-1 ring-inset ring-warn/30 transition active:opacity-80"
            >
              <ClockIcon className="h-3 w-3" />
              {data.deadline.title} · {data.deadline.due}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
