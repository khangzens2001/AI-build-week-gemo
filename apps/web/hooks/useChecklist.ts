"use client";

import { fetchJson } from "@/lib/fetcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

/** A checklist item as returned by /api/checklist (camelCase). */
export type ChecklistItem = {
  id: string;
  title: string;
  notes: string | null;
  completed: boolean;
  targetId: string | null;
  targetType: "session" | "deadline" | "perk" | "submission" | "custom";
  fireAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type AddChecklistArgs = {
  title: string;
  notes?: string | null;
  targetId?: string | null;
  targetType?: ChecklistItem["targetType"];
  fireAt?: number | null;
};

/** List the signed-in user's checklist (skips the call when signed out). */
export function useChecklist() {
  const { status } = useSession();
  return useQuery({
    queryKey: ["checklist"],
    queryFn: () => fetchJson<{ items: ChecklistItem[] }>("/api/checklist"),
    enabled: status === "authenticated",
    staleTime: 15_000,
  });
}

/** Create a checklist item. Throws `{ status: 401 }` when signed out. */
export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: AddChecklistArgs) =>
      fetchJson<{ id: string }>("/api/checklist", {
        method: "POST",
        body: JSON.stringify(args),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist"] }),
  });
}

export type UpdateChecklistArgs = {
  id: string;
  title?: string;
  notes?: string | null;
  completed?: boolean;
  fireAt?: number | null;
};

/** Patch a checklist item (toggle complete, edit notes). */
export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateChecklistArgs) =>
      fetchJson<{ ok: true }>(`/api/checklist/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist"] }),
  });
}

/** Delete a checklist item. */
export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: true }>(`/api/checklist/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist"] }),
  });
}
