import { allPushSubscriptions, chatModel, createAnnouncement } from "@event/core";
import { generateText } from "ai";
import { sendPush } from "../../_lib/push";

export const runtime = "nodejs";

/**
 * Firecrawl monitor → re-ingest webhook (stretch). When a Firecrawl monitor
 * detects that an AABW source page changed, it POSTs here. We verify a shared
 * secret, then acknowledge. Actual re-embedding is delegated to the offline
 * `bun run seed && bun run embed` pipeline (the seed transform owns parsing),
 * so this endpoint records the signal and returns fast rather than doing heavy
 * work inside the request.
 *
 * In addition to recording the signal, we turn the change into a Cue Pulse
 * announcement: a one-sentence summary (Gemini, restating ONLY the diff) is
 * inserted and fanned out as a Web Push so builders see the change live. The
 * summary is defensive — if the model call fails (e.g. no API key) we fall back
 * to a literal title/body from the payload so the feature still works.
 *
 * Auth: `Authorization: Bearer <INGEST_HOOK_TOKEN>`.
 */
function authorized(req: Request): boolean {
  const token = process.env.INGEST_HOOK_TOKEN;
  if (!token) return false;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

interface ChangePayload {
  url?: string;
  changeType?: string;
  diff?: string;
  before?: string;
  after?: string;
  title?: string;
}

const SUMMARY_SYSTEM =
  "Restate ONLY what changed from the provided diff. Do not add facts. Keep to one sentence.";

/**
 * Build a one-sentence summary of the change via Gemini. Falls back to a literal
 * description of the diff fields if the model call fails (no key / network).
 */
async function summarizeChange(payload: ChangePayload): Promise<string> {
  const diffText = [
    payload.diff ? `Diff:\n${payload.diff}` : null,
    payload.before ? `Before:\n${payload.before}` : null,
    payload.after ? `After:\n${payload.after}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const fallback = diffText
    ? `Update detected on ${payload.url ?? "the event page"}: ${diffText.slice(0, 200)}`
    : `Content changed on ${payload.url ?? "the event page"} (${payload.changeType ?? "changed"}).`;

  if (!diffText) return fallback;

  try {
    const { text } = await generateText({
      model: chatModel,
      system: SUMMARY_SYSTEM,
      prompt: diffText,
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
    });
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

/** Insert a Cue Pulse announcement for the change and fan a push out to all subs. */
async function publishPulse(payload: ChangePayload): Promise<{ id: string; pushed: number }> {
  const summary = await summarizeChange(payload);
  const title = payload.title?.trim() || "Event update";

  const id = await createAnnouncement({
    kind: "general",
    title,
    body: summary,
    severity: "info",
    sourceUrl: payload.url ?? null,
  });

  const subs = await allPushSubscriptions();
  for (const s of subs) {
    await sendPush(
      { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
      { title: `Cue · ${title}`, body: summary, url: "/pulse" },
    );
  }

  return { id, pushed: subs.length };
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as ChangePayload;

  // Record the change signal. Re-ingest is run out-of-band (seed+embed) so the
  // webhook stays fast and the parsing logic lives in one place.
  console.log(
    `[ingest-hook] change detected: ${payload.url ?? "unknown"} (${payload.changeType ?? "changed"})`,
  );

  // Turn the change into a live Cue Pulse announcement (defensive: never throws).
  let pulse: { id: string; pushed: number } | null = null;
  try {
    pulse = await publishPulse(payload);
  } catch (err) {
    console.error("[ingest-hook] failed to publish pulse", err);
  }

  return Response.json({
    ok: true,
    received: { url: payload.url ?? null, changeType: payload.changeType ?? null },
    pulse,
    note: "Signal recorded. Run `bun run seed && bun run embed` to re-ingest changed content.",
  });
}
