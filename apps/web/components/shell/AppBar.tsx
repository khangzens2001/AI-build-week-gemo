"use client";

import { cn } from "@/lib/cn";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { GoogleIcon } from "../icons";
import { MascotBadge } from "../ui/MascotBadge";

/** Top app bar: wordmark + account control. */
export function AppBar() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-40 pt-safe"
      style={{
        background:
          "linear-gradient(to bottom, color-mix(in oklab, var(--color-bg) 92%, transparent) 60%, transparent)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="mx-auto flex h-[var(--appbar-h)] max-w-md items-center justify-between px-4">
        <Wordmark />
        <AccountButton />
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <MascotBadge size={32} className="rounded-[10px]" />
      <div className="leading-none">
        <p className="font-display text-[15px] font-bold tracking-tight">Cue</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
          AABW · HCMC
        </p>
      </div>
    </div>
  );
}

function AccountButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (status === "loading") {
    return <div className="skeleton h-8 w-8 rounded-full" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-accent-ink transition active:scale-95"
      >
        <GoogleIcon className="h-3.5 w-3.5" />
        Sign in
      </button>
    );
  }

  const name = session.user.name ?? "You";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-line transition active:scale-95"
      >
        {session.user.image && imgOk ? (
          // Google avatar (lh3.googleusercontent.com) 403s when a referrer is
          // sent — suppress it, and fall back to initials if it still fails.
          <img
            src={session.user.image}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-elevated text-[11px] font-bold text-accent-text">
            {initials}
          </span>
        )}
      </button>
      {open && (
        <div
          className="card absolute right-0 top-10 w-52 origin-top-right p-1.5"
          style={{ animation: "fade-in 0.12s ease both" }}
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            {session.user.email && (
              <p className="truncate text-xs text-faint">{session.user.email}</p>
            )}
          </div>
          <div className="my-1 h-px bg-line-soft" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted",
              "transition hover:bg-surface-2 hover:text-foreground",
            )}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
