"use client";

import { usePushPermission } from "@/components/push/PushPermissionProvider";
import { useAddChecklistItem, useChecklist } from "@/hooks/useChecklist";
import { cn } from "@/lib/cn";
import { signIn, useSession } from "next-auth/react";
import { useState } from "react";
import { CheckIcon, PinIcon } from "../icons";

/**
 * Bookmark a session into "My Checklist". Adds a checklist item linked to the
 * session (targetType "session"). Reflects an already-saved state so the user
 * isn't confused, and prompts sign-in when signed out.
 */
export function BookmarkButton({
  sessionId,
  title,
  className,
}: {
  sessionId: string;
  title: string;
  className?: string;
}) {
  const { status } = useSession();
  const { data } = useChecklist();
  const add = useAddChecklistItem();
  const { requestPushPermission } = usePushPermission();
  const [justAdded, setJustAdded] = useState(false);

  const already =
    justAdded ||
    (data?.items ?? []).some((i) => i.targetType === "session" && i.targetId === sessionId);

  const onClick = () => {
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    if (already) return;
    add.mutate(
      { title, targetId: sessionId, targetType: "session" },
      {
        onSuccess: () => {
          setJustAdded(true);
          requestPushPermission("when it's time for sessions on your checklist");
        },
      },
    );
  };

  const label = already
    ? "Saved to checklist"
    : status !== "authenticated"
      ? "Sign in to save"
      : add.isPending
        ? "Saving…"
        : "Save to checklist";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={add.isPending}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition active:scale-[0.98]",
        already
          ? "border-accent/30 bg-accent/15 text-accent-text"
          : "border-line bg-surface text-foreground",
        className,
      )}
    >
      {already ? <CheckIcon className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
      {label}
    </button>
  );
}
