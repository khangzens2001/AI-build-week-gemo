"use client";

import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { BellIcon, ChatIcon, ClockIcon, GoogleIcon } from "../icons";
import { MascotBadge } from "../ui/MascotBadge";
import { Sheet } from "../ui/Sheet";

const DISMISS_KEY = "ec.onboarded.v1";

const POINTS = [
  {
    Icon: ClockIcon,
    title: "Now & next, always",
    body: "See what's happening this minute and what's coming up — with live countdowns.",
  },
  {
    Icon: ChatIcon,
    title: "Ask Cue",
    body: "Find workshops, perks, directions and deadlines. Every answer cites its source.",
  },
  {
    Icon: BellIcon,
    title: "Never miss a thing",
    body: "Set reminders for sessions and deadlines so the good stuff doesn't slip by.",
  },
];

/** First-run intro sheet. Dismissal persists in localStorage. */
export function Onboarding() {
  const [open, setOpen] = useState(false);
  const { status } = useSession();

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) {
        // Small delay so the app paints first.
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore storage errors (private mode etc.)
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onClose={dismiss}
      title={
        <div>
          <MascotBadge size={64} className="mb-3 rounded-2xl" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
            Welcome to
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight">Cue</h2>
          <p className="mt-1 text-sm text-muted">
            Your guide to Agentic AI Build Week — Jul 8–12, Ho Chi Minh City.
          </p>
        </div>
      }
      footer={
        <div className="space-y-2">
          {status !== "authenticated" && (
            <button
              type="button"
              onClick={() => {
                dismiss();
                signIn("google");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-[15px] font-bold text-accent-ink transition active:scale-[0.98]"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-2xl bg-surface-2 py-3 text-[15px] font-semibold text-muted ring-1 ring-line transition active:scale-[0.98]"
          >
            {status === "authenticated" ? "Let's go" : "Skip for now"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 py-2">
        {POINTS.map(({ Icon, title, body }) => (
          <div key={title} className="flex gap-3.5 rounded-2xl bg-surface-2 p-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-text">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{title}</p>
              <p className="mt-0.5 text-sm leading-snug text-muted">{body}</p>
            </div>
          </div>
        ))}
        <p className="px-1 pt-1 text-center text-xs text-faint">
          Signing in lets you save reminders. You can always do it later.
        </p>
      </div>
    </Sheet>
  );
}
