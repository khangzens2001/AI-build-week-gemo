import type { ComponentType, SVGProps } from "react";
import {
  CalendarIcon,
  ClockIcon,
  PresentationIcon,
  RocketIcon,
  SparkIcon,
  UsersIcon,
} from "../components/icons";
import { cn } from "./cn";
import type { SessionType, Tone } from "./types";

/**
 * Deterministic, asset-free cover art for sessions that lack a real image (or
 * whose image 404s). Only 6 of ~29 sessions ship a `coverImage`, so without
 * this every other card fell back to one identical PNG and the agenda read as
 * broken. Here each session gets a unique gradient tile + glyph derived purely
 * from its data — never a network request, so it can't 404.
 *
 * Colour strategy:
 *   • Day drives the hue *family* (Day 1 "Enable" green → Day 5 "Demo" magenta),
 *     so a glance down the schedule shows each day as its own colour world.
 *   • Within a day, a hash of the id nudges the hue, the second stop and the
 *     gradient angle so sibling sessions still differ subtly.
 *   • No day info (e.g. the /api/now card) → hue comes straight from the id hash.
 *   • Breaks / admin stay desaturated and dark so they read calmer than the
 *     vibrant workshop / signature tiles.
 * The glyph is the session-type icon (a clock for breaks), tinted a light shade
 * of the same hue for crisp contrast at the 56px thumbnail size.
 */

/** The fields the fallback needs — both SessionCardData and ScheduleSession satisfy it. */
export type CoverSession = {
  id: string;
  type?: SessionType | null;
  tone?: Tone | null;
  partner?: string | null;
  dayNumber?: number | null;
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type SessionCoverFallbackStyle = {
  /** CSS `background` value (radial highlight layered over a linear gradient). */
  background: string;
  /** Glyph colour — a light tint of the tile hue, high-contrast on the dark fill. */
  glyphColor: string;
  /** Glyph to overlay. */
  Icon: IconComponent;
};

/** Each event day owns a well-separated hue family (see EVENT_DAYS in types.ts). */
const DAY_HUE: Record<number, number> = {
  1: 152, // Enable   → emerald
  2: 200, // Integrate → cyan-blue
  3: 276, // Design   → violet
  4: 30, // Build      → amber
  5: 330, // Demo      → magenta
};

/** Tiny FNV-1a hash → stable unsigned 32-bit int for deterministic per-id variation. */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickIcon(type?: SessionType | null, tone?: Tone | null): IconComponent {
  const key = tone === "signature" ? "signature" : (type ?? tone ?? "").toString().toLowerCase();
  switch (key) {
    case "workshop":
      return PresentationIcon;
    case "signature":
    case "keynote":
      return SparkIcon;
    case "networking":
      return UsersIcon;
    case "break":
      return ClockIcon; // clock motif keeps breaks instantly legible
    case "administrative":
      return CalendarIcon;
    default:
      return RocketIcon;
  }
}

/** Compute the deterministic gradient + glyph for a session's fallback tile. */
export function getSessionCoverFallback(session: CoverSession): SessionCoverFallbackStyle {
  const seed = hashString(session.id);
  const isCalm =
    session.type === "break" || session.type === "administrative" || session.tone === "break";

  const dayHue = session.dayNumber != null ? DAY_HUE[session.dayNumber] : undefined;
  const baseHue = dayHue ?? seed % 360;

  // Per-id nudge so sessions sharing a day's hue family still read distinctly.
  const variance = (seed % 31) - 15; // -15..15
  const hue = (baseHue + variance + 360) % 360;
  const hue2 = (hue + 34) % 360;
  const angle = 115 + (seed % 60); // 115..174°

  // Calm tiles (breaks/admin) sit darker and near-neutral; the rest stay rich.
  const sat = isCalm ? 16 : 58;
  const light1 = isCalm ? 17 : 23;
  const light2 = isCalm ? 11 : 13;

  const background = [
    `radial-gradient(125% 95% at 22% 14%, hsl(${hue} ${sat}% ${light1 + 12}% / 0.6), transparent 62%)`,
    `linear-gradient(${angle}deg, hsl(${hue} ${sat}% ${light1}%), hsl(${hue2} ${sat}% ${light2}%))`,
  ].join(", ");

  const glyphColor = isCalm ? `hsl(${hue} 14% 62%)` : `hsl(${hue} 72% 82%)`;

  return { background, glyphColor, Icon: pickIcon(session.type, session.tone) };
}

/**
 * Renders the fallback tile content (gradient + centred glyph). Fills its
 * parent, so the caller keeps ownership of size, rounding and ring. Used by both
 * the 56px SessionCard thumbnail and the large SessionDetailSheet hero.
 */
export function SessionCoverFallback({
  session,
  className,
  iconClassName,
}: {
  session: CoverSession;
  className?: string;
  iconClassName?: string;
}) {
  const { background, glyphColor, Icon } = getSessionCoverFallback(session);
  return (
    <div
      aria-hidden
      className={cn("flex h-full w-full items-center justify-center", className)}
      style={{ background }}
    >
      <Icon className={cn("opacity-90", iconClassName)} style={{ color: glyphColor }} />
    </div>
  );
}
