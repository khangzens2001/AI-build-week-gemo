"use client";

import { fetchJson } from "@/lib/fetcher";
import type { Deadline, NextSession, NowSession, Perk, ScheduleSession, Venue } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

/**
 * Time-sensitive reads (now / next / deadlines) run on the server's real wall
 * clock, so the client no longer forwards a `?now=`. They refetch on an
 * interval to stay live.
 */

/** Sessions happening right now. Refetches every 60s to stay live. */
export function useNow() {
  return useQuery({
    queryKey: ["now"],
    queryFn: () => fetchJson<{ sessions: NowSession[] }>("/api/now"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useNext(limit = 5) {
  return useQuery({
    queryKey: ["next", limit],
    queryFn: () => fetchJson<{ sessions: NextSession[] }>(`/api/next?limit=${limit}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useSchedule(day?: string) {
  return useQuery({
    queryKey: ["schedule", day ?? "all"],
    queryFn: () =>
      fetchJson<{ day: string | null; sessions: ScheduleSession[] }>(
        day ? `/api/schedule?day=${day}` : "/api/schedule",
      ),
    staleTime: 5 * 60_000,
  });
}

export function useVenues() {
  return useQuery({
    queryKey: ["venues"],
    queryFn: () => fetchJson<{ venues: Venue[] }>("/api/venues"),
    staleTime: 30 * 60_000,
  });
}

export function usePerks() {
  return useQuery({
    queryKey: ["perks"],
    queryFn: () => fetchJson<{ perks: Perk[] }>("/api/perks"),
    staleTime: 10 * 60_000,
  });
}

export function useDeadlines() {
  return useQuery({
    queryKey: ["deadlines"],
    queryFn: () => fetchJson<{ deadlines: Deadline[] }>("/api/deadlines"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
