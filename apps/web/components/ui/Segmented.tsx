"use client";

import { cn } from "@/lib/cn";

/**
 * A glassmorphic segmented toggle. Active segment fills with the brand accent.
 * Generic over a small set of string options.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "flex gap-1 rounded-2xl border border-line bg-surface/80 p-1 backdrop-blur",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition",
              active ? "bg-accent text-accent-ink" : "text-muted hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
