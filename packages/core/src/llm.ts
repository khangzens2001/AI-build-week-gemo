import { google } from "@ai-sdk/google";
import { type EmbeddingModel, type LanguageModel, embed, embedMany } from "ai";
import { llmConfig } from "./env";

/**
 * LLM + embeddings, isolated here so model ids, the embedding accessor, and the
 * embedding dimension are configured in exactly one place.
 *
 * Notes (verified against @ai-sdk/google v3 / ai v6):
 * - Chat model: `google(<id>)`; provider auto-reads GOOGLE_GENERATIVE_AI_API_KEY.
 * - Embeddings accessor is `google.embedding(<id>)` (renamed from the older
 *   textEmbedding/textEmbeddingModel). If you pin an older provider line, this
 *   is the single line to change.
 * - The embedding DIMENSION is immutable once the Chroma collection exists.
 *   Seed-time and query-time embeddings MUST use the same model + dim.
 */

/** Chat model for the agent (Gemini 3). */
export const chatModel: LanguageModel = google(llmConfig.chatModel);

/** Embedding model (Gemini). */
export const embeddingModel: EmbeddingModel = google.embedding(llmConfig.embedModel);

/** Gemini embedding task types improve retrieval quality when set. */
export type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

function embedProviderOptions(task: EmbedTask) {
  return {
    google: {
      outputDimensionality: llmConfig.embedDim,
      taskType: task,
    },
  };
}

/** L2-normalize a vector (Gemini recommends normalizing when dim < 3072). */
function normalize(vector: number[]): number[] {
  if (llmConfig.embedDim >= 3072) return vector;
  let sumSq = 0;
  for (const v of vector) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  return norm > 0 ? vector.map((v) => v / norm) : vector;
}

/** Embed a single value (defaults to query task — used at retrieval time). */
export async function embedOne(
  value: string,
  task: EmbedTask = "RETRIEVAL_QUERY",
): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value,
    providerOptions: embedProviderOptions(task),
  });
  return normalize(embedding);
}

/** Embed many values in one batch (defaults to document task — used at seed time). */
export async function embedAll(
  values: string[],
  task: EmbedTask = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values,
    providerOptions: embedProviderOptions(task),
  });
  return embeddings.map(normalize);
}
