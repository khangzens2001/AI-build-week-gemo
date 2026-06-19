import { dueReminders, getCurrentTime, markReminderSent } from "@event/core";
import { sendPush } from "../../_lib/push";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reminder sweep — intended to be hit by Vercel Cron on a short interval. Finds
 * reminders due at/before now (joined to the user's push subscriptions), sends
 * a notification for each, and marks them sent. Protected by CRON_SECRET via the
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
  const targets = await dueReminders(now);

  let sent = 0;
  let expired = 0;
  let errored = 0;

  for (const t of targets) {
    const result = await sendPush(
      { endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth },
      { title: "Cue", body: t.label, url: "/" },
    );
    if (result === "sent") {
      await markReminderSent(t.reminder_id);
      sent++;
    } else if (result === "expired") {
      expired++;
    } else {
      errored++;
    }
  }

  return Response.json({ checked: targets.length, sent, expired, errored });
}
