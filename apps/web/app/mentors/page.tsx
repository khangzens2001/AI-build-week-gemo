"use client";

import { SearchIcon, UsersIcon } from "@/components/icons";
import { MentorCard } from "@/components/mentors/MentorCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useBookings, useMentors } from "@/hooks/useMentors";
import { useMemo, useState } from "react";

export default function MentorsPage() {
  const [query, setQuery] = useState("");
  const mentors = useMentors(query.trim() || undefined);
  const bookings = useBookings();

  const bookedSlotIds = useMemo(
    () => new Set((bookings.data?.bookings ?? []).map((b) => b.slotId)),
    [bookings.data],
  );

  const list = mentors.data?.mentors ?? [];
  const myBookings = bookings.data?.bookings ?? [];

  // Resolve a mentor name for each booking, for the "your bookings" strip.
  const mentorById = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);

  return (
    <div className="px-4">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          1:1 guidance
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Mentors</h1>
        <p className="mt-1 text-sm text-muted">
          Book office hours with experts across product, AI and go-to-market.
        </p>
      </header>

      {/* Your bookings */}
      {myBookings.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
            Your bookings
          </p>
          <div className="space-y-2">
            {myBookings.map((b) => {
              const m = mentorById.get(b.mentorId);
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] p-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/12 text-accent-text">
                    <UsersIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {m?.name ?? "Office hours booked"}
                    </p>
                    {b.topic && <p className="truncate text-xs text-muted">{b.topic}</p>}
                  </div>
                  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-text ring-1 ring-inset ring-accent/30">
                    Booked
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or expertise…"
          className="w-full rounded-2xl border border-line bg-surface-2 py-3 pl-11 pr-4 text-sm font-medium text-foreground placeholder:text-faint focus:border-accent/40 focus:outline-none"
        />
      </div>

      {/* List */}
      {mentors.isLoading ? (
        <SkeletonList count={3} />
      ) : mentors.isError ? (
        <ErrorState message="Couldn't load mentors." onRetry={() => mentors.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-6 w-6" />}
          title={query ? "No mentors match" : "No mentors yet"}
          description={
            query
              ? "Try a different name or area of expertise."
              : "Mentors and office hours will show up here once they're announced."
          }
        />
      ) : (
        <div className="stagger space-y-3.5">
          {list.map((m, i) => (
            <div key={m.id} style={{ ["--i" as string]: i }}>
              <MentorCard mentor={m} bookedSlotIds={bookedSlotIds} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
