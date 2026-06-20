"use client";

import {
  type ChecklistItem,
  useChecklist,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
} from "@/hooks/useChecklist";
import { useSchedule } from "@/hooks/useEventData";
import { EVENT_DAYS, type ScheduleSession } from "@/lib/types";
import { signIn, useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { CheckIcon, PlusIcon } from "../icons";
import { SkeletonList } from "../ui/Skeleton";
import { EmptyState } from "../ui/States";
import { AddTaskSheet, ChecklistRow } from "./ChecklistRow";

const HCMC_TZ = "Asia/Ho_Chi_Minh";

type ChecklistItemWithMeta = ChecklistItem & {
  groupKey: string;
  sortAt: number;
  metaLabel?: string;
};

type ChecklistGroup = {
  key: string;
  label: string;
  theme: string;
  items: ChecklistItemWithMeta[];
};

function dayFromTimestamp(ts: number | null): string | null {
  if (ts == null) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: HCMC_TZ }).format(new Date(ts));
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sessionMeta(session: ScheduleSession): string {
  const day = EVENT_DAYS.find((d) => d.day === session.day);
  return [
    day ? `Day ${day.number}` : null,
    session.startTimeLabel,
    session.type ? titleCase(session.type.toString()) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * "My Checklist" — the builder's personal to-do across sessions, deadlines and
 * submission steps. Shows a completion progress bar, toggleable rows, and a
 * floating add button. Prompts sign-in when signed out.
 */
export function ChecklistView() {
  const { status } = useSession();
  const { data, isLoading } = useChecklist();
  const { data: scheduleData } = useSchedule();
  const update = useUpdateChecklistItem();
  const del = useDeleteChecklistItem();
  const [adding, setAdding] = useState(false);

  const sessionById = useMemo(() => {
    return new Map((scheduleData?.sessions ?? []).map((session) => [session.id, session]));
  }, [scheduleData]);

  const groups = useMemo(() => {
    const list: ChecklistItemWithMeta[] = (data?.items ?? []).map((item) => {
      const session = item.targetId ? sessionById.get(item.targetId) : undefined;
      const day = session?.day ?? dayFromTimestamp(item.fireAt);
      const groupKey = day && EVENT_DAYS.some((eventDay) => eventDay.day === day) ? day : "other";
      const metaLabel = session
        ? sessionMeta(session)
        : item.targetType === "custom"
          ? "Custom"
          : titleCase(item.targetType);

      return {
        ...item,
        groupKey,
        sortAt: session?.startsAt ?? item.fireAt ?? item.createdAt,
        metaLabel,
      };
    });

    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.sortAt - b.sortAt;
    });

    const byGroup = new Map<string, ChecklistItemWithMeta[]>();
    for (const item of list) {
      const items = byGroup.get(item.groupKey) ?? [];
      items.push(item);
      byGroup.set(item.groupKey, items);
    }

    const orderedGroups: ChecklistGroup[] = EVENT_DAYS.map((day) => ({
      key: day.day,
      label: `Day ${day.number}`,
      theme: day.theme,
      items: byGroup.get(day.day) ?? [],
    })).filter((group) => group.items.length > 0);

    const other = byGroup.get("other") ?? [];
    if (other.length > 0) {
      orderedGroups.push({ key: "other", label: "Other", theme: "Personal tasks", items: other });
    }

    return orderedGroups;
  }, [data, sessionById]);

  if (status !== "authenticated") {
    return (
      <EmptyState
        icon={<CheckIcon className="h-6 w-6" />}
        title="Sign in to build your checklist"
        description="Save sessions, track submission steps and tick things off as you go."
        action={
          <button
            type="button"
            onClick={() => signIn("google")}
            className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-ink transition active:scale-95"
          >
            Sign in
          </button>
        }
      />
    );
  }

  if (isLoading) return <SkeletonList count={3} />;

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const done = groups.reduce(
    (sum, group) => sum + group.items.filter((item) => item.completed).length,
    0,
  );
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const onToggle = (item: ChecklistItem) =>
    update.mutate({ id: item.id, completed: !item.completed });
  const onDelete = (id: string) => del.mutate(id);

  return (
    <div className="space-y-4">
      {/* Progress */}
      {total > 0 && (
        <div className="card p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              Progress
            </p>
            <p className="tnum text-sm font-bold">
              {done}
              <span className="text-faint">/{total}</span>{" "}
              <span className="text-accent-text">· {pct}%</span>
            </p>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      {total === 0 ? (
        <EmptyState
          icon={<CheckIcon className="h-6 w-6" />}
          title="Nothing here yet"
          description="Bookmark sessions from the agenda, or add your own task below."
        />
      ) : (
        <div className="space-y-2.5">
          {groups.map((group) => {
            const open = group.items.filter((item) => !item.completed).length;
            return (
              <section key={group.key} className="space-y-2.5">
                <div className="flex items-center gap-2 px-0.5 pt-1">
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
                      {group.label}
                    </h3>
                    <p className="text-xs font-medium text-muted">{group.theme}</p>
                  </div>
                  <div className="h-px flex-1 bg-line-soft" />
                  <span className="tnum rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-faint ring-1 ring-line">
                    {open}/{group.items.length} open
                  </span>
                </div>
                {group.items.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    metaLabel={item.metaLabel}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    pending={
                      (update.isPending && update.variables?.id === item.id) ||
                      (del.isPending && del.variables === item.id)
                    }
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {/* Floating add button */}
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="fixed bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1rem)] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-bold text-accent-ink shadow-lg shadow-black/40 glow-accent transition active:scale-95"
      >
        <PlusIcon className="h-5 w-5" />
        Add task
      </button>

      <AddTaskSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
