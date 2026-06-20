"use client";

import type { Team } from "@/hooks/useTeams";
import { usePostBuildLog } from "@/hooks/useTeams";
import { cn } from "@/lib/cn";
import { signIn, useSession } from "next-auth/react";
import { useState } from "react";
import { SendIcon } from "../icons";

/**
 * Build-log composer. The team picker lists the teams the user can post to
 * (passed in). When signed out it prompts sign-in; with no teams it nudges the
 * user to create or join one first.
 */
export function BuildLogComposer({ teams }: { teams: Team[] }) {
  const { status } = useSession();
  const post = usePostBuildLog();
  const [teamId, setTeamId] = useState<string>("");
  const [body, setBody] = useState("");

  const effectiveTeamId = teamId || teams[0]?.id || "";

  const submit = () => {
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    const text = body.trim();
    if (!text || !effectiveTeamId) return;
    post.mutate({ teamId: effectiveTeamId, body: text }, { onSuccess: () => setBody("") });
  };

  if (status === "authenticated" && teams.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-4 text-center">
        <p className="text-sm font-semibold">Join a team to post updates</p>
        <p className="mt-1 text-xs text-muted">
          Create a team above or join one below, then share your progress here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      {teams.length > 1 && (
        <select
          value={effectiveTeamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="mb-2.5 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-foreground focus:border-accent/40 focus:outline-none"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder={
          status !== "authenticated" ? "Sign in to post an update…" : "Share what you just shipped…"
        }
        className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm leading-snug text-foreground placeholder:text-faint focus:border-accent/40 focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={post.isPending || (status === "authenticated" && !body.trim())}
        className={cn(
          "mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition active:scale-[0.98]",
          "bg-accent text-accent-ink disabled:opacity-50",
        )}
      >
        <SendIcon className="h-4 w-4" />
        {status !== "authenticated"
          ? "Sign in to post"
          : post.isPending
            ? "Posting…"
            : "Post update"}
      </button>
    </div>
  );
}
