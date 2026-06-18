# packages/core — schemas, clients, RAG, agent tools

**Responsibility:** single source of truth for Zod schemas/types and the `llm`, `vector`, `d1` clients, plus `retrieve()` and agent tool definitions.

## Key facts
- `llm.ts`: `google(process.env.GEMINI_CHAT_MODEL)` for chat; `embed`/`embedMany` (AI SDK v5) for embeddings. Plan §10.1.
- `vector.ts`: `CloudClient()` when `CHROMA_API_KEY` set, else `ChromaClient({host,port})`. **BYO embeddings** — compute with Gemini and pass `embeddings` arrays to `add`/`query`. Plan §10.5.
- `d1.ts`: REST helper (Option B). For Option A, call the Worker instead.
- **Runtime-agnostic** — also imported by the Worker; no Node/Bun-only APIs.
- Define Zod schemas here once; reused by Firecrawl `extract`, `tool().inputSchema`, and API validation.
