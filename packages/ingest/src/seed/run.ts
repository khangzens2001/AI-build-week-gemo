/**
 * Seed runner — reads the raw AABW crawl, runs the pure transforms, validates
 * every row against the @event/core Zod schemas, then writes:
 *   - packages/core/data/snapshot.json  (SnapshotSchema-shaped, app hot path)
 *   - packages/core/data/chunks.json    (RetrievalChunk[] for the P3 embed step)
 *   - drizzle/seed.sql                   (DELETE + INSERT batch for D1)
 *
 * Run with: `bun run src/seed/run.ts` (wired as `bun run seed`).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type Deadline,
  DeadlineSchema,
  type Perk,
  PerkSchema,
  type RetrievalChunk,
  RetrievalChunkSchema,
  type Session,
  SessionSchema,
  SnapshotSchema,
  type Venue,
  VenueSchema,
} from "@event/core";
import { z } from "zod";

import {
  type RawBuilderTrack,
  type RawBundleDay,
  type RawEvent,
  type RawFaq,
  type RawLocation,
  type RawProgrammeDay,
  type RawRegistrationLinks,
  type RawRetrievalChunk,
  buildChunks,
  buildDeadlines,
  buildPerks,
  buildSessions,
  buildVenues,
} from "./transform";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", ".."); // packages/ingest/src/seed → repo
// Input crawl JSON dir. Defaults to the in-repo crawl output, but can be pointed
// at a mounted crawl-data volume (`CRAWL_LATEST_DIR`) by the VM auto-ingest loop,
// where the repo is mounted read-only and the fresh crawl lives on a volume.
const dataDir = process.env.CRAWL_LATEST_DIR ?? join(repoRoot, "craw_data1", "data", "latest");
const coreDataDir = join(repoRoot, "packages", "core", "data");
const drizzleDir = join(repoRoot, "drizzle");

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(dataDir, file), "utf8")) as T;
}

// ---------------------------------------------------------------------------
// SQL emit helpers
// ---------------------------------------------------------------------------

type SqlValue = string | number | boolean | null | undefined | string[];

function sqlLiteral(value: SqlValue): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = Array.isArray(value) ? JSON.stringify(value) : value;
  return `'${text.replace(/'/g, "''")}'`;
}

function insertRows(table: string, columns: string[], rows: SqlValue[][]): string {
  if (rows.length === 0) return `DELETE FROM ${table};\n`;
  const lines = [`DELETE FROM ${table};`];
  for (const row of rows) {
    lines.push(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${row.map(sqlLiteral).join(", ")});`,
    );
  }
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // --- read inputs ---
  const events = readJson<RawEvent[]>("events.json");
  const bundle = readJson<RawBundleDay[]>("bundle_schedule.json");
  const programmeDays = readJson<RawProgrammeDay[]>("programme_days.json");
  const locations = readJson<RawLocation[]>("locations.json");
  const registration = readJson<RawRegistrationLinks>("registration_links.json");
  const retrievalChunks = readJson<RawRetrievalChunk[]>("retrieval_chunks.json");
  const builderTrack = readJson<RawBuilderTrack>("builder_experience_track.json");
  const faq = readJson<RawFaq>("section_faq.json");

  // --- transform ---
  const allVenues: Venue[] = buildVenues(locations, bundle);
  const sessions: Session[] = buildSessions(events, bundle, programmeDays);
  const perks: Perk[] = buildPerks(events, builderTrack);
  const deadlines: Deadline[] = buildDeadlines(events, bundle, programmeDays, registration);
  const chunks: RetrievalChunk[] = buildChunks(retrievalChunks, events, builderTrack, faq);

  // Drop orphan venues no session references (e.g. stale city-only location rows)
  // so the map/venues list only shows real, attended venues.
  const referencedVenueIds = new Set(sessions.map((s) => s.venueId).filter(Boolean));
  const venues: Venue[] = allVenues.filter((v) => referencedVenueIds.has(v.id));

  // --- validate (throws on failure) ---
  const validVenues = z.array(VenueSchema).parse(venues);
  const validSessions = z.array(SessionSchema).parse(sessions);
  const validPerks = z.array(PerkSchema).parse(perks);
  const validDeadlines = z.array(DeadlineSchema).parse(deadlines);
  const validChunks = z.array(RetrievalChunkSchema).parse(chunks);

  // --- snapshot.json ---
  const snapshot = SnapshotSchema.parse({
    generatedAt: Date.now(),
    sessions: validSessions,
    venues: validVenues,
    perks: validPerks,
    deadlines: validDeadlines,
  });
  mkdirSync(coreDataDir, { recursive: true });
  writeFileSync(join(coreDataDir, "snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`);

  // --- chunks.json ---
  writeFileSync(join(coreDataDir, "chunks.json"), `${JSON.stringify(validChunks, null, 2)}\n`);

  // --- seed.sql ---
  const sessionSql = insertRows(
    "sessions",
    [
      "id",
      "title",
      "day",
      "day_number",
      "day_theme",
      "starts_at",
      "ends_at",
      "start_time_label",
      "end_time_label",
      "venue_id",
      "partner",
      "track",
      "type",
      "tone",
      "description",
      "speakers",
      "requirements",
      "registration_url",
      "tags",
      "quality_level",
      "source_url",
      "cover_image",
    ],
    validSessions.map((s) => [
      s.id,
      s.title,
      s.day ?? null,
      s.dayNumber ?? null,
      s.dayTheme ?? null,
      s.startsAt ?? null,
      s.endsAt ?? null,
      s.startTimeLabel ?? null,
      s.endTimeLabel ?? null,
      s.venueId ?? null,
      s.partner ?? null,
      s.track ?? null,
      s.type ?? null,
      s.tone ?? null,
      s.description ?? null,
      JSON.stringify(s.speakers ?? []),
      JSON.stringify(s.requirements ?? []),
      s.registrationUrl ?? null,
      JSON.stringify(s.tags ?? []),
      s.qualityLevel ?? null,
      s.sourceUrl ?? null,
      s.coverImage ?? null,
    ]),
  );

  const venueSql = insertRows(
    "venues",
    ["id", "name", "address", "city", "country", "lat", "lng", "map_url", "image_url"],
    validVenues.map((v) => [
      v.id,
      v.name,
      v.address ?? null,
      v.city ?? null,
      v.country ?? null,
      v.lat ?? null,
      v.lng ?? null,
      v.mapUrl ?? null,
      v.imageUrl ?? null,
    ]),
  );

  const perkSql = insertRows(
    "perks",
    [
      "id",
      "title",
      "provider",
      "value",
      "how_to_claim",
      "eligibility",
      "link",
      "expires_at",
      "source_url",
    ],
    validPerks.map((p) => [
      p.id,
      p.title,
      p.provider ?? null,
      p.value ?? null,
      p.howToClaim ?? null,
      p.eligibility ?? null,
      p.link ?? null,
      p.expiresAt ?? null,
      p.sourceUrl ?? null,
    ]),
  );

  const deadlineSql = insertRows(
    "deadlines",
    ["id", "title", "due_at", "type", "link", "source_url"],
    validDeadlines.map((d) => [
      d.id,
      d.title,
      d.dueAt ?? null,
      d.type ?? null,
      d.link ?? null,
      d.sourceUrl ?? null,
    ]),
  );

  const sql = `-- AABW Cue seed data. Generated by packages/ingest/src/seed/run.ts.
-- Do not edit by hand; re-run \`bun run seed\` to regenerate.

${venueSql}
${sessionSql}
${perkSql}
${deadlineSql}`;
  writeFileSync(join(drizzleDir, "seed.sql"), sql);

  // --- report ---
  console.log("Seed transform complete:");
  console.log(`  sessions:  ${validSessions.length}`);
  console.log(`  venues:    ${validVenues.length}`);
  console.log(`  perks:     ${validPerks.length}`);
  console.log(`  deadlines: ${validDeadlines.length}`);
  console.log(`  chunks:    ${validChunks.length}`);
  console.log("Wrote:");
  console.log(`  ${join(coreDataDir, "snapshot.json")}`);
  console.log(`  ${join(coreDataDir, "chunks.json")}`);
  console.log(`  ${join(drizzleDir, "seed.sql")}`);
}

main();
