"use client";

import { cn } from "@/lib/cn";
import type { ScheduleSession, SessionType, Tone, VenueRef } from "@/lib/types";
import Image from "next/image";
import { useState } from "react";
import { PinIcon } from "../icons";
import { TypeBadge } from "../ui/TypeBadge";

const SESSION_FALLBACK_IMAGE = "/covers/session-fallback.png";

/** The minimum a card needs — both /api/now and /api/schedule rows satisfy it. */
export type SessionCardData = {
  id: string;
  title: string;
  startTimeLabel?: string | null;
  endTimeLabel?: string | null;
  partner?: string | null;
  type?: SessionType | null;
  tone?: Tone | null;
  venue?: VenueRef | null;
  coverImage?: string | null;
};

/**
 * Tappable session row. A left time-rail anchors it in the day; the body carries
 * title, partner and venue; a type badge keeps it scannable. `accent` lifts the
 * card for "happening now".
 */
export function SessionCard({
  session,
  onClick,
  accent,
  className,
}: {
  session: SessionCardData | ScheduleSession;
  onClick?: () => void;
  accent?: boolean;
  className?: string;
}) {
  const { title, partner, venue, type, tone, startTimeLabel, endTimeLabel } = session;
  const coverImage = session.coverImage ?? null;
  const [coverOk, setCoverOk] = useState(true);
  const imageSrc = coverImage && coverOk ? coverImage : SESSION_FALLBACK_IMAGE;

  const inner = (
    <>
      <span
        className={cn(
          "relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1",
          accent ? "ring-accent/40" : "ring-line",
        )}
      >
        <Image
          src={imageSrc}
          alt=""
          width={56}
          height={56}
          onError={() => coverImage && setCoverOk(false)}
          className="h-full w-full object-cover"
        />
      </span>

      {/* time rail */}
      <div className="flex w-12 shrink-0 flex-col items-start pt-0.5">
        <span
          className={cn("tnum text-sm font-bold", accent ? "text-accent-text" : "text-foreground")}
        >
          {startTimeLabel ?? "—"}
        </span>
        {endTimeLabel && <span className="tnum text-[11px] text-faint">{endTimeLabel}</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <TypeBadge type={type} tone={tone} />
          {partner && (
            <span className="truncate text-[11px] font-semibold text-muted">{partner}</span>
          )}
        </div>
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{title}</p>
        {venue && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-faint">
            <PinIcon className="h-3.5 w-3.5" />
            <span className="truncate">{venue.name}</span>
          </p>
        )}
      </div>
    </>
  );

  const base = cn(
    "flex w-full gap-3 rounded-2xl border p-3.5 text-left transition",
    accent
      ? "border-accent/30 bg-accent/[0.06] glow-accent"
      : "border-line bg-surface hover:border-line/80",
    onClick && "active:scale-[0.985]",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}
