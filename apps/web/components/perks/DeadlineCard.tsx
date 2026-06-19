"use client";

import { dateLabel, timeLabel } from "@/lib/time";
import type { Deadline } from "@/lib/types";
import { ArrowRightIcon, ClockIcon } from "../icons";
import { CitationLink } from "../ui/CitationLink";
import { CountdownBadge } from "../ui/CountdownBadge";

/**
 * A deadline row. Dated deadlines lead with a live countdown; open-ended ones
 * (e.g. registration) show an "open" pill. Always links out + cites its source.
 */
export function DeadlineCard({ deadline }: { deadline: Deadline }) {
  const dated = deadline.dueAt != null;

  return (
    <article className="card flex items-center gap-3.5 p-4">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          dated ? "bg-warn/12 text-warn" : "bg-surface-2 text-faint"
        }`}
      >
        <ClockIcon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {dated && deadline.dueAt != null ? (
            <CountdownBadge target={deadline.dueAt} />
          ) : (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-faint ring-1 ring-inset ring-line">
              open
            </span>
          )}
          {deadline.type && (
            <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
              {deadline.type}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-semibold">{deadline.title}</p>
        {dated && deadline.dueAt != null && (
          <p className="tnum mt-0.5 text-xs text-muted">
            {dateLabel(deadline.dueAt)} · {timeLabel(deadline.dueAt)}
          </p>
        )}
        {deadline.sourceUrl && (
          <div className="mt-1.5">
            <CitationLink url={deadline.sourceUrl} />
          </div>
        )}
      </div>

      {deadline.link && (
        <a
          href={deadline.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${deadline.title}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted transition active:scale-90"
        >
          <ArrowRightIcon className="h-4 w-4" />
        </a>
      )}
    </article>
  );
}
