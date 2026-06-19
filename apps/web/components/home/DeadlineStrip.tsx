"use client";

import { useDeadlines } from "@/hooks/useEventData";
import { useNowTick } from "@/hooks/useNowTick";
import Link from "next/link";
import { ArrowRightIcon, ClockIcon } from "../icons";
import { CountdownBadge } from "../ui/CountdownBadge";

/**
 * Compact strip showing the single most-imminent dated deadline with a live
 * countdown. Quiet when there's nothing dated ahead. Links to the Perks tab
 * (which hosts the full deadlines list).
 */
export function DeadlineStrip() {
  const { data } = useDeadlines();
  const tick = useNowTick(60_000);

  const soonest = (data?.deadlines ?? [])
    .filter((d) => d.dueAt != null && d.dueAt > tick)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))[0];

  if (!soonest?.dueAt) return null;

  return (
    <Link
      href="/perks#deadlines"
      className="flex items-center gap-3 rounded-2xl border border-warn/25 bg-warn/[0.07] p-3.5 transition active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warn/12 text-warn">
        <ClockIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-warn/80">Don't miss</p>
        <p className="truncate text-sm font-semibold">{soonest.title}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <CountdownBadge target={soonest.dueAt} />
        <ArrowRightIcon className="h-4 w-4 text-faint" />
      </div>
    </Link>
  );
}
