import { ChromaClient, CloudClient } from "chromadb";
import { chromaConfig } from "./env";

/**
 * Chroma vector store (BYO embeddings — we always pass precomputed Gemini
 * vectors and never attach an embedding function to the collection).
 *
 * Verified against chromadb v3:
 * - `new CloudClient()` (no args) reads CHROMA_API_KEY / CHROMA_TENANT /
 *   CHROMA_DATABASE; `new ChromaClient({ host, port })` for local (Podman).
 * - Create the collection WITHOUT an embedding function and always pass
 *   `embeddings` / `queryEmbeddings`.
 * - Query results are column-major and batched per query:
 *   `documents[0][i]`, `metadatas[0][i]`, `distances[0][i]`.
 */

export type ChunkMetadata = Record<string, string | number | boolean | null>;

export interface SearchHit {
  id: string;
  text: string;
  metadata: ChunkMetadata;
  distance: number | null;
}

/**
 * No-op embedding function. We always supply precomputed Gemini vectors, so the
 * collection never needs to embed text itself. Providing this explicitly stops
 * chromadb v3 from trying to instantiate its optional `DefaultEmbeddingFunction`
 * (which requires the uninstalled `@chroma-core/default-embed` package and logs
 * noisy errors). If it is ever called, that's a bug — fail loudly.
 */
const byoEmbeddingFunction = {
  name: "byo-precomputed",
  generate(_texts: string[]): Promise<number[][]> {
    return Promise.reject(
      new Error("BYO embeddings: pass precomputed vectors; text embedding is not configured."),
    );
  },
};

// Chroma clients are synchronous to construct; methods are async.
let client: ChromaClient | CloudClient | null = null;

function getClient(): ChromaClient | CloudClient {
  if (client) return client;
  client = chromaConfig.isCloud
    ? new CloudClient()
    : new ChromaClient({ host: chromaConfig.host, port: chromaConfig.port });
  return client;
}

async function getCollection() {
  return getClient().getOrCreateCollection({
    name: chromaConfig.collection,
    // biome-ignore lint/suspicious/noExplicitAny: chromadb's EF type is internal; this no-op satisfies it
    embeddingFunction: byoEmbeddingFunction as any,
  });
}

export interface UpsertDoc {
  id: string;
  text: string;
  metadata: ChunkMetadata;
  vector: number[];
}

/** Upsert precomputed-embedding documents into the collection. */
export async function upsertDocs(items: UpsertDoc[]): Promise<void> {
  if (items.length === 0) return;
  const col = await getCollection();
  await col.add({
    ids: items.map((i) => i.id),
    embeddings: items.map((i) => i.vector),
    documents: items.map((i) => i.text),
    metadatas: items.map((i) => i.metadata),
  });
}

/**
 * Query the collection with a precomputed query vector. Flattens Chroma's
 * column-major, per-query batched result into a simple SearchHit[].
 */
export async function search(vector: number[], k = 6): Promise<SearchHit[]> {
  const col = await getCollection();
  const res = await col.query({ queryEmbeddings: [vector], nResults: k });

  const ids = res.ids?.[0] ?? [];
  const docs = res.documents?.[0] ?? [];
  const metas = res.metadatas?.[0] ?? [];
  const dists = res.distances?.[0] ?? [];

  return ids.map((id, i) => ({
    id,
    text: docs[i] ?? "",
    metadata: (metas[i] ?? {}) as ChunkMetadata,
    distance: dists[i] ?? null,
  }));
}
