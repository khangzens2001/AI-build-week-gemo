import { d1Execute, d1Query } from "./d1";
import type {
  Announcement,
  ChecklistItem,
  Mentor,
  MentorSlot,
  Team,
  UserPreferences,
} from "./schemas";

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

// ---- FCM push tokens (Firebase Cloud Messaging) --------------------------
// Replaces the raw Web Push subscription flow. One row per browser/device;
// `token` is unique. Re-registering the same device upserts and REASSIGNS
// user_id (so a shared device that switches accounts attaches to the current
// user). Dead tokens are pruned at send time on `registration-token-not-registered`.

export interface SavePushTokenInput {
  userId: string;
  token: string;
}

export async function savePushToken(input: SavePushTokenInput): Promise<void> {
  const now = Date.now();
  await d1Execute(
    "INSERT INTO push_tokens (id, user_id, token, created_at, last_seen) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, last_seen = excluded.last_seen",
    [newId(), input.userId, input.token, now, now],
  );
}

/** Remove an FCM token (called when a send reports the token is unregistered). */
export async function deletePushToken(token: string): Promise<void> {
  await d1Execute("DELETE FROM push_tokens WHERE token = ?", [token]);
}

/** Every FCM token (used to fan a Cue Pulse announcement out to all devices). */
export async function allPushTokens(): Promise<string[]> {
  const rows = await d1Query<{ token: string }>("SELECT token FROM push_tokens");
  return rows.map((r) => r.token);
}

// ===========================================================================
// Feature data access (announcements, checklist, mentors, teams). All reads of
// mutable/per-user state go through here; parameterized SQL only.
// ===========================================================================

// ---- Announcements (Cue Pulse) -------------------------------------------

export interface AnnouncementRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  severity: string;
  target_id: string | null;
  source_url: string | null;
  created_at: number;
}

/** Latest announcements, newest first. */
export async function listAnnouncements(limit = 50): Promise<AnnouncementRow[]> {
  return d1Query<AnnouncementRow>(
    "SELECT id, kind, title, body, severity, target_id, source_url, created_at FROM announcements ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
}

export interface CreateAnnouncementInput {
  kind: Announcement["kind"];
  title: string;
  body: string;
  severity?: Announcement["severity"];
  targetId?: string | null;
  sourceUrl?: string | null;
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<string> {
  const id = newId();
  await d1Execute(
    "INSERT INTO announcements (id, kind, title, body, severity, target_id, source_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      input.kind,
      input.title,
      input.body,
      input.severity ?? "info",
      input.targetId ?? null,
      input.sourceUrl ?? null,
      Date.now(),
    ],
  );
  return id;
}

// ---- Checklist items ------------------------------------------------------

export interface ChecklistRow {
  id: string;
  title: string;
  notes: string | null;
  completed: number;
  target_id: string | null;
  target_type: string;
  fire_at: number | null;
  sent: number;
  created_at: number;
  updated_at: number;
}

export async function listChecklist(userId: string): Promise<ChecklistRow[]> {
  return d1Query<ChecklistRow>(
    "SELECT id, title, notes, completed, target_id, target_type, fire_at, sent, created_at, updated_at FROM checklist_items WHERE user_id = ? ORDER BY created_at ASC",
    [userId],
  );
}

export interface CreateChecklistInput {
  userId: string;
  title: string;
  notes?: string | null;
  targetId?: string | null;
  targetType?: ChecklistItem["targetType"];
  fireAt?: number | null;
}

/**
 * Create a checklist item, de-duplicating on (userId, targetId) for non-custom
 * items so bookmarking the same session twice is a no-op. Returns the id (new or
 * existing).
 */
export async function createChecklistItem(input: CreateChecklistInput): Promise<string> {
  const type = input.targetType ?? "custom";
  if (input.targetId && type !== "custom") {
    const existing = await d1Query<{ id: string }>(
      "SELECT id FROM checklist_items WHERE user_id = ? AND target_id = ? AND target_type = ? LIMIT 1",
      [input.userId, input.targetId, type],
    );
    if (existing[0]) return existing[0].id;
  }
  const id = newId();
  const now = Date.now();
  await d1Execute(
    "INSERT INTO checklist_items (id, user_id, title, notes, completed, target_id, target_type, fire_at, sent, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?)",
    [
      id,
      input.userId,
      input.title,
      input.notes ?? null,
      input.targetId ?? null,
      type,
      input.fireAt ?? null,
      now,
      now,
    ],
  );
  return id;
}

export interface UpdateChecklistInput {
  title?: string;
  notes?: string | null;
  completed?: boolean;
  fireAt?: number | null;
}

/** Patch a checklist item the user owns. Only provided fields are updated. */
export async function updateChecklistItem(
  userId: string,
  id: string,
  patch: UpdateChecklistInput,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    params.push(patch.title);
  }
  if (patch.notes !== undefined) {
    sets.push("notes = ?");
    params.push(patch.notes);
  }
  if (patch.completed !== undefined) {
    sets.push("completed = ?");
    params.push(patch.completed ? 1 : 0);
  }
  if (patch.fireAt !== undefined) {
    sets.push("fire_at = ?");
    params.push(patch.fireAt);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  params.push(Date.now(), id, userId);
  await d1Execute(
    `UPDATE checklist_items SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
    params,
  );
}

export async function deleteChecklistItem(userId: string, id: string): Promise<void> {
  await d1Execute("DELETE FROM checklist_items WHERE id = ? AND user_id = ?", [id, userId]);
}

/**
 * Notifications due at/before `now` that haven't been sent, joined to the user's
 * FCM push tokens. UNIONs reminders + checklist items so a single cron sweep
 * covers both. `kind`/`source_id` let the cron mark the right row sent. One row
 * per (notification × device token) — every device fires.
 */
export interface DueNotification {
  kind: "reminder" | "checklist";
  source_id: string;
  label: string;
  token: string;
}

export async function dueNotifications(now: number): Promise<DueNotification[]> {
  return d1Query<DueNotification>(
    `SELECT 'reminder' AS kind, r.id AS source_id, r.label AS label, t.token AS token
       FROM reminders r
       JOIN push_tokens t ON t.user_id = r.user_id
      WHERE r.sent = 0 AND r.fire_at IS NOT NULL AND r.fire_at <= ?
     UNION ALL
     SELECT 'checklist' AS kind, c.id AS source_id, c.title AS label, t.token AS token
       FROM checklist_items c
       JOIN push_tokens t ON t.user_id = c.user_id
      WHERE c.sent = 0 AND c.completed = 0 AND c.fire_at IS NOT NULL AND c.fire_at <= ?`,
    [now, now],
  );
}

export async function markNotificationSent(
  kind: "reminder" | "checklist",
  id: string,
): Promise<void> {
  const table = kind === "reminder" ? "reminders" : "checklist_items";
  await d1Execute(`UPDATE ${table} SET sent = 1 WHERE id = ?`, [id]);
}

// ---- Mentors & office hours ----------------------------------------------

interface MentorRow {
  id: string;
  name: string;
  title: string | null;
  org: string | null;
  bio: string | null;
  avatar_url: string | null;
  expertise: string | null;
  slots: string | null;
  source_url: string | null;
}

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

function mentorFromRow(row: MentorRow, bookedSlotIds: Set<string>): Mentor {
  const slots = parseJsonArray<MentorSlot>(row.slots).map((s) => ({ ...s }));
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    org: row.org,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    expertise: parseJsonArray<string>(row.expertise),
    slots: slots.filter((s) => !bookedSlotIds.has(s.id)), // only free slots
    sourceUrl: row.source_url,
  };
}

/** All mentors with their currently-free slots. Optional expertise/keyword filter. */
export async function listMentors(query?: string | null): Promise<Mentor[]> {
  const rows = await d1Query<MentorRow>(
    "SELECT id, name, title, org, bio, avatar_url, expertise, slots, source_url FROM mentors ORDER BY name ASC",
  );
  const booked = await d1Query<{ slot_id: string }>("SELECT slot_id FROM office_hours_bookings");
  const bookedIds = new Set(booked.map((b) => b.slot_id));
  let mentors = rows.map((r) => mentorFromRow(r, bookedIds));
  const q = query?.toLowerCase().trim();
  if (q) {
    mentors = mentors.filter((m) =>
      [m.name, m.title, m.org, m.bio, ...m.expertise]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }
  return mentors;
}

export async function getMentorById(id: string): Promise<Mentor | null> {
  const rows = await d1Query<MentorRow>(
    "SELECT id, name, title, org, bio, avatar_url, expertise, slots, source_url FROM mentors WHERE id = ? LIMIT 1",
    [id],
  );
  if (!rows[0]) return null;
  const booked = await d1Query<{ slot_id: string }>(
    "SELECT slot_id FROM office_hours_bookings WHERE mentor_id = ?",
    [id],
  );
  return mentorFromRow(rows[0], new Set(booked.map((b) => b.slot_id)));
}

export interface BookOfficeHoursInput {
  userId: string;
  mentorId: string;
  slotId: string;
  topic?: string | null;
}

export type BookOfficeHoursResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slot_taken" | "no_such_slot" };

/**
 * Book a mentor slot. Rejects if the slot doesn't exist on that mentor or is
 * already taken (checked against existing bookings). Atomicity is best-effort at
 * the app layer (D1 has no SELECT ... FOR UPDATE); a UNIQUE index on
 * (mentor_id, slot_id) in the migration is the real guard.
 */
export async function bookOfficeHours(input: BookOfficeHoursInput): Promise<BookOfficeHoursResult> {
  const mentorRows = await d1Query<MentorRow>("SELECT slots FROM mentors WHERE id = ? LIMIT 1", [
    input.mentorId,
  ]);
  const slots = parseJsonArray<MentorSlot>(mentorRows[0]?.slots ?? null);
  if (!slots.some((s) => s.id === input.slotId)) return { ok: false, reason: "no_such_slot" };

  const taken = await d1Query<{ id: string }>(
    "SELECT id FROM office_hours_bookings WHERE mentor_id = ? AND slot_id = ? LIMIT 1",
    [input.mentorId, input.slotId],
  );
  if (taken[0]) return { ok: false, reason: "slot_taken" };

  const id = newId();
  await d1Execute(
    "INSERT INTO office_hours_bookings (id, user_id, mentor_id, slot_id, topic, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, input.userId, input.mentorId, input.slotId, input.topic ?? null, Date.now()],
  );
  return { ok: true, id };
}

export interface BookingRow {
  id: string;
  mentor_id: string;
  slot_id: string;
  topic: string | null;
  created_at: number;
}

export async function listBookings(userId: string): Promise<BookingRow[]> {
  return d1Query<BookingRow>(
    "SELECT id, mentor_id, slot_id, topic, created_at FROM office_hours_bookings WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
}

// ---- Teams & build log ----------------------------------------------------

interface TeamRow {
  id: string;
  name: string;
  tagline: string | null;
  looking_for: string | null;
  created_by: string;
  created_at: number;
}

function teamFromRow(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    lookingFor: parseJsonArray<string>(row.looking_for),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listTeams(): Promise<Team[]> {
  const rows = await d1Query<TeamRow>(
    "SELECT id, name, tagline, looking_for, created_by, created_at FROM teams ORDER BY created_at DESC",
  );
  return rows.map(teamFromRow);
}

export async function getTeamById(id: string): Promise<Team | null> {
  const rows = await d1Query<TeamRow>(
    "SELECT id, name, tagline, looking_for, created_by, created_at FROM teams WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ? teamFromRow(rows[0]) : null;
}

export interface CreateTeamInput {
  userId: string;
  name: string;
  tagline?: string | null;
  lookingFor?: string[];
}

export async function createTeam(input: CreateTeamInput): Promise<string> {
  const id = newId();
  const now = Date.now();
  await d1Execute(
    "INSERT INTO teams (id, name, tagline, looking_for, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [
      id,
      input.name,
      input.tagline ?? null,
      JSON.stringify(input.lookingFor ?? []),
      input.userId,
      now,
    ],
  );
  // Creator joins as the first member.
  await d1Execute(
    "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
    [id, input.userId, "founder", now],
  );
  return id;
}

export async function joinTeam(
  teamId: string,
  userId: string,
  role?: string | null,
): Promise<void> {
  const existing = await d1Query<{ user_id: string }>(
    "SELECT user_id FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1",
    [teamId, userId],
  );
  if (existing[0]) return;
  await d1Execute(
    "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
    [teamId, userId, role ?? "member", Date.now()],
  );
}

export interface TeamMemberRow {
  user_id: string;
  role: string | null;
  joined_at: number;
  name: string | null;
  image: string | null;
}

export async function listTeamMembers(teamId: string): Promise<TeamMemberRow[]> {
  return d1Query<TeamMemberRow>(
    `SELECT m.user_id, m.role, m.joined_at, u.name, u.image
       FROM team_members m JOIN users u ON u.id = m.user_id
      WHERE m.team_id = ? ORDER BY m.joined_at ASC`,
    [teamId],
  );
}

/** Whether a user belongs to a team (gate for posting to that team's build log). */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const rows = await d1Query<{ user_id: string }>(
    "SELECT user_id FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1",
    [teamId, userId],
  );
  return rows.length > 0;
}

export interface BuildLogRow {
  id: string;
  team_id: string;
  user_id: string;
  body: string;
  created_at: number;
  author_name: string | null;
  team_name: string | null;
}

/** Public build-log feed (newest first), optionally scoped to one team. */
export async function listBuildLogs(teamId?: string | null, limit = 50): Promise<BuildLogRow[]> {
  if (teamId) {
    return d1Query<BuildLogRow>(
      `SELECT b.id, b.team_id, b.user_id, b.body, b.created_at,
              u.name AS author_name, t.name AS team_name
         FROM build_logs b
         JOIN users u ON u.id = b.user_id
         JOIN teams t ON t.id = b.team_id
        WHERE b.team_id = ? ORDER BY b.created_at DESC LIMIT ?`,
      [teamId, limit],
    );
  }
  return d1Query<BuildLogRow>(
    `SELECT b.id, b.team_id, b.user_id, b.body, b.created_at,
            u.name AS author_name, t.name AS team_name
       FROM build_logs b
       JOIN users u ON u.id = b.user_id
       JOIN teams t ON t.id = b.team_id
      ORDER BY b.created_at DESC LIMIT ?`,
    [limit],
  );
}

export interface CreateBuildLogInput {
  teamId: string;
  userId: string;
  body: string;
}

export async function createBuildLog(input: CreateBuildLogInput): Promise<string> {
  const id = newId();
  await d1Execute(
    "INSERT INTO build_logs (id, team_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, input.teamId, input.userId, input.body, Date.now()],
  );
  return id;
}
