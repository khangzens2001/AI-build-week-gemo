import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Cloudflare D1 (SQLite) schema for Cue.
 *
 * Design notes (per build plan §8 + architecture review):
 * - Static event data (sessions/venues/perks/deadlines) is the system-of-record
 *   here AND emitted as a bundled JSON snapshot the app reads on the hot path.
 *   D1 runtime reads from Vercel are reserved for mutable user data.
 * - Times are stored as TZ-correct epoch milliseconds (Asia/Ho_Chi_Minh, GMT+7)
 *   computed at seed time, so "now/next" is a plain integer comparison.
 * - Vectors live in Chroma, never here.
 */

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  day: text("day"), // ISO date, e.g. 2026-07-08
  dayNumber: integer("day_number"),
  dayTheme: text("day_theme"), // Enable / Integrate / Design / Build / Demo
  startsAt: integer("starts_at"), // epoch ms (TZ-correct, GMT+7)
  endsAt: integer("ends_at"), // epoch ms
  startTimeLabel: text("start_time_label"), // raw "10:00" for display
  endTimeLabel: text("end_time_label"),
  venueId: text("venue_id"),
  partner: text("partner"), // organizer / host
  track: text("track"), // facet for findWorkshops
  type: text("type"), // workshop | break | signature | ...
  tone: text("tone"), // workshop | break | signature (from bundle_schedule)
  description: text("description"), // markdown
  speakers: text("speakers"), // JSON string[]
  requirements: text("requirements"), // JSON string[]
  registrationUrl: text("registration_url"),
  tags: text("tags"), // JSON string
  qualityLevel: text("quality_level"), // full | partial | summary_only | stale
  sourceUrl: text("source_url"),
  coverImage: text("cover_image"), // local /covers/<id>.png
});

export const venues = sqliteTable("venues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  lat: real("lat"),
  lng: real("lng"),
  mapUrl: text("map_url"), // google_maps_url
  imageUrl: text("image_url"),
});

export const perks = sqliteTable("perks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  provider: text("provider"),
  value: text("value"), // e.g. "$15,000 AI & cloud credits"
  howToClaim: text("how_to_claim"),
  eligibility: text("eligibility"),
  link: text("link"),
  expiresAt: integer("expires_at"), // epoch ms
  sourceUrl: text("source_url"),
});

export const deadlines = sqliteTable("deadlines", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  dueAt: integer("due_at"), // epoch ms (TZ-correct)
  type: text("type"), // submission | rsvp | ...
  link: text("link"),
  sourceUrl: text("source_url"),
});

// -------------------------------------------------------------------------
// Mutable user data — the only tables read/written from Vercel at runtime.
// -------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // stable app user id, from Google account
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  googleSub: text("google_sub").notNull().unique(),
  preferences: text("preferences"), // JSON: skills, topics, team status, language
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  targetId: text("target_id"), // session/deadline id
  targetKind: text("target_kind"), // session | deadline
  fireAt: integer("fire_at"), // epoch ms
  label: text("label"),
  sent: integer("sent").default(0),
  createdAt: integer("created_at").notNull(),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at").notNull(),
});

// -------------------------------------------------------------------------
// Feature tables (Cue Pulse, Checklist, Mentors, Teams). Times are epoch ms
// (GMT+7). Booleans stored as integer 0/1. Vectors still live in Chroma.
// -------------------------------------------------------------------------

/** Cue Pulse — live announcements (schedule changes, room moves, perk drops). */
export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull().default("general"), // schedule | venue | perk | deadline | general
  title: text("title").notNull(),
  body: text("body").notNull(),
  severity: text("severity").notNull().default("info"), // info | important | urgent
  targetId: text("target_id"), // related session/venue/perk/deadline id
  sourceUrl: text("source_url"), // citation — never fabricate
  createdAt: integer("created_at").notNull(),
});

/** Unified checklist: bookmarks + custom tasks + submission-readiness items. */
export const checklistItems = sqliteTable("checklist_items", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  notes: text("notes"),
  completed: integer("completed").notNull().default(0),
  targetId: text("target_id"), // session/deadline/perk id, null for custom
  targetType: text("target_type").notNull().default("custom"), // session|deadline|perk|submission|custom
  fireAt: integer("fire_at"), // push reminder time (epoch ms)
  sent: integer("sent").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Mentors — expertise + availability slots folded in as a JSON array. */
export const mentors = sqliteTable("mentors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title"),
  org: text("org"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  expertise: text("expertise"), // JSON string[]
  slots: text("slots"), // JSON MentorSlot[]: {id, startsAt, endsAt}
  sourceUrl: text("source_url"),
});

/** The single mentor write table — a booked office-hours slot. */
export const officeHoursBookings = sqliteTable("office_hours_bookings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  mentorId: text("mentor_id")
    .notNull()
    .references(() => mentors.id),
  slotId: text("slot_id").notNull(),
  topic: text("topic"),
  createdAt: integer("created_at").notNull(),
});

/** Team room (lean): a team, its members, and a public text-only build log. */
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  lookingFor: text("looking_for"), // JSON string[]
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at").notNull(),
});

export const teamMembers = sqliteTable("team_members", {
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role"),
  joinedAt: integer("joined_at").notNull(),
});

export const buildLogs = sqliteTable("build_logs", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: integer("created_at").notNull(),
});
