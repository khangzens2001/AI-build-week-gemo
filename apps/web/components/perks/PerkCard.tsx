"use client";

import type { Perk } from "@/lib/types";
import { ExternalIcon } from "../icons";
import { CitationLink } from "../ui/CitationLink";

/**
 * A perk card. The value is the headline — builders scan for "what do I get" —
 * with how-to-claim and eligibility below, then a claim CTA and source citation.
 */
export function PerkCard({ perk }: { perk: Perk }) {
  return (
    <article className="card relative overflow-hidden p-4">
      {/* faint provider glow */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.12] blur-2xl"
        style={{ background: "radial-gradient(circle, var(--color-accent), transparent 70%)" }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2">
        {perk.provider && (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-text ring-1 ring-inset ring-accent/20">
            {perk.provider}
          </span>
        )}
        {perk.sourceUrl && <CitationLink url={perk.sourceUrl} />}
      </div>

      <h3 className="mt-3 font-display text-base font-bold leading-tight">{perk.title}</h3>

      {perk.value && (
        <p className="mt-2 text-lg font-bold leading-tight text-accent-text">{perk.value}</p>
      )}

      <div className="mt-3 space-y-2.5">
        {perk.howToClaim && <Row label="How to claim" value={perk.howToClaim} />}
        {perk.eligibility && <Row label="Who's eligible" value={perk.eligibility} />}
      </div>

      {perk.link && (
        <a
          href={perk.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-accent py-2.5 text-sm font-bold text-accent-ink transition active:scale-[0.98]"
        >
          <ExternalIcon className="h-4 w-4" />
          Claim / Learn more
        </a>
      )}
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-0.5 text-sm leading-snug text-muted">{value}</p>
    </div>
  );
}
