"use client";

import { PulseIcon } from "@/components/icons";
import { type Announcement, PulseItem } from "@/components/pulse/PulseItem";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { fetchJson } from "@/lib/fetcher";
import { useQuery } from "@tanstack/react-query";

/**
 * Cue Pulse — a reverse-chronological feed of event announcements (schedule
 * shifts, venue moves, new perks, deadline alerts). Each item cites its source.
 */
export default function PulsePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => fetchJson<{ announcements: Announcement[] }>("/api/announcements?limit=50"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const items = data?.announcements ?? [];

  return (
    <div className="px-4">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          Live feed
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Cue Pulse</h1>
        <p className="mt-1 text-sm text-muted">
          Schedule shifts, venue moves and fresh perks — newest first.
        </p>
      </header>

      {isLoading ? (
        <SkeletonList count={4} />
      ) : isError ? (
        <ErrorState message="Couldn't load the feed." onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PulseIcon className="h-6 w-6" />}
          title="All quiet for now"
          description="Updates about the schedule, venues and perks will show up here as they happen."
        />
      ) : (
        <div className="stagger space-y-3">
          {items.map((item, i) => (
            <div key={item.id} style={{ ["--i" as string]: i }}>
              <PulseItem item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
