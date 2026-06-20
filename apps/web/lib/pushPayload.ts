/**
 * Pure parser for the push-event payload our service worker receives. Extracted
 * so it can be unit-tested without a live FCM send (the one shape we couldn't
 * verify against the docs).
 *
 * It accepts BOTH shapes:
 *  - Our data-only FCM send: `{ title, body, url }` at the top level (sendFcm puts
 *    these in the message `data`, which FCM delivers as the push payload JSON).
 *  - FCM's notification shape (belt-and-suspenders, in case a `notification` block
 *    is ever sent): `{ notification: { title, body }, data: { url }, fcmOptions: { link } }`.
 *
 * Always returns a renderable notification; falls back to the Cue title and "/".
 */
export interface PushView {
  title: string;
  body: string;
  url: string;
}

interface RawPush {
  title?: unknown;
  body?: unknown;
  url?: unknown;
  notification?: { title?: unknown; body?: unknown };
  data?: { url?: unknown; title?: unknown; body?: unknown };
  fcmOptions?: { link?: unknown };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function parsePushPayload(raw: unknown): PushView {
  const p = (raw ?? {}) as RawPush;
  const title = str(p.title) ?? str(p.notification?.title) ?? str(p.data?.title) ?? "Cue";
  const body = str(p.body) ?? str(p.notification?.body) ?? str(p.data?.body) ?? "";
  const url = str(p.url) ?? str(p.data?.url) ?? str(p.fcmOptions?.link) ?? "/";
  return { title, body, url };
}
