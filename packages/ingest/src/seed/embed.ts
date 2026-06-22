/**
 * Embed step (P3) — reads the retrieval chunks produced by the seed transform,
 * embeds them with Gemini (same model + dimension used at query time, via
 * @event/core), and upserts them into Chroma as BYO-embedding documents.
 *
 * Sources (all optional, merged + deduped by id):
 *   1. packages/core/data/chunks.json — the event seed corpus (camelCase
 *      `sourceUrl`, already shaped like RetrievalChunkSchema).
 *   2. The Devpost scrape output `retrieval_chunks.json` (snake_case
 *      `source_url`, type `devpost_page`). Path defaults to
 *      packages/ingest/data/devpost/retrieval_chunks.json but can be pointed at
 *      a mounted volume via DEVPOST_CHUNKS_FILE (used by infra/vm/devpost-ingest.sh).
 *   3. The participants scrape output `participant_retrieval_chunks.json`
 *      (snake_case `source_url`, type `participant`). Path defaults to
 *      packages/ingest/data/devpost/participant_retrieval_chunks.json,
 *      overridable via PARTICIPANT_CHUNKS_FILE. Ids are `participant-*` so they
 *      never collide with the `devpost-*` page ids or the event corpus.
 *   A missing file is simply skipped — the event-only path still works when the
 *   Devpost scrape has never run, and the Devpost sweep still works when only its
 *   chunks are present. We error only if ALL sources are absent/empty.
 *
 * Prereqs:
 *   - GOOGLE_GENERATIVE_AI_API_KEY set (embedding calls).
 *   - A reachable Chroma server (local Podman `bun run chroma:up`, or Chroma
 *     Cloud env). The collection's dimension is fixed on first insert, so this
 *     MUST run with the same GEMINI_EMBED_DIM every time.
 *   - `bun run seed` (event corpus) and/or `bun run ingest:devpost` (Devpost)
 *     has been run first.
 *
 * Run with: `bun run src/seed/embed.ts` (wired as `bun run embed`).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type RetrievalChunk,
  RetrievalChunkSchema,
  type UpsertDoc,
  chromaConfig,
  embedAll,
  llmConfig,
  upsertDocs,
} from "@event/core";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const chunksFile = join(repoRoot, "packages", "core", "data", "chunks.json");
// Devpost scrape output. Overridable so the VM sweep can point at the mounted
// `devpost-data` volume (see infra/vm/devpost-ingest.sh).
const devpostChunksFile =
  process.env.DEVPOST_CHUNKS_FILE ??
  join(repoRoot, "packages", "ingest", "data", "devpost", "retrieval_chunks.json");
// Participants scrape output (scrape-participants.ts → transform-participants.ts).
// Overridable like the Devpost file so the VM sweep can point at a mounted volume.
const participantChunksFile =
  process.env.PARTICIPANT_CHUNKS_FILE ??
  join(repoRoot, "packages", "ingest", "data", "devpost", "participant_retrieval_chunks.json");

/**
 * The Devpost scraper emits chunks with snake_case `source_url` (chunks.ts),
 * whereas RetrievalChunkSchema uses camelCase `sourceUrl`. Parse the raw shape
 * here, then normalize the key when merging.
 */
const DevpostRawChunkSchema = z.object({
  id: z.string(),
  type: z.string(),
  text: z.string(),
  source_url: z.string().nullable().optional(),
});

/** Embed in batches so a large corpus stays within a single request's limits. */
const BATCH_SIZE = 96;

/** Read + validate a RetrievalChunk[] JSON file, or [] if it doesn't exist. */
function readEventChunks(file: string): RetrievalChunk[] {
  if (!existsSync(file)) {
    console.log(`No event chunks at ${file} — skipping.`);
    return [];
  }
  const raw = JSON.parse(readFileSync(file, "utf8"));
  return z.array(RetrievalChunkSchema).parse(raw);
}

/** Read the Devpost scrape output (snake_case), normalizing source_url→sourceUrl. */
function readDevpostChunks(file: string): RetrievalChunk[] {
  if (!existsSync(file)) {
    console.log(`No Devpost chunks at ${file} — skipping.`);
    return [];
  }
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const parsed = z.array(DevpostRawChunkSchema).parse(raw);
  return parsed.map((c) =>
    RetrievalChunkSchema.parse({
      id: c.id,
      type: c.type, // keep `devpost_page`
      text: c.text,
      sourceUrl: c.source_url ?? null,
    }),
  );
}

async function main(): Promise<void> {
  // Merge both sources, deduping by id. Devpost ids are prefixed `devpost-...`
  // so they never collide with event ids, but dedupe defensively anyway: the
  // first writer (event corpus) wins on any id clash.
  const byId = new Map<string, RetrievalChunk>();
  for (const c of readEventChunks(chunksFile)) {
    if (!byId.has(c.id)) byId.set(c.id, c);
  }
  let devpostCount = 0;
  for (const c of readDevpostChunks(devpostChunksFile)) {
    if (!byId.has(c.id)) {
      byId.set(c.id, c);
      devpostCount++;
    }
  }
  // Participant chunks share the snake_case shape (id/type/text/source_url), so
  // the same normalizer applies. `participant-*` ids never collide above.
  let participantCount = 0;
  for (const c of readDevpostChunks(participantChunksFile)) {
    if (!byId.has(c.id)) {
      byId.set(c.id, c);
      participantCount++;
    }
  }
  const chunks: RetrievalChunk[] = [...byId.values()];

  if (chunks.length === 0) {
    console.error(
      "No chunks to embed. Run `bun run seed`, `bun run ingest:devpost`, and/or `bun run crawl:participants` first.",
    );
    process.exit(1);
  }

  if (devpostCount > 0) {
    console.log(`Including ${devpostCount} Devpost chunk(s) from ${devpostChunksFile}`);
  }
  if (participantCount > 0) {
    console.log(`Including ${participantCount} participant chunk(s) from ${participantChunksFile}`);
  }

  console.log(
    `Embedding ${chunks.length} chunks with ${llmConfig.embedModel} (dim ${llmConfig.embedDim}) → ` +
      `Chroma collection "${chromaConfig.collection}" (${chromaConfig.isCloud ? "cloud" : `${chromaConfig.host}:${chromaConfig.port}`})`,
  );

  let upserted = 0;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const vectors = await embedAll(
      batch.map((c) => c.text),
      "RETRIEVAL_DOCUMENT",
    );

    const docs: UpsertDoc[] = batch.map((c, j) => ({
      id: c.id,
      text: c.text,
      vector: vectors[j] ?? [],
      metadata: { type: c.type, sourceUrl: c.sourceUrl ?? null },
    }));

    await upsertDocs(docs);
    upserted += docs.length;
    console.log(`  upserted ${upserted}/${chunks.length}`);
  }

  console.log(`Done. ${upserted} chunks embedded + upserted into Chroma.`);
}

main().catch((err) => {
  console.error("Embed failed:", err instanceof Error ? err.message : err);
  console.error(
    "Hint: ensure Chroma is running (`bun run chroma:up`) and GOOGLE_GENERATIVE_AI_API_KEY is set.",
  );
  process.exit(1);
});
