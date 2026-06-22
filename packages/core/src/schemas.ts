import { z } from "zod";

/**
 * Single source of truth for Cue data shapes (plan convention: Zod
 * schemas defined once in @event/core, reused by the seed transform, the
 * bundled snapshot reader, agent `tool().inputSchema`, and API validation).
 *
 * Times are TZ-correct epoch ms (GMT+7) computed at seed time. Vectors live in
 * Chroma; these schemas describe the structured (D1 + snapshot) data only.
 */

export const SessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  day: z.string().nullable().optional(), // ISO date 2026-07-08
  dayNumber: z.number().int().nullable().optional(),
  dayTheme: z.string().nullable().optional(),
  startsAt: z.number().int().nullable().optional(), // epoch ms (GMT+7)
  endsAt: z.number().int().nullable().optional(),
  startTimeLabel: z.string().nullable().optional(),
  endTimeLabel: z.string().nullable().optional(),
  venueId: z.string().nullable().optional(),
  partner: z.string().nullable().optional(),
  track: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  tone: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  speakers: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  registrationUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  qualityLevel: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(), // local /covers/<id>.png (downloaded via fetch:images)
});
export type Session = z.infer<typeof SessionSchema>;

export const VenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  mapUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});
export type Venue = z.infer<typeof VenueSchema>;

export const PerkSchema = z.object({
  id: z.string(),
  title: z.string(),
  provider: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  howToClaim: z.string().nullable().optional(),
  eligibility: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  expiresAt: z.number().int().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
});
export type Perk = z.infer<typeof PerkSchema>;

export const DeadlineSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueAt: z.number().int().nullable().optional(),
  type: z.string().nullable().optional(), // submission | rsvp | ...
  link: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
});
export type Deadline = z.infer<typeof DeadlineSchema>;

/** A retrieval chunk embedded into Chroma. `sourceUrl` powers citations. */
export const RetrievalChunkSchema = z.object({
  id: z.string(),
  type: z.string(), // programme_day | event | faq | perk | devpost_page | ...
  text: z.string(),
  sourceUrl: z.string().nullable().optional(),
});
export type RetrievalChunk = z.infer<typeof RetrievalChunkSchema>;

/**
 * The bundled snapshot the app reads on the hot path (so static reads don't hit
 * D1/Option-B rate limits). Emitted by the seed script alongside the SQL.
 */
export const SnapshotSchema = z.object({
  generatedAt: z.number().int(),
  sessions: z.array(SessionSchema),
  venues: z.array(VenueSchema),
  perks: z.array(PerkSchema),
  deadlines: z.array(DeadlineSchema),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

/** User preferences captured at onboarding (stored as JSON in users.preferences). */
export const UserPreferencesSchema = z.object({
  language: z.enum(["en", "vi"]).default("en"),
  skills: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  teamStatus: z.enum(["solo", "has_team", "looking"]).nullable().default(null),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// ===========================================================================
// New feature schemas (Cue Pulse, Checklist, Demo Coach, Mentors, Teams).
// Single source of truth — reused by API route validation, agent tool
// inputSchema, and the seed. Times are epoch ms (GMT+7) per the time model.
// ===========================================================================

/**
 * Cue Pulse — a live announcement (schedule change, room move, perk drop). The
 * AI summary restates a diff only and MUST carry the source URL so the UI can
 * render a citation; never fabricate facts in `body`.
 */
export const AnnouncementSchema = z.object({
  id: z.string(),
  kind: z.enum(["schedule", "venue", "perk", "deadline", "general"]).default("general"),
  title: z.string(),
  body: z.string(),
  severity: z.enum(["info", "important", "urgent"]).default("info"),
  targetId: z.string().nullable().optional(), // related session/venue/perk/deadline id
  sourceUrl: z.string().nullable().optional(),
  createdAt: z.number().int(),
});
export type Announcement = z.infer<typeof AnnouncementSchema>;

/**
 * Checklist item ("FOMO Killer") — unified bookmarks + custom tasks + submission
 * items. `targetType` discriminates; submission-readiness rows use "submission".
 */
export const ChecklistTargetType = z.enum(["session", "deadline", "perk", "submission", "custom"]);
export type ChecklistTargetType = z.infer<typeof ChecklistTargetType>;

export const ChecklistItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  notes: z.string().nullable().optional(),
  completed: z.boolean().default(false),
  targetId: z.string().nullable().optional(),
  targetType: ChecklistTargetType.default("custom"),
  fireAt: z.number().int().nullable().optional(), // push reminder time (epoch ms)
  sent: z.boolean().default(false),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

/** Pitch Coach — stateless structured review (NOT persisted). generateObject shape. */
export const PitchReviewSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  criteria: z
    .array(
      z.object({
        name: z.string(),
        score: z.number().int().min(0).max(10),
        feedback: z.string(),
      }),
    )
    .default([]),
  fixes: z.array(z.string()).default([]),
  practiceQuestions: z.array(z.string()).default([]),
});
export type PitchReview = z.infer<typeof PitchReviewSchema>;

/** Office-hours slot, stored as JSON inside `mentors.slots`. */
export const MentorSlotSchema = z.object({
  id: z.string(),
  startsAt: z.number().int(), // epoch ms (GMT+7)
  endsAt: z.number().int(),
});
export type MentorSlot = z.infer<typeof MentorSlotSchema>;

/** Mentor — matched by expertise; availability folded in as a slots JSON array. */
export const MentorSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable().optional(),
  org: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  expertise: z.array(z.string()).default([]),
  slots: z.array(MentorSlotSchema).default([]),
  sourceUrl: z.string().nullable().optional(),
});
export type Mentor = z.infer<typeof MentorSchema>;

/** A booked office-hours slot (the only mentor write table). */
export const OfficeHoursBookingSchema = z.object({
  id: z.string(),
  userId: z.string(),
  mentorId: z.string(),
  slotId: z.string(),
  topic: z.string().nullable().optional(),
  createdAt: z.number().int(),
});
export type OfficeHoursBooking = z.infer<typeof OfficeHoursBookingSchema>;

/** Team room — lean: a team, its members, and a public text-only build log. */
export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string().nullable().optional(),
  lookingFor: z.array(z.string()).default([]),
  createdBy: z.string(),
  createdAt: z.number().int(),
});
export type Team = z.infer<typeof TeamSchema>;

export const TeamMemberSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
  role: z.string().nullable().optional(),
  joinedAt: z.number().int(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const BuildLogSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  userId: z.string(),
  body: z.string(),
  createdAt: z.number().int(),
});
export type BuildLog = z.infer<typeof BuildLogSchema>;

// ===========================================================================
// Devpost participants (scraped off-VM via Playwright — see
// packages/ingest/src/devpost/scrape-participants.ts). Public-to-authenticated
// directory data, used only to power the team/mentor copilot. NOT stored in D1;
// it lands as participants.json + RAG chunks + a downloaded avatar per person.
// ===========================================================================

/** Team-status tag shown on a participant card (3 known values, else null). */
export const TeamStatusSchema = z.enum(["Has a team", "Working solo", "Looking for teammates"]);
export type TeamStatus = z.infer<typeof TeamStatusSchema>;

/**
 * One Devpost participant. `avatarUrl` may be "" when the card has no photo.
 * `avatarLocal` is the public-relative path of the downloaded avatar
 * (/participants/<id>.png), null until the avatar pass succeeds — mirrors how
 * Session.coverImage points at a fetch:images-downloaded local file.
 */
export const ParticipantSchema = z.object({
  participantId: z.string(),
  name: z.string(),
  username: z.string(),
  profileUrl: z.string().url(),
  avatarUrl: z.string(), // may be "" (no photo on the card)
  avatarLocal: z.string().nullable().default(null), // /participants/<id>.png once downloaded
  role: z.string().default(""),
  teamStatus: TeamStatusSchema.nullable().default(null),
  projects: z.number().int().default(0),
  followers: z.number().int().default(0),
  achievements: z.number().int().default(0),
  skills: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  scrapedAt: z.string().datetime(),
});
export type Participant = z.infer<typeof ParticipantSchema>;
