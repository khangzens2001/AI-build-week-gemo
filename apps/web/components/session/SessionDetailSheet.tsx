"use client";

import { dateLabel } from "@/lib/time";
import type { ScheduleSession } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChatIcon, ExternalIcon, PinIcon } from "../icons";
import { CountdownBadge } from "../ui/CountdownBadge";
import { Sheet } from "../ui/Sheet";
import { TypeBadge } from "../ui/TypeBadge";
import { BookmarkButton } from "./BookmarkButton";
import { RemindButton } from "./RemindButton";

const SESSION_FALLBACK_IMAGE = "/covers/session-fallback.png";

/**
 * Detail view for a session. The schedule API returns metadata (time, venue,
 * type, registration) but not the long description, so we surface everything we
 * have and offer a one-tap bridge to the copilot for the full story.
 */
export function SessionDetailSheet({
  session,
  open,
  onClose,
}: {
  session: ScheduleSession | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!session) return null;
  return <SessionDetailSheetInner session={session} open={open} onClose={onClose} />;
}

function SessionDetailSheetInner({
  session,
  open,
  onClose,
}: {
  session: ScheduleSession;
  open: boolean;
  onClose: () => void;
}) {
  const hasTime = session.startsAt != null;
  const [coverOk, setCoverOk] = useState(true);
  const imageSrc =
    session.coverImage && coverOk ? session.coverImage : SESSION_FALLBACK_IMAGE;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={session.type} tone={session.tone} />
            {session.partner && (
              <span className="text-[11px] font-semibold text-muted">{session.partner}</span>
            )}
            {session.dayNumber && (
              <span className="text-[11px] font-medium text-faint">
                Day {session.dayNumber} · {session.dayTheme}
              </span>
            )}
          </div>
          <h2 className="font-display text-xl font-bold leading-tight">{session.title}</h2>
        </div>
      }
      footer={
        <div className="space-y-2">
          <RemindButton targetId={session.id} disabled={!hasTime} />
          <BookmarkButton sessionId={session.id} title={session.title} />
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {/* Cover hero — real image when present, else the shared fallback image */}
        <div className="relative aspect-[16/11] w-full overflow-hidden rounded-2xl ring-1 ring-line">
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes="(max-width: 448px) 100vw, 448px"
            onError={() => session.coverImage && setCoverOk(false)}
            className="object-cover"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent"
            aria-hidden
          />
        </div>

        {/* Time + countdown */}
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">When</p>
            <p className="tnum mt-0.5 text-base font-bold">
              {session.startTimeLabel ?? "TBC"}
              {session.endTimeLabel ? ` – ${session.endTimeLabel}` : ""}
            </p>
            {session.startsAt && (
              <p className="mt-0.5 text-xs text-muted">{dateLabel(session.startsAt)}</p>
            )}
          </div>
          {hasTime && session.startsAt != null && <CountdownBadge target={session.startsAt} />}
        </div>

        {/* Venue */}
        {session.venue && (
          <a
            href={session.venue.mapUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl bg-surface-2 p-4 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12 text-accent-text">
                <PinIcon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Where
                </p>
                <p className="text-sm font-semibold">{session.venue.name}</p>
              </div>
            </div>
            {session.venue.mapUrl && <ExternalIcon className="h-4 w-4 text-faint" />}
          </a>
        )}

        {/* Cue bridge — fills the gap where descriptions live in RAG */}
        <Link
          href={`/chat?q=${encodeURIComponent(`Tell me about "${session.title}"`)}`}
          onClick={onClose}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12 text-accent-text">
            <ChatIcon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Ask Cue</p>
            <p className="truncate text-xs text-muted">Speakers, what to bring, and how to join</p>
          </div>
        </Link>

        {/* Registration */}
        {session.registrationUrl && (
          <a
            href={session.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-line py-3 text-sm font-semibold text-foreground transition active:scale-[0.98]"
          >
            <ExternalIcon className="h-4 w-4" />
            Register on Luma
          </a>
        )}
      </div>
    </Sheet>
  );
}
