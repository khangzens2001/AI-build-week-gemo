/**
 * Transform scraped participants into retrieval chunks for the RAG store.
 * Output shape matches chunks.ts ({ id, type, text, source_url }) so embed.ts's
 * DevpostRawChunkSchema normalizer (source_url → sourceUrl) ingests them the
 * same way as the Devpost page chunks. One chunk per participant — `participant-`
 * ids never collide with the `devpost-` page ids or the event corpus ids.
 *
 * The runner (this file, when executed directly) reads participants.json and
 * writes packages/ingest/data/devpost/participant_retrieval_chunks.json, which
 * embed.ts picks up via PARTICIPANT_CHUNKS_FILE.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Participant, ParticipantSchema } from "@event/core";
import { z } from "zod";

/** Same chunk shape as devpost/chunks.ts, with the participant `type`. */
export interface ParticipantChunk {
  id: string;
  type: "participant";
  text: string;
  source_url: string;
}

/** Build one retrieval chunk per participant (PRD §7.2 text blob). */
export function participantsToChunks(participants: Participant[]): ParticipantChunk[] {
  return participants.map((p) => {
    const text = [
      `Participant: ${p.name}`,
      `Username: ${p.username}`,
      `Role: ${p.role || "Not specified"}`,
      `Team Status: ${p.teamStatus ?? "Not specified"}`,
      `Profile: ${p.profileUrl}`,
      `Projects: ${p.projects}`,
      `Followers: ${p.followers}`,
      `Achievements: ${p.achievements}`,
      p.skills.length > 0 ? `Skills: ${p.skills.join(", ")}` : "",
      p.interests.length > 0 ? `Interests: ${p.interests.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      id: `participant-${p.participantId}`,
      type: "participant",
      text,
      source_url: p.profileUrl,
    };
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
// Raw scraped data lands in packages/core/data (alongside the snapshot); the
// chunks land next to the Devpost page chunks so embed.ts's defaults find them.
const PARTICIPANTS_FILE =
  process.env.PARTICIPANTS_FILE ?? join(repoRoot, "packages", "core", "data", "participants.json");
const CHUNKS_OUT =
  process.env.PARTICIPANT_CHUNKS_FILE ??
  join(repoRoot, "packages", "ingest", "data", "devpost", "participant_retrieval_chunks.json");

/** Standalone runner: participants.json → participant_retrieval_chunks.json. */
function main(): void {
  if (!existsSync(PARTICIPANTS_FILE)) {
    console.error(
      `No participants file at ${PARTICIPANTS_FILE}. Run \`bun run crawl:participants\` first.`,
    );
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(PARTICIPANTS_FILE, "utf8"));
  const participants = z.array(ParticipantSchema).parse(raw);
  const chunks = participantsToChunks(participants);

  mkdirSync(dirname(CHUNKS_OUT), { recursive: true });
  writeFileSync(CHUNKS_OUT, `${JSON.stringify(chunks, null, 2)}\n`, "utf-8");

  console.log(`Wrote ${chunks.length} participant chunk(s) → ${CHUNKS_OUT}`);
}

// Only run when invoked directly (not when imported by the scraper or a test).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
