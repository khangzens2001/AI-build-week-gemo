import { PitchReviewSchema, chatModel } from "@event/core";
import { generateObject } from "ai";
import { z } from "zod";
import { clientIp, rateLimit } from "../../_lib/ratelimit";

export const runtime = "nodejs";
// Higher thinking budget → allow more time. Keep off Vercel Hobby's 60s cap in prod.
export const maxDuration = 120;

const PITCH_SYSTEM = `You are a Demo Day pitch coach for a hackathon. Score the pitch 0-100 overall, and per-criterion (Problem clarity, Demo strength, Meaningful AI use) 0-10 with one-line feedback. Give 3 concrete fixes and 3 likely judge Q&A questions. Be specific and kind. Respond in the user's language.`;

const ReviewBody = z.object({
  pitch: z.string().min(1).max(8000),
  language: z.enum(["en", "vi"]).optional(),
});

/**
 * Pitch Coach (UI-only, stateless) — scores a Demo Day pitch and returns
 * structured feedback. Nothing is persisted (no table, no tool). Rate-limited
 * like /api/plan to protect the Gemini budget. Returns 503 with a clear message
 * when no Google API key is configured so the UI can degrade gracefully.
 */
export async function POST(req: Request) {
  // Expensive route (high thinking) — tighter public limit to protect the budget.
  const ip = clientIp(req);
  if (ip) {
    const limit = rateLimit(`pitch:${ip}`, 5, 60_000);
    if (!limit.ok) {
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }
  }

  const parsed = ReviewBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { pitch, language } = parsed.data;

  try {
    const { object } = await generateObject({
      model: chatModel,
      schema: PitchReviewSchema,
      system: PITCH_SYSTEM,
      prompt: `Review this hackathon Demo Day pitch and return structured feedback.
${language === "vi" ? "Respond in Vietnamese." : "Respond in English."}

Pitch:
${pitch}`,
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: "high" } },
      },
    });
    return Response.json(object);
  } catch {
    // generateObject throws when no GEMINI/GOOGLE key is set (among other causes).
    return Response.json(
      { error: "pitch coach needs GOOGLE_GENERATIVE_AI_API_KEY" },
      { status: 503 },
    );
  }
}
