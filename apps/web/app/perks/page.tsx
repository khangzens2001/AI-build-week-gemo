"use client";

import { GiftIcon } from "@/components/icons";
import { DeadlineCard } from "@/components/perks/DeadlineCard";
import { PerkCard } from "@/components/perks/PerkCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CardSkeleton, SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useDeadlines, usePerks } from "@/hooks/useEventData";

export default function PerksPage() {
  const perks = usePerks();
  const deadlines = useDeadlines();

  const sortedDeadlines = [...(deadlines.data?.deadlines ?? [])].sort((a, b) => {
    // Dated first, soonest at the top; open-ended last.
    if (a.dueAt == null && b.dueAt == null) return 0;
    if (a.dueAt == null) return 1;
    if (b.dueAt == null) return -1;
    return a.dueAt - b.dueAt;
  });

  return (
    <div className="space-y-7 px-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          Builder rewards
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Perks &amp; Deadlines</h1>
        <p className="mt-1 text-sm text-muted">
          Credits, prizes and accelerator access — plus the dates you can't miss.
        </p>
      </header>

      {/* PERKS */}
      <section>
        <SectionHeader title="Perks &amp; credits" kicker="Claim these" />
        {perks.isLoading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : perks.isError ? (
          <ErrorState onRetry={() => perks.refetch()} />
        ) : (perks.data?.perks.length ?? 0) === 0 ? (
          <EmptyState
            icon={<GiftIcon className="h-6 w-6" />}
            title="No perks listed yet"
            description="Sponsor perks will show up here once they're announced."
          />
        ) : (
          <div className="stagger space-y-3.5">
            {perks.data?.perks.map((perk, i) => (
              <div key={perk.id} style={{ ["--i" as string]: i }}>
                <PerkCard perk={perk} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* DEADLINES */}
      <section id="deadlines" className="scroll-mt-24">
        <SectionHeader title="Deadlines" kicker="On the clock" />
        {deadlines.isLoading ? (
          <SkeletonList count={2} />
        ) : deadlines.isError ? (
          <ErrorState onRetry={() => deadlines.refetch()} />
        ) : sortedDeadlines.length === 0 ? (
          <EmptyState title="No deadlines ahead" description="You're all clear for now." />
        ) : (
          <div className="space-y-3">
            {sortedDeadlines.map((d) => (
              <DeadlineCard key={d.id} deadline={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
