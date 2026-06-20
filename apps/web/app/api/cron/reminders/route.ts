import {
  deletePushSubscription,
  dueNotifications,
  getCurrentTime,
  markNotificationSent,
} from "@event/core";
import { sendPush } from "../../_lib/push";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Notification sweep — intended to be hit by Vercel Cron on a short interval.
 * Finds reminders AND checklist items due at/before now (joined to the user's
 * push subscriptions via `dueNotifications`), sends a notification for each, and
 * marks the right row sent. Protected by CRON_SECRET via the
 * `Authorization: Bearer` header that Vercel Cron sends.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = getCurrentTime();
  const targets = await dueNotifications(now);

  let sent = 0;
  let expired = 0;
  let errored = 0;

  for (const t of targets) {
    // A throwing send (e.g. VAPID unset) must not abort the whole sweep.
    let result: "sent" | "expired" | "error";
    try {
      result = await sendPush(
        { endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth },
        { title: "Cue", body: t.label, url: "/" },
      );
    } catch {
      result = "error";
    }

    if (result === "sent") {
      await markNotificationSent(t.kind, t.source_id);
      sent++;
    } else if (result === "expired") {
      // Drop dead endpoints so we don't retry them every sweep forever.
      await deletePushSubscription(t.endpoint);
      expired++;
    } else {
      errored++;
    }
  }

  return Response.json({ checked: targets.length, sent, expired, errored });
}
