"use client";

import type { Team } from "@/hooks/useTeams";
import { useCreateTeam } from "@/hooks/useTeams";
import { cn } from "@/lib/cn";
import { signIn, useSession } from "next-auth/react";
import { useState } from "react";
import { PlusIcon, UsersIcon } from "../icons";
import { Sheet } from "../ui/Sheet";

/** A team card: name, tagline, and "looking for" role badges. Tappable. */
export function TeamCard({ team, onClick }: { team: Team; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card w-full p-4 text-left transition active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-text">
          <UsersIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold leading-tight">{team.name}</h3>
          {team.tagline && (
            <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted">{team.tagline}</p>
          )}
        </div>
      </div>
      {team.lookingFor.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Looking for
          </span>
          {team.lookingFor.map((role) => (
            <span
              key={role}
              className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-accent-text ring-1 ring-inset ring-accent/20"
            >
              {role}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/** The "Create team" bottom-sheet form. */
export function CreateTeamSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { status } = useSession();
  const create = useCreateTeam();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  const submit = () => {
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    const n = name.trim();
    if (!n) return;
    const roles = lookingFor
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    create.mutate(
      { name: n, tagline: tagline.trim() || undefined, lookingFor: roles },
      {
        onSuccess: () => {
          setName("");
          setTagline("");
          setLookingFor("");
          onClose();
        },
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
            Team Room
          </p>
          <h2 className="font-display text-xl font-bold tracking-tight">Create a team</h2>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || create.isPending}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-bold transition active:scale-[0.98]",
            "bg-accent text-accent-ink disabled:opacity-50",
          )}
        >
          <PlusIcon className="h-4 w-4" />
          {status !== "authenticated"
            ? "Sign in to create"
            : create.isPending
              ? "Creating…"
              : "Create team"}
        </button>
      }
    >
      <div className="space-y-3 py-1">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Team name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cue Crew"
            className="mt-1.5 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[15px] font-medium text-foreground placeholder:text-faint focus:border-accent/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Tagline (optional)
          </span>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="What are you building?"
            className="mt-1.5 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-foreground placeholder:text-faint focus:border-accent/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
            Looking for (comma-separated)
          </span>
          <input
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value)}
            placeholder="Frontend, Designer, ML"
            className="mt-1.5 w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-foreground placeholder:text-faint focus:border-accent/40 focus:outline-none"
          />
        </label>
      </div>
    </Sheet>
  );
}
