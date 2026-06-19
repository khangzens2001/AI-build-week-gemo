"use client";

import { cn } from "@/lib/cn";
import { EVENT_DAYS } from "@/lib/types";

/** Horizontal Day 1–5 switcher with theme labels. Sticky under the app bar. */
export function DayTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (day: string) => void;
}) {
  return (
    <div
      className="sticky z-30 -mx-4 px-4 pb-2"
      style={{ top: "calc(var(--appbar-h) + env(safe-area-inset-top))" }}
    >
      <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-2xl border border-line bg-surface/80 p-1.5 backdrop-blur">
        {EVENT_DAYS.map((d) => {
          const isActive = d.day === active;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => onChange(d.day)}
              aria-pressed={isActive}
              className={cn(
                "flex shrink-0 flex-col items-center rounded-xl px-3.5 py-1.5 transition",
                isActive ? "bg-accent text-accent-ink" : "text-muted hover:text-foreground",
              )}
            >
              <span className="text-[13px] font-bold leading-none">Day {d.number}</span>
              <span
                className={cn(
                  "mt-1 text-[10px] font-semibold uppercase tracking-wide leading-none",
                  isActive ? "text-accent-ink/70" : "text-faint",
                )}
              >
                {d.theme}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
