"use client";

import { PulseIcon } from "@/components/icons";
import type { Announcement } from "@/components/pulse/PulseItem";
import { useNowTick } from "@/hooks/useNowTick";
import { cn } from "@/lib/cn";
import { fetchJson } from "@/lib/fetcher";
import { timeAgo } from "@/lib/time";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRightIcon } from "../icons";

/** Severity → dot colour, matching PulseItem's three-hue signal. */
const DOT: Record<string, string> = {
  urgent: "bg-warn",
  important: "bg-accent",
  info: "bg-faint",
};

/**
 * Home "Live updates" card — surfaces the latest 1–2 Pulse announcements and
 * links into the full /pulse feed. Quiet (renders nothing) when there's no news.
 */
export function PulseCard() {
  const tick = useNowTick(60_000);
  const { data } = useQuery({
    queryKey: ["announcements", "home"],
    queryFn: () => fetchJson<{ announcements: Announcement[] }>("/api/announcements?limit=2"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const items = data?.announcements ?? [];
  if (items.length === 0) return null;

  return (
    <Link
      href="/pulse"
      className="card block p-4 transition active:scale-[0.99]"
      style={{ animation: "var(--animate-rise)" }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/12 text-accent-text">
          <PulseIcon className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            Live updates
          </p>
          <p className="font-display text-sm font-bold leading-none">Cue Pulse</p>
        </div>
        <ArrowRightIcon className="ml-auto h-4 w-4 text-faint" />
      </div>

      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                DOT[item.severity ?? "info"] ?? DOT.info,
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.title}</p>
              <p className="line-clamp-1 text-xs text-muted">{item.body}</p>
            </div>
            <span className="tnum shrink-0 text-[11px] font-medium text-faint">
              {timeAgo(item.createdAt, tick)}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
