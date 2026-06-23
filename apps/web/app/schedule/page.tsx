"use client";

import { ChecklistView } from "@/components/checklist/ChecklistView";
import { DayTabs } from "@/components/schedule/DayTabs";
import { ScheduleList } from "@/components/schedule/ScheduleList";
import { Segmented } from "@/components/ui/Segmented";
import { EVENT_DAYS } from "@/lib/types";
import { useState } from "react";

const HCMC_TZ = "Asia/Ho_Chi_Minh";

/** Default to the current event day if we're inside the window, else Day 1. */
function defaultDay(): string {
  // Date.now() keeps the initial state SSR-stable (no localStorage / anchoring).
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: HCMC_TZ }).format(new Date());
  return EVENT_DAYS.some((d) => d.day === today) ? today : EVENT_DAYS[0].day;
}

type View = "agenda" | "checklist";

export default function SchedulePage() {
  const [day, setDay] = useState<string>(defaultDay);
  const [view, setView] = useState<View>("agenda");

  return (
    <div className="px-4">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">Agenda</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Schedule</h1>
      </div>

      <Segmented<View>
        options={[
          { value: "agenda", label: "Full Agenda" },
          { value: "checklist", label: "My Checklist" },
        ]}
        value={view}
        onChange={setView}
        className="mb-1"
      />

      {view === "agenda" ? (
        <>
          <DayTabs active={day} onChange={setDay} />
          <div className="pt-2">
            <ScheduleList day={day} />
          </div>
        </>
      ) : (
        <div className="pt-4">
          <ChecklistView />
        </div>
      )}
    </div>
  );
}
