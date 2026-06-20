"use client";

import {
  type ChecklistItem,
  useChecklist,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
} from "@/hooks/useChecklist";
import { signIn, useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { CheckIcon, PlusIcon } from "../icons";
import { SkeletonList } from "../ui/Skeleton";
import { EmptyState } from "../ui/States";
import { AddTaskSheet, ChecklistRow } from "./ChecklistRow";

/**
 * "My Checklist" — the builder's personal to-do across sessions, deadlines and
 * submission steps. Shows a completion progress bar, toggleable rows, and a
 * floating add button. Prompts sign-in when signed out.
 */
export function ChecklistView() {
  const { status } = useSession();
  const { data, isLoading } = useChecklist();
  const update = useUpdateChecklistItem();
  const del = useDeleteChecklistItem();
  const [adding, setAdding] = useState(false);

  const items = useMemo(() => {
    const list = [...(data?.items ?? [])];
    // Incomplete first, then by created time.
    return list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.createdAt - b.createdAt;
    });
  }, [data]);

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

  const total = items.length;
  const done = items.filter((i) => i.completed).length;
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
          {items.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              onToggle={onToggle}
              onDelete={onDelete}
              pending={
                (update.isPending && update.variables?.id === item.id) ||
                (del.isPending && del.variables === item.id)
              }
            />
          ))}
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
