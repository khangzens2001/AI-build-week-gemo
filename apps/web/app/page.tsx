import { DeadlineStrip } from "@/components/home/DeadlineStrip";
import { EventCountdown } from "@/components/home/EventCountdown";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { NowNextHero } from "@/components/home/NowNextHero";
import { NudgeCard } from "@/components/home/NudgeCard";
import { PulseCard } from "@/components/home/PulseCard";
import { QuickChips } from "@/components/home/QuickChips";
import { TodayRail } from "@/components/home/TodayRail";

export default function HomePage() {
  return (
    <div className="space-y-6 px-4">
      <GreetingHeader />
      <EventCountdown />
      <QuickChips />
      <NudgeCard />
      <NowNextHero />
      <PulseCard />
      <DeadlineStrip />
      <TodayRail />
      <FeatureGrid />
    </div>
  );
}
