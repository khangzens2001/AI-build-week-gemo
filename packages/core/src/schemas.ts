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
