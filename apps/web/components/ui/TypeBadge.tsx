import { cn } from "@/lib/cn";
import type { SessionType, Tone } from "@/lib/types";

/**
 * Type/tone badge. Signature sessions glow with the brand accent; workshops get
 * a cool tint; breaks/admin stay quiet. Keeps the schedule scannable at a glance.
 */
type BadgeStyle = { label: string; className: string };

const DEFAULT_STYLE: BadgeStyle = {
  label: "Session",
  className: "bg-violet-400/12 text-violet-300 ring-violet-400/25",
};

const STYLES: Record<string, BadgeStyle> = {
  keynote: { label: "Keynote", className: "bg-accent/15 text-accent-text ring-accent/30" },
  signature: { label: "Signature", className: "bg-accent/15 text-accent-text ring-accent/30" },
  workshop: { label: "Workshop", className: "bg-sky-400/12 text-sky-300 ring-sky-400/25" },
  session: DEFAULT_STYLE,
  networking: {
    label: "Networking",
    className: "bg-fuchsia-400/12 text-fuchsia-300 ring-fuchsia-400/25",
  },
  break: { label: "Break", className: "bg-white/5 text-faint ring-line" },
  administrative: { label: "Admin", className: "bg-white/5 text-faint ring-line" },
};

export function TypeBadge({
  type,
  tone,
  className,
}: {
  type?: SessionType | null;
  tone?: Tone | null;
  className?: string;
}) {
  // Prefer the curated tone for "signature"; otherwise fall back to type.
  const key =
    tone === "signature" ? "signature" : (type ?? tone ?? "session").toString().toLowerCase();
  const style = STYLES[key] ?? DEFAULT_STYLE;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        style.className,
        className,
      )}
    >
      {style.label}
    </span>
  );
}
