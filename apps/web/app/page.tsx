import { DeadlineStrip } from "@/components/home/DeadlineStrip";
import { EventCountdown } from "@/components/home/EventCountdown";
import { GreetingHeader } from "@/components/home/GreetingHeader";
import { NowNextHero } from "@/components/home/NowNextHero";
import { QuickChips } from "@/components/home/QuickChips";
import { TodayRail } from "@/components/home/TodayRail";

export default function HomePage() {
  return (
    <div className="space-y-6 px-4">
      <GreetingHeader />
      <EventCountdown />
      <QuickChips />
      <NowNextHero />
      <DeadlineStrip />
      <TodayRail />
    </div>
  );
}
