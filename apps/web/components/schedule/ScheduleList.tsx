"use client";

import { useSchedule } from "@/hooks/useEventData";
import { useNowTick } from "@/hooks/useNowTick";
import type { ScheduleSession } from "@/lib/types";
import { useMemo, useState } from "react";
import { CalendarIcon } from "../icons";
import { SessionCard } from "../session/SessionCard";
import { SessionDetailSheet } from "../session/SessionDetailSheet";
import { SkeletonList } from "../ui/Skeleton";
import { EmptyState } from "../ui/States";

const HCMC_TZ = "Asia/Ho_Chi_Minh";

/** Coarse part-of-day bucket so the list reads like a real agenda. */
function bucketOf(s: ScheduleSession): "Morning" | "Afternoon" | "Evening" | "Unscheduled" {
  if (s.startsAt == null) return "Unscheduled";
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: HCMC_TZ,
    }).format(new Date(s.startsAt)),
  );
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

const ORDER = ["Morning", "Afternoon", "Evening", "Unscheduled"] as const;

/** A day's sessions, sorted by start and grouped into morning/afternoon/evening. */
export function ScheduleList({ day }: { day: string }) {
  const { data, isLoading, isError, refetch } = useSchedule(day);
  const now = useNowTick(60_000);
  const [selected, setSelected] = useState<ScheduleSession | null>(null);

  const groups = useMemo(() => {
    const sessions = [...(data?.sessions ?? [])].sort(
      (a, b) => (a.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.startsAt ?? Number.MAX_SAFE_INTEGER),
    );
    const map = new Map<string, ScheduleSession[]>();
    for (const s of sessions) {
      const b = bucketOf(s);
      if (!map.has(b)) map.set(b, []);
      map.get(b)?.push(s);
    }
    return ORDER.filter((b) => map.has(b)).map((b) => ({ bucket: b, items: map.get(b) ?? [] }));
  }, [data]);

  if (isLoading) return <SkeletonList count={5} />;
  if (isError) {
    return (
      <EmptyState
        title="Couldn't load the schedule"
        action={
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-full bg-surface-2 px-4 py-1.5 text-sm font-semibold ring-1 ring-line"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<CalendarIcon className="h-6 w-6" />}
        title="No sessions listed"
        description="Nothing's scheduled for this day yet. Check the other days."
      />
    );
  }

  return (
    <>
      <div className="space-y-6">
        {groups.map(({ bucket, items }) => (
          <section key={bucket}>
            <div className="mb-2.5 flex items-center gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
                {bucket}
              </h3>
              <div className="h-px flex-1 bg-line-soft" />
              <span className="text-[11px] font-medium text-faint">{items.length}</span>
            </div>
            <div className="space-y-2.5">
              {items.map((s) => {
                const live =
                  s.startsAt != null && s.endsAt != null && now >= s.startsAt && now < s.endsAt;
                return (
                  <SessionCard
                    key={s.id}
                    session={s}
                    accent={live}
                    onClick={() => setSelected(s)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <SessionDetailSheet
        session={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
