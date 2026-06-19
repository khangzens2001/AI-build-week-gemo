"use client";

import { fetchJson } from "@/lib/fetcher";
import type { Reminder } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export type CreateReminderArgs = {
  targetId: string;
  targetKind?: "session" | "deadline";
  minutesBefore?: number;
};

/** List the signed-in user's reminders (skips the call when signed out). */
export function useReminders() {
  const { status } = useSession();
  return useQuery({
    queryKey: ["reminders"],
    queryFn: () => fetchJson<{ reminders: Reminder[] }>("/api/reminders"),
    enabled: status === "authenticated",
    staleTime: 30_000,
  });
}

/**
 * Create a reminder. Throws `{ status: 401 }` when signed out so callers can
 * prompt sign-in. On success the reminders list is refreshed.
 */
export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateReminderArgs) =>
      fetchJson<{ id: string; fireAt: number; label: string }>("/api/reminders", {
        method: "POST",
        body: JSON.stringify({
          targetId: args.targetId,
          targetKind: args.targetKind ?? "session",
          minutesBefore: args.minutesBefore ?? 15,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
  });
}
