import {
  deletePushToken,
  dueNotifications,
  getCurrentTime,
  markNotificationSent,
} from "@event/core";
import { sendFcm } from "../../_lib/fcm";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Notification sweep — intended to be hit by Vercel Cron on a short interval.
 * Finds reminders AND checklist items due at/before now (joined to the user's
 * FCM tokens via `dueNotifications`, one row per device token), sends a push for
 * each, and marks the right row sent. Protected by CRON_SECRET via the
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
    // A throwing send (e.g. FCM creds unset) must not abort the whole sweep.
    let result: "sent" | "expired" | "error";
    try {
      result = await sendFcm(t.token, { title: "Cue", body: t.label, url: "/" });
    } catch {
      result = "error";
    }

    if (result === "sent") {
      await markNotificationSent(t.kind, t.source_id);
      sent++;
    } else if (result === "expired") {
      // Drop dead tokens so we don't retry them every sweep forever.
      await deletePushToken(t.token);
      expired++;
    } else {
      errored++;
    }
  }

  return Response.json({ checked: targets.length, sent, expired, errored });
}
