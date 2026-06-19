"use client";

import { useDragScroll } from "@/hooks/useDragScroll";
import { cn } from "@/lib/cn";
import Link from "next/link";

/** Quick prompts that deep-link into Chat with a prefilled, auto-sent question. */
const CHIPS: { label: string; q: string }[] = [
  { label: "What's on now?", q: "What's on right now?" },
  { label: "What's next?", q: "What's the next session and where is it?" },
  { label: "Show me perks", q: "What perks and credits can I claim?" },
  { label: "Find workshops", q: "Which workshops should I check out?" },
  { label: "Deadlines", q: "What deadlines are coming up?" },
];

export function QuickChips({ className }: { className?: string }) {
  const ref = useDragScroll<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        "no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 [touch-action:pan-x] [cursor:grab] active:[cursor:grabbing]",
        className,
      )}
    >
      {CHIPS.map((chip) => (
        <Link
          key={chip.label}
          href={`/chat?q=${encodeURIComponent(chip.q)}`}
          draggable={false}
          className="shrink-0 whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-foreground transition active:scale-95"
        >
          {chip.label}
        </Link>
      ))}
    </div>
  );
}
