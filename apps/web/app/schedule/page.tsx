"use client";

import { DayTabs } from "@/components/schedule/DayTabs";
import { ScheduleList } from "@/components/schedule/ScheduleList";
import { clockSeed } from "@/lib/now";
import { EVENT_DAYS } from "@/lib/types";
import { useState } from "react";

const HCMC_TZ = "Asia/Ho_Chi_Minh";

/** Default to the current event day if we're inside the window, else Day 1. */
function defaultDay(): string {
  // clockSeed (not the anchored clientNow) so the initial state is SSR-stable.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: HCMC_TZ }).format(
    new Date(clockSeed()),
  );
  return EVENT_DAYS.some((d) => d.day === today) ? today : EVENT_DAYS[0].day;
}

export default function SchedulePage() {
  const [day, setDay] = useState<string>(defaultDay);

  return (
    <div className="px-4">
      <div className="mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">Agenda</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Schedule</h1>
      </div>
      <DayTabs active={day} onChange={setDay} />
      <div className="pt-2">
        <ScheduleList day={day} />
      </div>
    </div>
  );
}
