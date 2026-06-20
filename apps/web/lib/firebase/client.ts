"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { type Messaging, getMessaging, getToken, isSupported } from "firebase/messaging";

/**
 * Firebase client singleton + FCM helpers. Client-only — never import from a
 * Server Component, Route Handler, or the service worker. `firebase/messaging`
 * touches `navigator`/`window`, so every entry point is guarded by `isSupported()`
 * and an SSR check so the build never evaluates it during prerender.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True only when the public Firebase config is present (lets the UI hide push). */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

function app() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/** Resolve a Messaging instance, or null when unsupported/unconfigured/SSR. */
async function messagingIfSupported(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (!isFirebaseConfigured()) return null;
  if (!(await isSupported())) return null;
  return getMessaging(app());
}

/**
 * Request an FCM registration token using the EXISTING Serwist service worker
 * (no separate firebase-messaging-sw.js). Must be called AFTER the user has
 * granted notification permission (a user gesture). Returns null when push is
 * unsupported, unconfigured, the SW isn't ready, or token retrieval fails.
 */
export async function getFcmToken(): Promise<string | null> {
  const messaging = await messagingIfSupported();
  if (!messaging) return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    // Reuse the Serwist registration; wait until it's active before getToken.
    // `.ready` never resolves if no SW ever registers (e.g. Serwist is disabled
    // in dev), so race a timeout to fail closed instead of hanging the drawer.
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    if (!registration) return null;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    return token || null;
  } catch {
    return null;
  }
}
