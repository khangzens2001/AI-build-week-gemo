"use client";

import { useNowTick } from "@/hooks/useNowTick";
import { HCMC_TZ } from "@/lib/time";

function greeting(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

/**
 * Pure greeting line, read from the demo clock. Event identity (Day / theme /
 * name) is owned by EventCountdown directly below, so the day isn't announced
 * twice on the page.
 */
export function GreetingHeader() {
  const now = useNowTick(60_000);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: HCMC_TZ,
    }).format(new Date(now)),
  );

  return (
    <header className="pt-1">
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">
        {greeting(hour)} <span aria-hidden>👋</span>
      </h1>
      <p className="mt-1 text-sm text-muted">Here's your live read on the day.</p>
    </header>
  );
}
