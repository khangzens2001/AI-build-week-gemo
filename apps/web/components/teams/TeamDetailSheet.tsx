"use client";

import { useJoinTeam, useTeam } from "@/hooks/useTeams";
import { dateLabel } from "@/lib/time";
import { signIn, useSession } from "next-auth/react";
import { CheckIcon, UsersIcon } from "../icons";
import { Sheet } from "../ui/Sheet";
import { Skeleton } from "../ui/Skeleton";
import { BuildLogItem } from "./BuildLogItem";

/** Bottom-sheet detail for a team: members, its build log, and a Join button. */
export function TeamDetailSheet({
  teamId,
  open,
  onClose,
}: {
  teamId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { status } = useSession();
  const { data, isLoading } = useTeam(teamId);
  const join = useJoinTeam();

  const team = data?.team;
  const members = data?.members ?? [];
  const logs = data?.logs ?? [];

  const onJoin = () => {
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    if (teamId) join.mutate({ id: teamId });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        team ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
              Team Room
            </p>
            <h2 className="font-display text-xl font-bold tracking-tight">{team.name}</h2>
            {team.tagline && <p className="mt-1 text-sm text-muted">{team.tagline}</p>}
          </div>
        ) : (
          <h2 className="font-display text-xl font-bold tracking-tight">Team</h2>
        )
      }
      footer={
        <button
          type="button"
          onClick={onJoin}
          disabled={join.isPending || join.isSuccess}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-[15px] font-bold text-accent-ink transition active:scale-[0.98] disabled:opacity-60"
        >
          {join.isSuccess ? <CheckIcon className="h-4 w-4" /> : <UsersIcon className="h-4 w-4" />}
          {status !== "authenticated"
            ? "Sign in to join"
            : join.isSuccess
              ? "You're in"
              : join.isPending
                ? "Joining…"
                : "Join team"}
        </button>
      }
    >
      <div className="space-y-5 py-1">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            {/* Looking for */}
            {team && team.lookingFor.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Looking for
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {team.lookingFor.map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-accent-text ring-1 ring-inset ring-accent/20"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Members */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Members · {members.length}
              </p>
              <div className="space-y-2">
                {members.map((m) => {
                  const name = m.name ?? "Builder";
                  const initials = name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <div key={m.user_id} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-elevated text-[11px] font-bold text-accent-text ring-1 ring-line">
                        {m.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.image}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </span>
                      <p className="text-sm font-semibold">{name}</p>
                      {m.role && (
                        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint ring-1 ring-inset ring-line">
                          {m.role}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Build log */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Build log
              </p>
              {logs.length === 0 ? (
                <p className="text-sm text-faint">No updates yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {logs.map((log) => (
                    <BuildLogItem key={log.id} log={log} showTeam={false} />
                  ))}
                </div>
              )}
            </div>

            {team && (
              <p className="text-center text-xs text-faint">Formed {dateLabel(team.createdAt)}</p>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
