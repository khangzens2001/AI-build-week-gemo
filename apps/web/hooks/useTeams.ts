"use client";

import { fetchJson } from "@/lib/fetcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type Team = {
  id: string;
  name: string;
  tagline: string | null;
  lookingFor: string[];
  createdBy: string;
  createdAt: number;
};

export type TeamMember = {
  user_id: string;
  role: string | null;
  joined_at: number;
  name: string | null;
  image: string | null;
};

export type BuildLog = {
  id: string;
  team_id: string;
  user_id?: string;
  body: string;
  created_at: number;
  author_name: string | null;
  team_name: string | null;
};

export type TeamDetail = {
  team: Team;
  members: TeamMember[];
  logs: BuildLog[];
};

/** Public list of all teams, newest first. */
export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchJson<{ teams: Team[] }>("/api/teams"),
    staleTime: 15_000,
  });
}

/** Public detail for one team (team, members, logs). */
export function useTeam(id: string | null) {
  return useQuery({
    queryKey: ["team", id],
    queryFn: () => fetchJson<TeamDetail>(`/api/teams/${id}`),
    enabled: id != null,
    staleTime: 10_000,
  });
}

export type CreateTeamArgs = { name: string; tagline?: string; lookingFor?: string[] };

/** Create a team (auth). Founder is added as the first member server-side. */
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateTeamArgs) =>
      fetchJson<{ id: string }>("/api/teams", {
        method: "POST",
        body: JSON.stringify(args),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

/** Join a team (auth). Idempotent server-side. */
export function useJoinTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role?: string }) =>
      fetchJson<{ ok: true }>(`/api/teams/${id}/join`, {
        method: "POST",
        body: JSON.stringify({ role }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["team", vars.id] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

/** Public build-log feed, newest first. Optionally scoped to one team. */
export function useBuildLog(teamId?: string) {
  return useQuery({
    queryKey: ["build-log", teamId ?? "all"],
    queryFn: () =>
      fetchJson<{ logs: BuildLog[] }>(
        `/api/build-log${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`,
      ),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Post a build-log update (auth). */
export function usePostBuildLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, body }: { teamId: string; body: string }) =>
      fetchJson<{ id: string }>("/api/build-log", {
        method: "POST",
        body: JSON.stringify({ teamId, body }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["build-log"] });
      qc.invalidateQueries({ queryKey: ["team", vars.teamId] });
    },
  });
}
