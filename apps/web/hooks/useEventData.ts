"use client";

import { fetchJson } from "@/lib/fetcher";
import { clientNow } from "@/lib/now";
import type { Deadline, NextSession, NowSession, Perk, ScheduleSession, Venue } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

/**
 * The client demo clock is the source of truth for "now". The server's
 * getCurrentTime() is frozen, so we forward `?now=` on time-sensitive reads and
 * the routes pass it into the core time-aware queries — keeping the server's
 * now/next/deadlines consistent with the client's advancing countdown.
 *
 * Bucketed to the minute so it doesn't bust the React Query cache every second.
 */
function nowParam(): number {
  return Math.floor(clientNow() / 60_000) * 60_000;
}

/** Sessions happening right now. Refetches every 60s to stay live. */
export function useNow() {
  const now = nowParam();
  return useQuery({
    queryKey: ["now", now],
    queryFn: () => fetchJson<{ sessions: NowSession[] }>(`/api/now?now=${now}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useNext(limit = 5) {
  const now = nowParam();
  return useQuery({
    queryKey: ["next", limit, now],
    queryFn: () => fetchJson<{ sessions: NextSession[] }>(`/api/next?limit=${limit}&now=${now}`),
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
  const now = nowParam();
  return useQuery({
    queryKey: ["deadlines", now],
    queryFn: () => fetchJson<{ deadlines: Deadline[] }>(`/api/deadlines?now=${now}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
