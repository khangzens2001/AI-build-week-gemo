"use client";

import { useNowTick } from "@/hooks/useNowTick";
import { cn } from "@/lib/cn";
import { clockString, countdownTo } from "@/lib/time";

/**
 * Live countdown to a target epoch ms. Two flavours:
 *  - "pill": compact monospace clock for cards (e.g. "in 24:18")
 *  - "block": large stat for the hero / deadline ("Next up in …")
 * Driven by the demo clock so it agrees with the server.
 */
export function CountdownBadge({
  target,
  variant = "pill",
  urgent,
  className,
  prefix = "in",
}: {
  target: number;
  variant?: "pill" | "block";
  /** When true (or auto when < 15 min away) renders in warm amber. */
  urgent?: boolean;
  className?: string;
  prefix?: string;
}) {
  const now = useNowTick(1000);
  const c = countdownTo(target, now);
  const auto = urgent ?? (!c.past && c.ms < 15 * 60_000);

  if (variant === "block") {
    const big =
      c.days >= 1
        ? `${c.days}d ${c.hours}h`
        : c.hours >= 1
          ? `${c.hours}h ${String(c.minutes).padStart(2, "0")}m`
          : clockString(c);
    return (
      <div className={cn("flex items-baseline gap-1.5", className)}>
        <span
          className={cn(
            "tnum text-3xl font-bold leading-none",
            // Red NEVER indicates time-state: urgent→amber, otherwise neutral.
            c.past ? "text-faint" : auto ? "text-warn" : "text-foreground",
          )}
        >
          {c.past ? "now" : big}
        </span>
        {!c.past && c.days < 1 && c.hours < 1 && (
          <span className="text-xs font-medium text-faint">min</span>
        )}
      </div>
    );
  }

  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        c.past
          ? "bg-white/5 text-faint ring-line"
          : auto
            ? "bg-warn/12 text-warn ring-warn/30"
            : "bg-white/5 text-foreground ring-line",
        className,
      )}
    >
      {c.past ? "live" : `${prefix} ${clockString(c)}`}
    </span>
  );
}
