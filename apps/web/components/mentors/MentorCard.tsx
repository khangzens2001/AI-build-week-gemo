"use client";

import { usePushPermission } from "@/components/push/PushPermissionProvider";
import type { Mentor, MentorSlot } from "@/hooks/useMentors";
import { useBookOfficeHours } from "@/hooks/useMentors";
import { cn } from "@/lib/cn";
import { dateLabel, timeLabel } from "@/lib/time";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { CheckIcon, ClockIcon } from "../icons";
import { CitationLink } from "../ui/CitationLink";
import { Sheet } from "../ui/Sheet";

/** Compact "Wed · 14:00–14:30" label for a slot. */
function slotLabel(slot: MentorSlot): string {
  return `${dateLabel(slot.startsAt).split(",")[0]} · ${timeLabel(slot.startsAt)}–${timeLabel(slot.endsAt)}`;
}

/**
 * A mentor card: identity, expertise badges, bio, and tappable free slots. A
 * slot opens a booking sheet (optional topic). Handles 401 (sign-in) and 409
 * (slot already taken → the hook refetches mentors so it disappears).
 */
export function MentorCard({
  mentor,
  bookedSlotIds,
}: {
  mentor: Mentor;
  bookedSlotIds: Set<string>;
}) {
  const book = useBookOfficeHours();
  const { requestPushPermission } = usePushPermission();
  const [active, setActive] = useState<MentorSlot | null>(null);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  const initials = mentor.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const confirm = () => {
    if (!active) return;
    setError(null);
    book.mutate(
      { mentorId: mentor.id, slotId: active.id, topic: topic.trim() || null },
      {
        onSuccess: () => {
          setActive(null);
          setTopic("");
          requestPushPermission("before your office-hours slot");
        },
        onError: (e) => {
          const status = (e as Error & { status?: number }).status;
          if (status === 401) {
            signIn("google");
          } else if (status === 409) {
            setError("That slot was just booked. Pick another.");
          } else {
            setError("Couldn't book that slot. Try again.");
          }
        },
      },
    );
  };

  return (
    <article className="card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-elevated text-sm font-bold text-accent-text ring-1 ring-line">
          {mentor.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mentor.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold leading-tight">{mentor.name}</h3>
          {(mentor.title || mentor.org) && (
            <p className="mt-0.5 truncate text-xs text-muted">
              {[mentor.title, mentor.org].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {mentor.sourceUrl && <CitationLink url={mentor.sourceUrl} />}
      </div>

      {mentor.expertise.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {mentor.expertise.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-inset ring-line"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {mentor.bio && <p className="mt-3 text-sm leading-snug text-muted">{mentor.bio}</p>}

      {/* Slots */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Office hours</p>
        {mentor.slots.length === 0 ? (
          <p className="mt-1.5 text-xs text-faint">No open slots right now.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {mentor.slots.map((slot) => {
              const booked = bookedSlotIds.has(slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={booked}
                  onClick={() => {
                    setError(null);
                    setActive(slot);
                  }}
                  className={cn(
                    "tnum inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-95",
                    booked
                      ? "bg-accent/15 text-accent-text ring-1 ring-inset ring-accent/30"
                      : "bg-surface-2 text-foreground ring-1 ring-inset ring-line hover:ring-accent/30",
                  )}
                >
                  {booked ? <CheckIcon className="h-3 w-3" /> : <ClockIcon className="h-3 w-3" />}
                  {slotLabel(slot)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking sheet */}
      <Sheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
              Book office hours
            </p>
            <h2 className="font-display text-xl font-bold tracking-tight">{mentor.name}</h2>
            {active && <p className="tnum mt-1 text-sm text-muted">{slotLabel(active)}</p>}
          </div>
        }
        footer={
          <button
            type="button"
            onClick={confirm}
            disabled={book.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-[15px] font-bold text-accent-ink transition active:scale-[0.98] disabled:opacity-60"
          >
            <CheckIcon className="h-4 w-4" />
            {book.isPending ? "Booking…" : "Confirm booking"}
          </button>
        }
      >
        <div className="space-y-3 py-1">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              What do you want to cover? (optional)
            </span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder="e.g. Feedback on our RAG architecture"
              className="mt-1.5 w-full resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm leading-snug text-foreground placeholder:text-faint focus:border-accent/40 focus:outline-none"
            />
          </label>
          {error && (
            <p className="rounded-xl bg-warn/12 px-3 py-2 text-xs font-medium text-warn ring-1 ring-inset ring-warn/30">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </article>
  );
}
