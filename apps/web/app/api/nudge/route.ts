import {
  formatTimeLabel,
  getCurrentTime,
  getNextSessions,
  getUpcomingDeadlines,
  getVenueById,
} from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  interests: z.array(z.string()).default([]),
  limit: z.number().int().min(1).max(3).default(1),
});

/** Tokenize a free-text interest list into lowercased, de-duped terms. */
function tokenize(interests: string[]): string[] {
  const tokens = interests
    .flatMap((i) => i.toLowerCase().split(/[\s,]+/))
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
  return Array.from(new Set(tokens));
}

/**
 * Proactive nudge: surface the soonest upcoming sessions, lightly re-ranked by
 * overlap with the caller's interests, plus the next deadline. Deterministic
 * server orchestration — no LLM, only snapshot data.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { interests, limit } = parsed.data;

  const now = getCurrentTime();
  const upcoming = getNextSessions(now, 8);
  const tokens = tokenize(interests);

  // Score each session by interest-token overlap; baseline 0 keeps the soonest
  // session in play even when no interests are provided.
  const ranked = upcoming
    .map((s) => {
      const haystack = [s.title, s.partner, s.track, s.type, s.dayTheme]
        .filter(Boolean)
        .map((f) => (f as string).toLowerCase());
      const matched = tokens.filter((t) => haystack.some((h) => h.includes(t)));
      return { session: s, score: matched.length, matched };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.session.startsAt ?? 0) - (b.session.startsAt ?? 0);
    })
    .slice(0, limit);

  const suggestions = ranked.map(({ session: s, score, matched }) => {
    const venue = getVenueById(s.venueId);
    const mapUrl =
      venue?.mapUrl ??
      (venue?.lat != null && venue?.lng != null
        ? `https://www.google.com/maps/search/?api=1&query=${venue.lat}%2C${venue.lng}`
        : null);
    const time =
      s.startTimeLabel && s.endTimeLabel
        ? `${s.startTimeLabel}-${s.endTimeLabel}`
        : (s.startTimeLabel ?? formatTimeLabel(s.startsAt ?? null));
    const reason =
      score > 0
        ? `Starts at ${formatTimeLabel(s.startsAt ?? null)} · matches your interest in ${matched.join(", ")}`
        : "Up next";
    return {
      sessionId: s.id,
      title: s.title,
      time,
      partner: s.partner ?? null,
      venue: venue?.name ?? null,
      mapUrl,
      startsAt: s.startsAt ?? null,
      reason,
      sourceUrl: s.sourceUrl ?? null,
    };
  });

  const nextDeadline = getUpcomingDeadlines(now)[0];
  const deadline = nextDeadline
    ? {
        title: nextDeadline.title,
        dueAt: nextDeadline.dueAt ?? null,
        due: nextDeadline.dueAt ? formatTimeLabel(nextDeadline.dueAt) : "open",
      }
    : null;

  return Response.json({ now: formatTimeLabel(now), suggestions, deadline });
}
