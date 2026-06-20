"use client";

import { getFcmToken, isFirebaseConfigured } from "@/lib/firebase/client";

/**
 * Push-permission helpers (no React state — pure browser/network side effects so
 * they can be called from the context provider's handlers). The provider owns the
 * drawer open-state; these functions do the actual permission + token work.
 */

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

/** Current notification permission, normalized. "unsupported" when the API/config is absent. */
export function readPushPermission(): PushPermission {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !isFirebaseConfigured()) return "unsupported";
  return Notification.permission as PushPermission;
}

/**
 * Register the current device's FCM token server-side. Token-only — does NOT
 * call Notification.requestPermission, so it's safe to run OUTSIDE a user gesture
 * (e.g. on mount when permission is already granted). savePushToken upserts, so
 * calling this repeatedly is harmless and also refreshes the token's last_seen.
 * Returns true if a token was registered.
 */
export async function registerPushToken(): Promise<boolean> {
  try {
    const token = await getFcmToken();
    if (!token) return false;
    const res = await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Run the native permission request (MUST be inside a user gesture), then — if
 * granted — fetch the FCM token and register it server-side. Returns the
 * resulting permission so the caller can update UI. Network failures are
 * swallowed (the permission still counts as granted; the token re-registers on
 * the next launch via the provider's mount effect).
 */
export async function enablePush(): Promise<PushPermission> {
  if (!("Notification" in window)) return "unsupported";

  const permission = (await Notification.requestPermission()) as PushPermission;
  if (permission !== "granted") return permission;

  await registerPushToken();
  return "granted";
}
