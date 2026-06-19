"use client";

/**
 * Renders a chat tool invocation (message part of type `tool-*`) as a compact,
 * branded card. While the tool runs we show a labelled loading chip; once
 * output arrives we render a result view per tool. Source links are surfaced as
 * citations wherever the tool provides them (the agent must never fabricate).
 */

import { useCreateReminder } from "@/hooks/useReminders";
import { cn } from "@/lib/cn";
import { signIn, useSession } from "next-auth/react";
import { useState } from "react";
import {
  BellIcon,
  CheckIcon,
  ClockIcon,
  ExternalIcon,
  GiftIcon,
  PinIcon,
  SparkIcon,
} from "../icons";
import { CitationLink } from "../ui/CitationLink";

type ToolPart = {
  type: string;
  state?: "input-streaming" | "input-available" | "output-available" | "output-error";
  output?: unknown;
  errorText?: string;
};

// Loose shapes for tool outputs (kept permissive — they come over the wire).
type ToolSession = {
  id?: string;
  title?: string;
  time?: string | null;
  partner?: string | null;
  type?: string | null;
  venue?: { name?: string; mapUrl?: string | null } | null;
  registrationUrl?: string | null;
  sourceUrl?: string | null;
};

const TOOL_LABELS: Record<string, string> = {
  getNow: "Checking what's on now",
  getNext: "Finding what's next",
  findWorkshops: "Searching sessions",
  getSchedule: "Loading the schedule",
  getDirections: "Getting directions",
  listPerks: "Looking up perks",
  getDeadlines: "Checking deadlines",
  searchKnowledge: "Searching the knowledge base",
  setReminder: "Preparing a reminder",
};

export function ToolCard({ part }: { part: ToolPart }) {
  const name = part.type.replace(/^tool-/, "");
  const running = part.state === "input-streaming" || part.state === "input-available";

  if (running) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/12 text-accent-text">
          <SparkIcon className="h-4 w-4" style={{ animation: "var(--animate-blink)" }} />
        </span>
        <span className="text-[13px] font-medium text-muted">
          {TOOL_LABELS[name] ?? "Working"}…
        </span>
      </div>
    );
  }

  if (part.state === "output-error") {
    return (
      <div className="rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-[13px] text-faint">
        Couldn't complete that lookup.
      </div>
    );
  }

  if (part.state !== "output-available") return null;
  const out = part.output as Record<string, unknown>;

  switch (name) {
    case "getNow":
    case "getNext":
    case "findWorkshops":
    case "getSchedule":
      return <SessionsResult sessions={(out?.sessions as ToolSession[]) ?? []} />;
    case "getDirections":
      return <DirectionsResult out={out} />;
    case "listPerks":
      return <PerksResult perks={(out?.perks as PerkOut[]) ?? []} />;
    case "getDeadlines":
      return <DeadlinesResult deadlines={(out?.deadlines as DeadlineOut[]) ?? []} />;
    case "searchKnowledge":
      return <KnowledgeResult chunks={(out?.chunks as ChunkOut[]) ?? []} />;
    case "setReminder":
      return <ReminderResult out={out} />;
    default:
      return null;
  }
}

/* ---- result renderers --------------------------------------------------- */

function ResultShell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line-soft px-3.5 py-2">
        <span className="text-accent-text">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          {title}
        </span>
      </div>
      <div className="p-2.5">{children}</div>
    </div>
  );
}

function SessionsResult({ sessions }: { sessions: ToolSession[] }) {
  if (sessions.length === 0) {
    return (
      <ResultShell icon={<ClockIcon className="h-4 w-4" />} title="Sessions">
        <p className="px-1 py-1 text-[13px] text-muted">Nothing matched right now.</p>
      </ResultShell>
    );
  }
  return (
    <ResultShell icon={<ClockIcon className="h-4 w-4" />} title="Sessions">
      <div className="space-y-1.5">
        {sessions.slice(0, 6).map((s, i) => (
          <div key={s.id ?? i} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              {s.time && (
                <span className="tnum text-[12px] font-bold text-accent-text">{s.time}</span>
              )}
              {s.partner && (
                <span className="truncate text-[11px] font-semibold text-muted">{s.partner}</span>
              )}
            </div>
            <p className="mt-0.5 text-[14px] font-semibold leading-snug">{s.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {s.venue?.name && (
                <span className="flex items-center gap-1 text-[12px] text-faint">
                  <PinIcon className="h-3.5 w-3.5" />
                  {s.venue.mapUrl ? (
                    <a
                      href={s.venue.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {s.venue.name}
                    </a>
                  ) : (
                    s.venue.name
                  )}
                </span>
              )}
              {s.registrationUrl && (
                <a
                  href={s.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-[12px] font-semibold text-accent-text"
                >
                  Register <ExternalIcon className="h-3 w-3" />
                </a>
              )}
              {s.sourceUrl && <CitationLink url={s.sourceUrl} />}
            </div>
          </div>
        ))}
      </div>
    </ResultShell>
  );
}

function DirectionsResult({ out }: { out: Record<string, unknown> }) {
  const found = out?.found as boolean;
  const venue = out?.venue as
    | { name?: string; address?: string; city?: string; mapUrl?: string | null }
    | undefined;
  if (!found || !venue) {
    return (
      <ResultShell icon={<PinIcon className="h-4 w-4" />} title="Directions">
        <p className="px-1 py-1 text-[13px] text-muted">No venue found for that.</p>
      </ResultShell>
    );
  }
  return (
    <ResultShell icon={<PinIcon className="h-4 w-4" />} title="Directions">
      <div className="rounded-xl bg-surface-2 p-3">
        <p className="text-[14px] font-semibold">{venue.name}</p>
        {(venue.address || venue.city) && (
          <p className="mt-0.5 text-[12px] text-faint">
            {[venue.address, venue.city].filter(Boolean).join(", ")}
          </p>
        )}
        {venue.mapUrl && (
          <a
            href={venue.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent py-2 text-[13px] font-bold text-accent-ink"
          >
            <PinIcon className="h-4 w-4" />
            Open in Google Maps
          </a>
        )}
      </div>
    </ResultShell>
  );
}

type PerkOut = {
  title?: string;
  provider?: string | null;
  value?: string | null;
  howToClaim?: string | null;
  eligibility?: string | null;
  link?: string | null;
  sourceUrl?: string | null;
};

function PerksResult({ perks }: { perks: PerkOut[] }) {
  if (perks.length === 0) {
    return (
      <ResultShell icon={<GiftIcon className="h-4 w-4" />} title="Perks">
        <p className="px-1 py-1 text-[13px] text-muted">No perks found.</p>
      </ResultShell>
    );
  }
  return (
    <ResultShell icon={<GiftIcon className="h-4 w-4" />} title="Perks">
      <div className="space-y-1.5">
        {perks.map((p, i) => (
          <div key={p.title ?? i} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              {p.provider && (
                <span className="text-[11px] font-bold uppercase tracking-wide text-accent-text">
                  {p.provider}
                </span>
              )}
              {p.sourceUrl && <CitationLink url={p.sourceUrl} />}
            </div>
            <p className="mt-1 text-[14px] font-semibold leading-snug">{p.title}</p>
            {p.value && <p className="mt-0.5 text-[13px] font-bold text-accent-text">{p.value}</p>}
            {p.howToClaim && <p className="mt-1 text-[12px] text-muted">{p.howToClaim}</p>}
            {p.link && (
              <a
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 flex items-center gap-0.5 text-[12px] font-semibold text-accent-text"
              >
                Claim / learn more <ExternalIcon className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </ResultShell>
  );
}

type DeadlineOut = {
  title?: string;
  type?: string | null;
  due?: string | null;
  dueAt?: number | null;
  link?: string | null;
  sourceUrl?: string | null;
};

function DeadlinesResult({ deadlines }: { deadlines: DeadlineOut[] }) {
  if (deadlines.length === 0) {
    return (
      <ResultShell icon={<ClockIcon className="h-4 w-4" />} title="Deadlines">
        <p className="px-1 py-1 text-[13px] text-muted">Nothing due right now.</p>
      </ResultShell>
    );
  }
  return (
    <ResultShell icon={<ClockIcon className="h-4 w-4" />} title="Deadlines">
      <div className="space-y-1.5">
        {deadlines.map((d, i) => (
          <div key={d.title ?? i} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warn/12 text-warn">
              <ClockIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{d.title}</p>
              <p className="text-[12px] text-faint">
                {d.type ? `${d.type} · ` : ""}
                {d.due ?? "open"}
              </p>
            </div>
            {d.link && (
              <a
                href={d.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open deadline"
                className="text-faint"
              >
                <ExternalIcon className="h-4 w-4" />
              </a>
            )}
          </div>
        ))}
      </div>
    </ResultShell>
  );
}

type ChunkOut = { text?: string; type?: string; sourceUrl?: string | null };

function KnowledgeResult({ chunks }: { chunks: ChunkOut[] }) {
  if (chunks.length === 0) return null;
  // Only surface sources here — the model weaves the text into its prose answer.
  const sources = Array.from(
    new Set(chunks.map((c) => c.sourceUrl).filter((u): u is string => Boolean(u))),
  ).slice(0, 4);
  if (sources.length === 0) return null;
  return (
    <ResultShell icon={<SparkIcon className="h-4 w-4" />} title="Sources">
      <div className="flex flex-wrap gap-1.5 px-0.5 py-0.5">
        {sources.map((u) => (
          <CitationLink key={u} url={u} />
        ))}
      </div>
    </ResultShell>
  );
}

type ReminderOut = {
  intent?: {
    targetId?: string;
    targetKind?: "session" | "deadline";
    minutesBefore?: number;
    label?: string;
  };
  confirmable?: boolean;
  message?: string;
};

function ReminderResult({ out }: { out: Record<string, unknown> }) {
  const data = out as ReminderOut;
  const { status } = useSession();
  const create = useCreateReminder();
  const [done, setDone] = useState(false);
  const intent = data.intent;

  if (!data.confirmable || !intent?.targetId) {
    return (
      <ResultShell icon={<BellIcon className="h-4 w-4" />} title="Reminder">
        <p className="px-1 py-1 text-[13px] text-muted">
          {data.message ?? "This item has no scheduled time to remind on."}
        </p>
      </ResultShell>
    );
  }

  const onConfirm = () => {
    if (status !== "authenticated") {
      signIn("google");
      return;
    }
    create.mutate(
      {
        targetId: intent.targetId as string,
        targetKind: intent.targetKind ?? "session",
        minutesBefore: intent.minutesBefore ?? 15,
      },
      { onSuccess: () => setDone(true) },
    );
  };

  return (
    <ResultShell icon={<BellIcon className="h-4 w-4" />} title="Reminder">
      <div className="rounded-xl bg-surface-2 p-3">
        <p className="text-[14px] font-semibold">{intent.label ?? "Reminder"}</p>
        {data.message && <p className="mt-0.5 text-[12px] text-muted">{data.message}</p>}
        <button
          type="button"
          onClick={onConfirm}
          disabled={create.isPending || done}
          className={cn(
            "mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-bold transition active:scale-[0.98]",
            done
              ? "bg-accent/15 text-accent-text ring-1 ring-accent/30"
              : "bg-accent text-accent-ink disabled:opacity-60",
          )}
        >
          {done ? <CheckIcon className="h-4 w-4" /> : <BellIcon className="h-4 w-4" />}
          {done
            ? "Reminder set"
            : status !== "authenticated"
              ? "Sign in to set reminder"
              : create.isPending
                ? "Setting…"
                : "Set reminder"}
        </button>
      </div>
    </ResultShell>
  );
}
