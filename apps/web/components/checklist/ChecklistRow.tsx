"use client";

import { type ChecklistItem, useAddChecklistItem } from "@/hooks/useChecklist";
import { cn } from "@/lib/cn";
import { useState } from "react";
import { CheckIcon, TrashIcon } from "../icons";
import { Sheet } from "../ui/Sheet";

/**
 * The bottom-sheet form for adding a custom checklist task (title + optional
 * notes). Posts via useAddChecklistItem with targetType "custom".
 */
export function AddTaskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddChecklistItem();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setTitle("");
    setNotes("");
  };

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    add.mutate(
      { title: t, notes: notes.trim() || null, targetType: "custom" },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
            My Checklist
          </p>
          <h2 className="font-display text-xl font-bold tracking-tight">Add a task</h2>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || add.isPending}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-bold transition active:scale-[0.98]",
            "bg-accent text-accent-ink disabled:opacity-50",
          )}
        >
          <CheckIcon className="h-4 w-4" />
          {add.isPending ? "Adding…" : "Add task"}
        </button>
      }
    >
      <div className="space-y-3 py-1">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">Task</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Finish the demo video"
            className="mt-1.5 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[15px] font-medium text-foreground placeholder:text-faint focus:border-accent/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Notes (optional)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anything to remember…"
            className="mt-1.5 w-full resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm leading-snug text-foreground placeholder:text-faint focus:border-accent/40 focus:outline-none"
          />
        </label>
      </div>
    </Sheet>
  );
}

/** A single checklist row with a checkbox, title, notes preview and delete. */
export function ChecklistRow({
  item,
  metaLabel,
  onToggle,
  onDelete,
  pending,
}: {
  item: ChecklistItem;
  metaLabel?: string;
  onToggle: (item: ChecklistItem) => void;
  onDelete: (id: string) => void;
  pending?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 transition",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
        aria-pressed={item.completed}
        onClick={() => onToggle(item)}
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition active:scale-90",
          item.completed
            ? "border-accent bg-accent text-accent-ink"
            : "border-line bg-surface-2 text-transparent",
        )}
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </button>

      <div className="min-w-0 flex-1">
        {metaLabel && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
            {metaLabel}
          </p>
        )}
        <p
          className={cn(
            "text-[15px] font-semibold leading-snug",
            item.completed && "text-muted line-through opacity-50",
          )}
        >
          {item.title}
        </p>
        {item.notes && (
          <p
            className={cn(
              "mt-0.5 line-clamp-2 text-xs leading-snug text-muted",
              item.completed && "opacity-50",
            )}
          >
            {item.notes}
          </p>
        )}
      </div>

      <button
        type="button"
        aria-label="Delete task"
        onClick={() => onDelete(item.id)}
        className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition hover:text-warn active:scale-90"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
