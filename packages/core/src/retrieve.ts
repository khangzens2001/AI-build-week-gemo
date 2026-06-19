import { embedOne } from "./llm";
import { type SearchHit, search } from "./vector";

/**
 * Hybrid retrieval entry point. Embeds the user query with the same Gemini model
 * + dimension used at seed time, then queries Chroma for the nearest chunks.
 *
 * Every result carries its `sourceUrl` so the chat layer can render citations
 * from tool output (citations are enforced structurally, not by prompt — the
 * model narrates, this layer supplies the links).
 */

export interface RetrievedChunk {
  id: string;
  text: string;
  type: string;
  sourceUrl: string | null;
  distance: number | null;
}

function toRetrieved(hit: SearchHit): RetrievedChunk {
  const meta = hit.metadata ?? {};
  return {
    id: hit.id,
    text: hit.text,
    type: typeof meta.type === "string" ? meta.type : "chunk",
    sourceUrl: typeof meta.sourceUrl === "string" ? meta.sourceUrl : null,
    distance: hit.distance,
  };
}

/** Retrieve the top-k knowledge chunks relevant to a natural-language query. */
export async function retrieve(query: string, k = 6): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const vector = await embedOne(trimmed, "RETRIEVAL_QUERY");
  const hits = await search(vector, k);
  return hits.map(toRetrieved);
}
