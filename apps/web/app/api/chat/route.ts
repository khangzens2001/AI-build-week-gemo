import { SYSTEM_PROMPT, chatModel, tools } from "@event/core";
import { type UIMessage, convertToModelMessages, stepCountIs, streamText } from "ai";
import { clientIp, rateLimit } from "../_lib/ratelimit";

// web-push/D1 aside, the chat route only needs Node (not Edge) for the SDK.
export const runtime = "nodejs";
// Cap duration so a slow generation can't hang the request (Vercel timeout guard).
export const maxDuration = 30;

export async function POST(req: Request) {
  // Public LLM route — guard against curl-loop budget drain (per-instance limit).
  // No client IP (local dev / stripped header) → skip rather than share one bucket.
  const ip = clientIp(req);
  if (ip) {
    const limit = rateLimit(`chat:${ip}`, 20, 60_000);
    if (!limit.ok) {
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
      );
    }
  }

  let body: { messages?: UIMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) {
    return Response.json({ error: "messages must be an array" }, { status: 400 });
  }

  const result = streamText({
    model: chatModel,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(body.messages),
    tools,
    // Allow the model to call a tool, read its output, then answer (multi-step).
    stopWhen: stepCountIs(5),
    // Snappy copilot replies — low thinking. (plan-my-day uses high; see /api/plan.)
    providerOptions: {
      google: { thinkingConfig: { thinkingLevel: "low" } },
    },
  });

  return result.toUIMessageStreamResponse();
}
