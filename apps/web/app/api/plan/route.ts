import { allDeadlines, allPerks, chatModel, getCurrentTime, sessionsByStart } from "@event/core";
import { generateText } from "ai";
import { clientIp, rateLimit } from "../_lib/ratelimit";

export const runtime = "nodejs";
// Higher thinking budget → allow more time. Keep off Vercel Hobby's 60s cap in prod.
export const maxDuration = 120;

// Focused planner prompt — unlike the chat agent, this route has no tools; it is
// given the event data inline, so it must not be told to "use tools".
const PLAN_SYSTEM = `You are Cue's day-planner for Agentic AI Build Week (AABW), Jul 8–12 2026, Ho Chi Minh City.
Build a personalized, time-ordered agenda from ONLY the event data provided in the prompt. Never invent sessions, times, venues, or perks. If data is missing, say so briefly.
Be concise and skimmable: group by time, note clashes between parallel sessions and recommend a pick, call out perks worth grabbing and deadlines to watch. Respond in the user's requested language.`;

/**
 * "Plan my day" (stretch) — a one-shot, higher-reasoning planner. Uses
 * thinkingLevel high to produce a thoughtful agenda. Separate route so it never
 * shares the chat route's tighter timeout budget.
 *
 * Body: { day?: "2026-07-08", interests?: string, language?: "en"|"vi" }
 */
export async function POST(req: Request) {
  // Expensive route (high thinking) — tighter public limit to protect the budget.
  const ip = clientIp(req);
  if (ip) {
    const limit = rateLimit(`plan:${ip}`, 5, 60_000);
    if (!limit.ok) {
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }
  }

  const body = (await req.json().catch(() => ({}))) as {
    day?: string;
    interests?: string;
    language?: string;
  };

  const now = getCurrentTime();
  const day = body.day ?? null;
  const sessions = sessionsByStart()
    .filter((s) => (day ? s.day === day : (s.startsAt ?? 0) >= now))
    .map((s) => ({
      id: s.id,
      title: s.title,
      day: s.day,
      time: s.startTimeLabel && s.endTimeLabel ? `${s.startTimeLabel}-${s.endTimeLabel}` : null,
      partner: s.partner,
      type: s.type,
      venue: s.venueId,
    }));

  const context = {
    sessions,
    perks: allPerks().map((p) => ({ title: p.title, value: p.value })),
    deadlines: allDeadlines().map((d) => ({ title: d.title, type: d.type, dueAt: d.dueAt })),
  };

  const result = await generateText({
    model: chatModel,
    system: PLAN_SYSTEM,
    prompt: `Build a personalized agenda for an AABW attendee.
${day ? `Day: ${day}.` : "Across the remaining event time."}
${body.interests ? `Their interests: ${body.interests}.` : "No stated interests — keep it broad."}
${body.language === "vi" ? "Respond in Vietnamese." : "Respond in English."}

Use ONLY this event data (do not invent sessions, times, or perks):
${JSON.stringify(context, null, 2)}

Produce a concise, time-ordered plan: which sessions to attend and why, when to grab perks, and which deadlines to watch. Note any clashes between parallel sessions and suggest a pick. Keep it tight and skimmable.`,
    providerOptions: {
      google: { thinkingConfig: { thinkingLevel: "high" } },
    },
  });

  return Response.json({ plan: result.text });
}
