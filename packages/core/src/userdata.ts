import { d1Execute, d1Query } from "./d1";
import type { UserPreferences } from "./schemas";

/**
 * Mutable user-data access over D1 (Option B REST). This is the ONLY place the
 * app touches D1 at request time — static event data is served from the
 * snapshot. All statements are parameterized.
 *
 * Runtime-agnostic (per packages/core contract): uses the global Web Crypto
 * `crypto.randomUUID()` rather than a Node-only import, so it works on Vercel
 * Node, Cloudflare Workers, and the browser alike.
 */

function newId(): string {
  return crypto.randomUUID();
}

export interface UpsertUserInput {
  googleSub: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

/** Look up an existing app user id by Google account id, without writing. */
export async function getUserIdByGoogleSub(googleSub: string): Promise<string | null> {
  const rows = await d1Query<{ id: string }>("SELECT id FROM users WHERE google_sub = ? LIMIT 1", [
    googleSub,
  ]);
  return rows[0]?.id ?? null;
}

/** Insert or update a user keyed by their Google account id; returns the user id. */
export async function upsertUser(input: UpsertUserInput): Promise<string> {
  if (!input.email) {
    throw new Error("Cannot upsert user without an email (Google profile email missing).");
  }
  const now = Date.now();
  const rows = await d1Query<{ id: string }>("SELECT id FROM users WHERE google_sub = ? LIMIT 1", [
    input.googleSub,
  ]);
  const existing = rows[0];
  if (existing) {
    await d1Execute(
      "UPDATE users SET email = ?, name = ?, image = ?, updated_at = ? WHERE id = ?",
      [input.email, input.name ?? null, input.image ?? null, now, existing.id],
    );
    return existing.id;
  }
  const id = newId();
  await d1Execute(
    "INSERT INTO users (id, email, name, image, google_sub, preferences, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, input.email, input.name ?? null, input.image ?? null, input.googleSub, null, now, now],
  );
  return id;
}

export async function setUserPreferences(userId: string, prefs: UserPreferences): Promise<void> {
  await d1Execute("UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?", [
    JSON.stringify(prefs),
    Date.now(),
    userId,
  ]);
}

export interface CreateReminderInput {
  userId: string;
  targetId: string;
  targetKind: string;
  fireAt: number;
  label: string;
}

export async function createReminder(input: CreateReminderInput): Promise<string> {
  const id = newId();
  await d1Execute(
    "INSERT INTO reminders (id, user_id, target_id, target_kind, fire_at, label, sent, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
    [id, input.userId, input.targetId, input.targetKind, input.fireAt, input.label, Date.now()],
  );
  return id;
}

export interface ReminderRow {
  id: string;
  target_id: string;
  target_kind: string;
  fire_at: number;
  label: string;
  sent: number;
}

export async function listReminders(userId: string): Promise<ReminderRow[]> {
  return d1Query<ReminderRow>(
    "SELECT id, target_id, target_kind, fire_at, label, sent FROM reminders WHERE user_id = ? ORDER BY fire_at ASC",
    [userId],
  );
}

export interface SavePushSubscriptionInput {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function savePushSubscription(input: SavePushSubscriptionInput): Promise<void> {
  await d1Execute(
    "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth",
    [newId(), input.userId, input.endpoint, input.p256dh, input.auth, Date.now()],
  );
}

export interface DuePushTarget {
  reminder_id: string;
  label: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Reminders due at/before `now` that haven't been sent, joined to push subs. */
export async function dueReminders(now: number): Promise<DuePushTarget[]> {
  return d1Query<DuePushTarget>(
    `SELECT r.id AS reminder_id, r.label AS label, p.endpoint AS endpoint, p.p256dh AS p256dh, p.auth AS auth
     FROM reminders r
     JOIN push_subscriptions p ON p.user_id = r.user_id
     WHERE r.sent = 0 AND r.fire_at IS NOT NULL AND r.fire_at <= ?`,
    [now],
  );
}

export async function markReminderSent(reminderId: string): Promise<void> {
  await d1Execute("UPDATE reminders SET sent = 1 WHERE id = ?", [reminderId]);
}
