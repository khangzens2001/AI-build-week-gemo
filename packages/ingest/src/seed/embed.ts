/**
 * Embed step (P3) — reads the retrieval chunks produced by the seed transform,
 * embeds them with Gemini (same model + dimension used at query time, via
 * @event/core), and upserts them into Chroma as BYO-embedding documents.
 *
 * Prereqs:
 *   - GOOGLE_GENERATIVE_AI_API_KEY set (embedding calls).
 *   - A reachable Chroma server (local Podman `bun run chroma:up`, or Chroma
 *     Cloud env). The collection's dimension is fixed on first insert, so this
 *     MUST run with the same GEMINI_EMBED_DIM every time.
 *   - `bun run seed` has been run first (produces packages/core/data/chunks.json).
 *
 * Run with: `bun run src/seed/embed.ts` (wired as `bun run embed`).
 */

import { readFileSync } from "node:fs";
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

/** Embed in batches so a large corpus stays within a single request's limits. */
const BATCH_SIZE = 96;

async function main(): Promise<void> {
  const raw = JSON.parse(readFileSync(chunksFile, "utf8"));
  const chunks: RetrievalChunk[] = z.array(RetrievalChunkSchema).parse(raw);

  if (chunks.length === 0) {
    console.error("No chunks to embed. Run `bun run seed` first.");
    process.exit(1);
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
