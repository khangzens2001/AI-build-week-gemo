import { d1Execute } from "./d1";

/**
 * Idempotent, boot-time schema bootstrap for the feature tables (Cue Pulse,
 * checklist, mentors/office-hours, teams/build-log, FCM push tokens).
 *
 * WHY this exists (and isn't just `wrangler d1 migrations apply`):
 * - In the VM/Podman deploy, the only mutable store is the `d1shim` bun:sqlite
 *   container, reached through the same D1 REST contract the app uses at runtime.
 * - The CI deploy key is **rsync-only** (forced command in deploy-recv.sh) and
 *   cannot run remote SQL, so migrations can't be applied over the deploy path.
 * - Each CI deploy restarts the `web` container, so running this once at boot
 *   makes every deploy self-healing: new tables appear without manual steps.
 *
 * Design constraints:
 * - The d1shim executes ONE statement per request (`db.query(sql).all()`), so
 *   every statement below is issued as a separate `d1Execute` call — never a
 *   multi-statement blob.
 * - Every statement is `IF NOT EXISTS`, so this is safe to run on every boot and
 *   never touches existing rows (no DELETE/seed here — demo seed is a one-shot,
 *   see drizzle/seed-features.sql).
 * - Mirrors drizzle/migrations/0002_supreme_wallflower.sql (feature tables) and
 *   0003_marvelous_ghost_rider.sql (push_tokens). When you add tables to those
 *   migrations, add the matching `CREATE TABLE IF NOT EXISTS` here.
 */

const FEATURE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS announcements (
    id text PRIMARY KEY NOT NULL,
    kind text DEFAULT 'general' NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    severity text DEFAULT 'info' NOT NULL,
    target_id text,
    source_url text,
    created_at integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS teams (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    tagline text,
    looking_for text,
    created_by text NOT NULL,
    created_at integer NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE no action ON DELETE no action
  )`,
  `CREATE TABLE IF NOT EXISTS team_members (
    team_id text NOT NULL,
    user_id text NOT NULL,
    role text,
    joined_at integer NOT NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action
  )`,
  `CREATE TABLE IF NOT EXISTS build_logs (
    id text PRIMARY KEY NOT NULL,
    team_id text NOT NULL,
    user_id text NOT NULL,
    body text NOT NULL,
    created_at integer NOT NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action
  )`,
  `CREATE TABLE IF NOT EXISTS checklist_items (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    title text NOT NULL,
    notes text,
    completed integer DEFAULT 0 NOT NULL,
    target_id text,
    target_type text DEFAULT 'custom' NOT NULL,
    fire_at integer,
    sent integer DEFAULT 0 NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action
  )`,
  `CREATE TABLE IF NOT EXISTS mentors (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    title text,
    org text,
    bio text,
    avatar_url text,
    expertise text,
    slots text,
    source_url text
  )`,
  `CREATE TABLE IF NOT EXISTS office_hours_bookings (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    mentor_id text NOT NULL,
    slot_id text NOT NULL,
    topic text,
    created_at integer NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON UPDATE no action ON DELETE no action
  )`,
  // FCM registration tokens (one row per device). The CREATE INDEX is a SEPARATE
  // entry below because the d1shim executes one statement per request.
  `CREATE TABLE IF NOT EXISTS push_tokens (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    token text NOT NULL UNIQUE,
    created_at integer NOT NULL,
    last_seen integer NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action
  )`,
  "CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id)",
];

let ran = false;

/**
 * Ensure the feature tables exist. Idempotent (every statement is IF NOT EXISTS)
 * and latches only on FULL success, so if the D1 target is briefly unavailable
 * at boot a later call can still complete the bootstrap. Best-effort: a failure
 * here must NOT crash the server — routes that don't need these tables keep
 * serving, and the failure is logged so a misconfigured D1 target is obvious.
 */
export async function ensureFeatureSchema(): Promise<void> {
  if (ran) return;
  let allOk = true;
  for (const stmt of FEATURE_TABLES) {
    try {
      await d1Execute(stmt);
    } catch (err) {
      allOk = false;
      const name = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] ?? "?";
      console.error(`[migrate] failed to ensure table "${name}":`, err);
    }
  }
  // Only latch when the whole bootstrap succeeded, so a transient failure at
  // boot doesn't permanently skip it for the life of the process.
  if (allOk) ran = true;
}
