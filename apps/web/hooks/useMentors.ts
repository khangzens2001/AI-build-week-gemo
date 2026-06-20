"use client";

import { fetchJson } from "@/lib/fetcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export type MentorSlot = { id: string; startsAt: number; endsAt: number };

export type Mentor = {
  id: string;
  name: string;
  title: string | null;
  org: string | null;
  bio: string | null;
  avatarUrl: string | null;
  expertise: string[];
  slots: MentorSlot[];
  sourceUrl: string | null;
};

export type Booking = {
  id: string;
  mentorId: string;
  slotId: string;
  topic: string | null;
  createdAt: number;
};

/** List mentors (public), optionally filtered by an expertise/keyword query. */
export function useMentors(query?: string) {
  return useQuery({
    queryKey: ["mentors", query ?? ""],
    queryFn: () =>
      fetchJson<{ mentors: Mentor[] }>(
        `/api/mentors${query ? `?q=${encodeURIComponent(query)}` : ""}`,
      ),
    staleTime: 15_000,
  });
}

/** The signed-in user's office-hours bookings. */
export function useBookings() {
  const { status } = useSession();
  return useQuery({
    queryKey: ["bookings"],
    queryFn: () => fetchJson<{ bookings: Booking[] }>("/api/office-hours"),
    enabled: status === "authenticated",
    staleTime: 15_000,
  });
}

export type BookArgs = { mentorId: string; slotId: string; topic?: string | null };

/** Book a mentor slot. Throws `{ status: 401|409 }` so callers can react. */
export function useBookOfficeHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: BookArgs) =>
      fetchJson<{ id: string }>("/api/office-hours/book", {
        method: "POST",
        body: JSON.stringify(args),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["mentors"] });
    },
  });
}
