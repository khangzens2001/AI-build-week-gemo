"use client";

import { useNowTick } from "@/hooks/useNowTick";
import type { BuildLog } from "@/hooks/useTeams";
import { timeAgo } from "@/lib/time";

/** A single build-log entry: author, team, body and relative time. */
export function BuildLogItem({ log, showTeam = true }: { log: BuildLog; showTeam?: boolean }) {
  const tick = useNowTick(60_000);
  const author = log.author_name ?? "A builder";
  const initials = author
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <article className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated text-[11px] font-bold text-accent-text ring-1 ring-line">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{author}</p>
          {showTeam && log.team_name && (
            <p className="truncate text-[11px] text-faint">{log.team_name}</p>
          )}
        </div>
        <span className="tnum shrink-0 text-[11px] font-medium text-faint">
          {timeAgo(log.created_at, tick)}
        </span>
      </div>
      <p className="mt-2.5 whitespace-pre-wrap text-sm leading-snug text-muted">{log.body}</p>
    </article>
  );
}
