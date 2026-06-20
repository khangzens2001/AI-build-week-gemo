"use client";

import { useNowTick } from "@/hooks/useNowTick";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { CitationLink } from "../ui/CitationLink";

export type Announcement = {
  id: string;
  kind: "schedule" | "venue" | "perk" | "deadline" | "general" | (string & {});
  title: string;
  body: string;
  severity: "info" | "important" | "urgent" | null;
  targetId: string | null;
  sourceUrl: string | null;
  createdAt: number;
};

/**
 * Severity drives the colour signal — never crossing the app's three-hue rule:
 *  urgent → warm amber, important → brand vermillion text, info → quiet faint.
 */
const SEVERITY: Record<string, { label: string; dot: string; chip: string }> = {
  urgent: {
    label: "Urgent",
    dot: "bg-warn",
    chip: "bg-warn/12 text-warn ring-warn/30",
  },
  important: {
    label: "Important",
    dot: "bg-accent",
    chip: "bg-accent/15 text-accent-text ring-accent/30",
  },
  info: {
    label: "Update",
    dot: "bg-faint",
    chip: "bg-white/5 text-faint ring-line",
  },
};

const SEVERITY_FALLBACK = SEVERITY.info as { label: string; dot: string; chip: string };

const KIND_LABEL: Record<string, string> = {
  schedule: "Schedule",
  venue: "Venue",
  perk: "Perk",
  deadline: "Deadline",
  general: "News",
};

export function PulseItem({ item }: { item: Announcement }) {
  const tick = useNowTick(60_000);
  const sev = SEVERITY[item.severity ?? "info"] ?? SEVERITY_FALLBACK;
  const kind = KIND_LABEL[item.kind] ?? "News";

  return (
    <article className="card relative overflow-hidden p-4">
      {/* left severity rail */}
      <span className={cn("absolute inset-y-0 left-0 w-1", sev.dot)} aria-hidden />
      <div className="flex items-center gap-2 pl-1">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
            sev.chip,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", sev.dot)} aria-hidden />
          {sev.label}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">{kind}</span>
        <span className="ml-auto tnum text-[11px] font-medium text-faint">
          {timeAgo(item.createdAt, tick)}
        </span>
      </div>

      <h3 className="mt-2.5 pl-1 font-display text-[15px] font-bold leading-snug">{item.title}</h3>
      <p className="mt-1 pl-1 text-sm leading-snug text-muted">{item.body}</p>

      {item.sourceUrl && (
        <div className="mt-3 pl-1">
          <CitationLink url={item.sourceUrl} />
        </div>
      )}
    </article>
  );
}
