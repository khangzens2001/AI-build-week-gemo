"use client";

import { useAddChecklistItem, useChecklist } from "@/hooks/useChecklist";
import { cn } from "@/lib/cn";
import { SUBMISSION_TEMPLATE } from "@/lib/submission";
import { signIn, useSession } from "next-auth/react";
import { CheckIcon, RocketIcon } from "../icons";

/**
 * Submission readiness — renders the SUBMISSION_TEMPLATE steps. Each step maps
 * onto a checklist item with targetType "submission". "Track submission steps"
 * seeds any missing ones; existing rows reflect their completed state live.
 */
export function SubmissionChecklist() {
  const { status } = useSession();
  const { data } = useChecklist();
  const add = useAddChecklistItem();

  const submissionItems = (data?.items ?? []).filter((i) => i.targetType === "submission");
  const tracked = submissionItems.length > 0;
  const doneCount = submissionItems.filter((i) => i.completed).length;

  const trackAll = () => {
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    const existingTitles = new Set(submissionItems.map((i) => i.title));
    for (const step of SUBMISSION_TEMPLATE) {
      if (!existingTitles.has(step.title)) {
        add.mutate({
          title: step.title,
          notes: step.notes,
          targetType: "submission",
        });
      }
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/12 text-accent-text">
          <RocketIcon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Submission readiness</h2>
          <p className="text-xs text-muted">Everything you need to cross the line.</p>
        </div>
        {tracked && (
          <span className="tnum ml-auto text-sm font-bold text-accent-text">
            {doneCount}/{submissionItems.length}
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {SUBMISSION_TEMPLATE.map((step) => {
          const match = submissionItems.find((i) => i.title === step.title);
          const completed = match?.completed ?? false;
          return (
            <div
              key={step.title}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
                  completed
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-surface-2 text-faint",
                )}
              >
                <CheckIcon className={cn("h-3.5 w-3.5", !completed && "opacity-30")} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[15px] font-semibold leading-snug",
                    completed && "text-muted line-through opacity-50",
                  )}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted">{step.notes}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!tracked && (
        <button
          type="button"
          onClick={trackAll}
          disabled={add.isPending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-bold text-accent-ink transition active:scale-[0.98] disabled:opacity-60"
        >
          <CheckIcon className="h-4 w-4" />
          {status !== "authenticated"
            ? "Sign in to track these"
            : add.isPending
              ? "Adding…"
              : "Track submission steps"}
        </button>
      )}
      {tracked && (
        <p className="mt-2.5 text-center text-xs text-faint">
          Tick these off in Schedule → My Checklist.
        </p>
      )}
    </section>
  );
}
