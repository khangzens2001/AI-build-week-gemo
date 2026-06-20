"use client";

import { cn } from "@/lib/cn";
import { fetchJson } from "@/lib/fetcher";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { MicIcon, SparkIcon } from "../icons";

type PitchReview = {
  overallScore: number;
  criteria: { name: string; score: number; feedback: string }[];
  fixes: string[];
  practiceQuestions: string[];
};

type ReviewError = Error & { status?: number };

/** Score ring colour: strong → cyan/live, mid → amber, weak → faint. Never red. */
function scoreTone(score: number, max = 100) {
  const pct = score / max;
  if (pct >= 0.75) return { ring: "var(--color-live)", text: "text-live" };
  if (pct >= 0.5) return { ring: "var(--color-warn)", text: "text-warn" };
  return { ring: "var(--color-faint)", text: "text-faint" };
}

/**
 * Pitch Coach — a textarea + "Review my pitch" → POST /api/pitch/review. Renders
 * the overall score as a ring, per-criterion bars, concrete fixes and likely
 * judge questions. Degrades to a friendly state on 503 (no Gemini key).
 */
export function PitchCoach() {
  const [pitch, setPitch] = useState("");
  const review = useMutation<PitchReview, ReviewError, string>({
    mutationFn: (text: string) =>
      fetchJson<PitchReview>("/api/pitch/review", {
        method: "POST",
        body: JSON.stringify({ pitch: text }),
      }),
  });

  const noKey = review.error?.status === 503;
  const rateLimited = review.error?.status === 429;
  const result = review.data;
  const tone = result ? scoreTone(result.overallScore) : null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/12 text-accent-text">
          <MicIcon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Pitch Coach</h2>
          <p className="text-xs text-muted">Paste your pitch and get scored like a judge would.</p>
        </div>
      </div>

      <textarea
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        rows={6}
        placeholder="We built…  The problem is…  Our demo shows…  We use AI to…"
        className="w-full resize-none rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-faint focus:border-accent/40 focus:outline-none"
      />

      <button
        type="button"
        onClick={() => pitch.trim() && review.mutate(pitch.trim())}
        disabled={!pitch.trim() || review.isPending}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-[15px] font-bold text-accent-ink transition active:scale-[0.98] disabled:opacity-50"
      >
        <SparkIcon className="h-4 w-4" />
        {review.isPending ? "Scoring your pitch…" : "Review my pitch"}
      </button>

      {/* No-key / error states */}
      {noKey && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4 text-center">
          <p className="text-sm font-semibold">Pitch coach is offline</p>
          <p className="mt-1 text-xs text-muted">
            Add a Gemini key (GOOGLE_GENERATIVE_AI_API_KEY) to enable AI scoring.
          </p>
        </div>
      )}
      {rateLimited && (
        <div className="mt-4 rounded-2xl border border-warn/25 bg-warn/[0.07] p-4 text-center">
          <p className="text-sm font-semibold text-warn">Slow down a sec</p>
          <p className="mt-1 text-xs text-muted">
            You've hit the rate limit. Try again in a minute.
          </p>
        </div>
      )}
      {review.isError && !noKey && !rateLimited && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4 text-center">
          <p className="text-sm text-muted">Couldn't score that. Give it another try.</p>
        </div>
      )}

      {/* Result */}
      {result && tone && (
        <div className="mt-5 space-y-4">
          {/* Overall score ring */}
          <div className="card flex items-center gap-4 p-4">
            <div
              className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${tone.ring} ${result.overallScore * 3.6}deg, var(--color-surface-2) 0deg)`,
              }}
            >
              <div className="flex h-[60px] w-[60px] flex-col items-center justify-center rounded-full bg-surface">
                <span className={cn("tnum text-2xl font-bold leading-none", tone.text)}>
                  {result.overallScore}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-faint">
                  /100
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
                Overall score
              </p>
              <p className="mt-1 text-sm font-semibold leading-snug">
                {result.overallScore >= 75
                  ? "Strong pitch — sharpen the edges below."
                  : result.overallScore >= 50
                    ? "Good bones. The fixes below will lift it."
                    : "Early draft. Work the fixes below."}
              </p>
            </div>
          </div>

          {/* Criteria */}
          {result.criteria.length > 0 && (
            <div className="space-y-2.5">
              {result.criteria.map((c) => {
                const ct = scoreTone(c.score, 10);
                return (
                  <div key={c.name} className="rounded-2xl border border-line bg-surface p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{c.name}</p>
                      <span className={cn("tnum text-sm font-bold", ct.text)}>
                        {c.score}
                        <span className="text-faint">/10</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.score * 10}%`, background: ct.ring }}
                      />
                    </div>
                    {c.feedback && (
                      <p className="mt-2 text-xs leading-snug text-muted">{c.feedback}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Fixes */}
          {result.fixes.length > 0 && (
            <div className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-text">
                Top fixes
              </p>
              <ol className="mt-2.5 space-y-2">
                {result.fixes.map((fix, i) => (
                  <li key={fix} className="flex gap-2.5 text-sm leading-snug">
                    <span className="tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
                      {i + 1}
                    </span>
                    <span>{fix}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Practice questions */}
          {result.practiceQuestions.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
                Judges might ask
              </p>
              <ul className="mt-2.5 space-y-2">
                {result.practiceQuestions.map((q) => (
                  <li key={q} className="flex gap-2.5 text-sm leading-snug text-muted">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-faint"
                      aria-hidden
                    />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
