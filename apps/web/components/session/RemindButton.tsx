"use client";

import { usePushPermission } from "@/components/push/PushPermissionProvider";
import { useCreateReminder } from "@/hooks/useReminders";
import { cn } from "@/lib/cn";
import { signIn, useSession } from "next-auth/react";
import { useState } from "react";
import { BellIcon, CheckIcon } from "../icons";

/**
 * "Remind me" action. Posts to /api/reminders; if the user is signed out we
 * prompt Google sign-in instead. Reflects success inline so the user gets
 * immediate feedback without leaving the sheet. On success we also nudge the
 * user to enable push notifications (no-op if already granted) so the reminder
 * can actually reach them.
 */
export function RemindButton({
  targetId,
  targetKind = "session",
  minutesBefore = 15,
  disabled,
  className,
}: {
  targetId: string;
  targetKind?: "session" | "deadline";
  minutesBefore?: number;
  disabled?: boolean;
  className?: string;
}) {
  const { status } = useSession();
  const create = useCreateReminder();
  const { requestPushPermission } = usePushPermission();
  const [done, setDone] = useState(false);

  const onClick = () => {
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    create.mutate(
      { targetId, targetKind, minutesBefore },
      {
        onSuccess: () => {
          setDone(true);
          requestPushPermission(`${minutesBefore} minutes before this ${targetKind} starts`);
        },
      },
    );
  };

  const label = done
    ? `Reminder set · ${minutesBefore} min before`
    : status !== "authenticated"
      ? "Sign in to set a reminder"
      : create.isPending
        ? "Setting reminder…"
        : `Remind me ${minutesBefore} min before`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || create.isPending || done}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-bold transition active:scale-[0.98]",
        done
          ? "bg-accent/15 text-accent-text ring-1 ring-accent/30"
          : "bg-accent text-accent-ink disabled:opacity-60",
        className,
      )}
    >
      {done ? <CheckIcon className="h-4 w-4" /> : <BellIcon className="h-4 w-4" />}
      {label}
    </button>
  );
}
