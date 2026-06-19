"use client";

import { useDragScroll } from "@/hooks/useDragScroll";
import { useSchedule } from "@/hooks/useEventData";
import { useNowTick } from "@/hooks/useNowTick";
import { isoDateInTz } from "@/lib/time";
import type { ScheduleSession } from "@/lib/types";
import { EVENT_DAYS } from "@/lib/types";
import { useMemo, useState } from "react";
import { SessionCard } from "../session/SessionCard";
import { SessionDetailSheet } from "../session/SessionDetailSheet";
import { SectionHeader } from "../ui/SectionHeader";

/**
 * "Later today" — the rest of today's sessions in a horizontal peek. Falls back
 * to Day 1 when the demo clock sits outside the event window, so the home page
 * always has something tangible to show.
 */
export function TodayRail() {
  const now = useNowTick(60_000);
  const today = isoDateInTz(now);
  const dayKey = EVENT_DAYS.some((d) => d.day === today) ? today : EVENT_DAYS[0].day;

  const { data, isLoading } = useSchedule(dayKey);
  const [selected, setSelected] = useState<ScheduleSession | null>(null);
  const railRef = useDragScroll<HTMLDivElement>();

  const remaining = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const isToday = dayKey === today;
    const list = isToday ? sessions.filter((s) => (s.startsAt ?? 0) >= now) : sessions;
    return list.slice(0, 6);
  }, [data, dayKey, today, now]);

  if (isLoading) {
    return (
      <section>
        <SectionHeader title="Later today" href="/schedule" />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-28 w-64 shrink-0 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (remaining.length === 0) return null;

  const isToday = dayKey === today;

  return (
    <section>
      <SectionHeader title={isToday ? "Later today" : "Day 1 lineup"} href="/schedule" />
      <div
        ref={railRef}
        className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [touch-action:pan-x] [cursor:grab] active:[cursor:grabbing]"
      >
        {remaining.map((s) => (
          <div key={s.id} className="w-[78vw] max-w-[300px] shrink-0 snap-start">
            <SessionCard session={s} onClick={() => setSelected(s)} />
          </div>
        ))}
      </div>
      <SessionDetailSheet
        session={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
