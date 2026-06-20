import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Firebase Cloud Messaging sender (Node runtime only). Mirrors the lazy-config
 * pattern of the old web-push sender: the Admin SDK is initialized on first send
 * (never at import time) so a route can import this without credentials present,
 * and a missing-creds failure surfaces as a thrown send the per-target try/catch
 * swallows — not an import-time crash.
 *
 * Credentials come from a single base64-encoded service-account JSON
 * (FIREBASE_SERVICE_ACCOUNT_B64) to avoid the multi-line private-key `\n`
 * footgun on hand-edited VM env files.
 *
 * `import "server-only"` hard-guards this out of any client/Edge/SW bundle.
 */

import type { App } from "firebase-admin/app";
import type { Messaging } from "firebase-admin/messaging";

let messaging: Messaging | null = null;

function ensureMessaging(): Messaging {
  if (messaging) return messaging;

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error(
      "FCM not configured (FIREBASE_SERVICE_ACCOUNT_B64 missing). Set the base64 service account.",
    );
  }

  let serviceAccount: { project_id?: string; client_email?: string; private_key?: string };
  try {
    serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is not valid base64-encoded JSON.");
  }

  const existing = getApps()[0];
  const app: App =
    existing ??
    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });

  messaging = getMessaging(app);
  return messaging;
}

export interface FcmPayload {
  title: string;
  body: string;
  url?: string;
}

export type PushResult = "sent" | "expired" | "error";

/**
 * Send one FCM message to a registration token. DATA-ONLY by design: the title/
 * body/url go in `data` (not a `notification` block) so our Serwist service
 * worker — which has no Firebase SDK — receives a predictable `event.data.json()`
 * shape and renders the notification itself (no double-display).
 *
 * Returns "expired" when FCM reports the token is unregistered (caller prunes it),
 * "error" for other failures, "sent" on success. Same contract as the old sender.
 */
export async function sendFcm(token: string, payload: FcmPayload): Promise<PushResult> {
  try {
    await ensureMessaging().send({
      token,
      data: {
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/",
      },
      webpush: {
        // High urgency so time-sensitive reminders aren't held by the push service.
        headers: { Urgency: "high" },
      },
    });
    return "sent";
  } catch (err) {
    // firebase-admin throws FirebaseMessagingError with the failure on `.code`
    // (NOT `.errorCode`), prefixed `messaging/`. Prune ONLY on the unambiguous
    // dead-token codes — `messaging/invalid-argument` also fires for a malformed
    // payload, so treating it as "expired" could delete a healthy token over our
    // own bug. Let it fall through to "error".
    const code = (err as { code?: string }).code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      return "expired";
    }
    return "error";
  }
}
