"use client";

import { SparkIcon } from "../icons";

const SUGGESTIONS = [
  "What's happening right now?",
  "Which workshops are on Day 1?",
  "What perks can I claim as a builder?",
  "When is the hackathon submission due?",
  "Where is the BytePlus session?",
];

/** Friendly empty-state for an unstarted chat, with tappable starter prompts. */
export function ChatEmpty({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center px-2 pt-6 text-center">
      <span className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 rounded-2xl bg-accent/15" />
        <span className="absolute inset-0 rounded-2xl ring-1 ring-accent/30" />
        <SparkIcon className="relative h-7 w-7 text-accent-text" />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold tracking-tight">Ask your copilot</h2>
      <p className="mt-1.5 max-w-[30ch] text-sm text-muted">
        Sessions, perks, directions, deadlines — answered live, with sources.
      </p>

      <div className="mt-6 w-full space-y-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left text-[14px] font-medium text-foreground transition active:scale-[0.98]"
          >
            <SparkIcon className="h-4 w-4 shrink-0 text-accent-text" />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
