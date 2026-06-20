"use client";

import { PlusIcon, UsersIcon } from "@/components/icons";
import { BuildLogComposer } from "@/components/teams/BuildLogComposer";
import { BuildLogItem } from "@/components/teams/BuildLogItem";
import { CreateTeamSheet, TeamCard } from "@/components/teams/TeamCard";
import { TeamDetailSheet } from "@/components/teams/TeamDetailSheet";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useBuildLog, useTeams } from "@/hooks/useTeams";
import { useState } from "react";

type View = "teams" | "feed";

export default function TeamsPage() {
  const teams = useTeams();
  const feed = useBuildLog();
  const [view, setView] = useState<View>("teams");
  const [creating, setCreating] = useState(false);
  const [openTeam, setOpenTeam] = useState<string | null>(null);

  const teamList = teams.data?.teams ?? [];
  const logs = feed.data?.logs ?? [];

  return (
    <div className="px-4">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          Build together
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Teams</h1>
        <p className="mt-1 text-sm text-muted">
          Find teammates and follow what everyone's shipping.
        </p>
      </header>

      <Segmented<View>
        options={[
          { value: "teams", label: "Teams" },
          { value: "feed", label: "Build Log" },
        ]}
        value={view}
        onChange={setView}
        className="mb-5"
      />

      {view === "teams" ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <SectionHeader title="All teams" kicker="Open to join" />
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[13px] font-bold text-accent-ink transition active:scale-95"
            >
              <PlusIcon className="h-4 w-4" />
              Create
            </button>
          </div>

          {teams.isLoading ? (
            <SkeletonList count={3} />
          ) : teams.isError ? (
            <ErrorState message="Couldn't load teams." onRetry={() => teams.refetch()} />
          ) : teamList.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="h-6 w-6" />}
              title="No teams yet"
              description="Be the first — create a team and start recruiting."
            />
          ) : (
            <div className="stagger space-y-3">
              {teamList.map((team, i) => (
                <div key={team.id} style={{ ["--i" as string]: i }}>
                  <TeamCard team={team} onClick={() => setOpenTeam(team.id)} />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <BuildLogComposer teams={teamList} />

          {feed.isLoading ? (
            <SkeletonList count={4} />
          ) : feed.isError ? (
            <ErrorState message="Couldn't load the build log." onRetry={() => feed.refetch()} />
          ) : logs.length === 0 ? (
            <EmptyState
              title="No updates yet"
              description="When teams post progress, it'll stream in here."
            />
          ) : (
            <div className="space-y-2.5">
              {logs.map((log) => (
                <BuildLogItem key={log.id} log={log} />
              ))}
            </div>
          )}
        </section>
      )}

      <CreateTeamSheet open={creating} onClose={() => setCreating(false)} />
      <TeamDetailSheet
        teamId={openTeam}
        open={openTeam !== null}
        onClose={() => setOpenTeam(null)}
      />
    </div>
  );
}
