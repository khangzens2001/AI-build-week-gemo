import {
  type CreateAnnouncementInput,
  allPushSubscriptions,
  createAnnouncement,
  deletePushSubscription,
  listAnnouncements,
} from "@event/core";
import { z } from "zod";
import { sendPush } from "../_lib/push";

export const runtime = "nodejs";
// Reads live D1 (announcements change at runtime via the ingest hook / Cue Pulse),
// so this must never be statically prerendered/cached at build time.
export const dynamic = "force-dynamic";

/**
 * Cue Pulse announcements API.
 *
 * - GET is a public read of the latest announcements (mapped to client field
 *   names). - POST is guarded by a shared `INGEST_HOOK_TOKEN` bearer secret;
 *   it inserts an announcement and fans a Web Push out to every subscription.
 *   Every announcement carries a `sourceUrl` for citations.
 */

/** GET — public read. `?limit=` clamps to 1..50 (default 50). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Default to 50 when the param is absent or non-numeric. Note: a missing param
  // is `null`, and `Number(null)` is 0 (which IS finite) — so we read the raw
  // string and only parse when it's actually present, otherwise the no-param
  // case would clamp to 1 instead of 50.
  const rawParam = searchParams.get("limit");
  const parsed = rawParam === null ? Number.NaN : Number(rawParam);
  const limit = Number.isFinite(parsed) ? Math.min(50, Math.max(1, Math.trunc(parsed))) : 50;

  const rows = await listAnnouncements(limit);
  return Response.json({
    announcements: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      severity: row.severity,
      targetId: row.target_id,
      sourceUrl: row.source_url,
      createdAt: row.created_at,
    })),
  });
}

const CreateBody = z.object({
  kind: z.enum(["schedule", "venue", "perk", "deadline", "general"]).default("general"),
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(["info", "important", "urgent"]).optional(),
  targetId: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
});

/** POST — create an announcement and fan out push. Guarded by INGEST_HOOK_TOKEN. */
export async function POST(req: Request) {
  const token = process.env.INGEST_HOOK_TOKEN;
  if (!token) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const input: CreateAnnouncementInput = {
    kind: parsed.data.kind,
    title: parsed.data.title,
    body: parsed.data.body,
    severity: parsed.data.severity,
    targetId: parsed.data.targetId ?? null,
    sourceUrl: parsed.data.sourceUrl ?? null,
  };
  const id = await createAnnouncement(input);

  // Fan a push out to every subscription so all builders see the change live.
  // Best-effort: a failed/throwing send (e.g. VAPID unset) must NOT fail the
  // request now that the announcement is already persisted.
  const subs = await allPushSubscriptions();
  let pushed = 0;
  for (const s of subs) {
    try {
      const result = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        { title: `Cue · ${input.title}`, body: input.body, url: "/pulse" },
      );
      if (result === "sent") pushed++;
      else if (result === "expired") await deletePushSubscription(s.endpoint);
    } catch {
      // Swallow — the announcement is saved; push delivery is best-effort.
    }
  }

  return Response.json({ id, pushed }, { status: 201 });
}
