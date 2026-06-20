import { PitchCoach } from "@/components/demo/PitchCoach";
import { SubmissionChecklist } from "@/components/demo/SubmissionChecklist";

export default function DemoPage() {
  return (
    <div className="space-y-8 px-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">Day 5</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Demo Day Coach</h1>
        <p className="mt-1 text-sm text-muted">
          Get submission-ready, then rehearse your pitch with AI feedback.
        </p>
      </header>

      <SubmissionChecklist />
      <PitchCoach />
    </div>
  );
}
