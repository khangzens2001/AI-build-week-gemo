# AGENTS.md — Event Copilot (AABW Builder Experience Award)

## Status
Pre-implementation. The repo currently contains planning/docs only:
- `Builder-Experience-Award-Brief.md` — hackathon brief (requirements, dates, judging).
- `Event-Copilot-Build-Checklist.md` — **canonical build spec** (architecture, verified API snippets, phases). Treat as source of truth; keep code and this spec in sync.
- `README.md` — Vietnamese product/architecture overview with Mermaid charts.

No source code, git repo, or package manifests exist yet. The folder tree below is scaffolding for the planned monorepo; each folder has its own `AGENTS.md` with specifics.

## What we're building
A mobile-first **PWA "Event Copilot"** for Agentic AI Build Week that answers *"what's on now / where / what next"* with **Hybrid RAG + agent actions** (reminders, directions, perks).

## Stack (chosen — do not silently swap)
Bun (toolchain) · Next.js App Router (→ Vercel) · **Vercel AI SDK v5 + Gemini 3** (`@ai-sdk/google`) · Cloudflare **D1** + Drizzle · **Chroma** (vector) · **Firecrawl** (ingest) · **Podman** (local) · Vercel (deploy).

## Monorepo map (planned) + deploy target
| Path | Owns | Deploys to |
|---|---|---|
| `apps/web` | Next.js PWA + API routes + chat/agent | **Vercel** (Node runtime) |
| `workers/data-api` | CF Worker: D1 binding + Drizzle + cron ingest | **Cloudflare** (wrangler) |
| `packages/core` | Zod schemas, types, llm/vector/d1 clients, RAG, agent tools | library |
| `packages/ingest` | Firecrawl pipeline | library / run by Worker or script |
| `drizzle` | D1 schema + migrations | applied via wrangler |
| `infra` | Podman: local Chroma + reproducible env | **local only** |

## Critical gotchas (these WILL bite — verified via Context7)
- **Bun is toolchain only.** Vercel Functions run **Node/Edge**, not Bun. Use Bun for install/scripts/test/dev; don't ship Bun-only APIs (e.g. `bun:sqlite`) in deployed code.
- **D1 has no binding from Vercel.** Reach D1 via the `workers/data-api` Worker (**Option A, preferred**) or the D1 **REST API** (Option B — hits the global Cloudflare API rate limit, demo scale only). `drizzle-orm/d1` works **only inside the Worker**.
- **Chroma is not in-process.** Prod = Chroma Cloud (`CloudClient()`); local = Chroma server via Podman (`ChromaClient({host,port})`). Never expect embedded Chroma on Vercel.
- **Podman is dev-only.** Vercel builds from source (no container deploy); the Worker deploys via `wrangler`. Don't put Podman in the deploy path.
- **AI SDK is v5, not v4.** Use `tool({ inputSchema })` (not `parameters`), `stopWhen: stepCountIs(n)` (not `maxSteps`), `streamText(...).toUIMessageStreamResponse()`, `useChat` from `@ai-sdk/react`, and render `message.parts`.
- **Gemini 3 model ids are preview + env-driven.** Use `@ai-sdk/google`; set model via `GEMINI_CHAT_MODEL` (e.g. `gemini-3-pro-preview` / `gemini-3-flash`) — confirm current id at ai.google.dev/gemini-api/docs/gemini-3. `thinkingLevel` **defaults to `high`**; set `low` for snappy copilot replies.
- **Embedding accessor varies by provider version:** try `google.textEmbedding(...)`, fall back to `google.textEmbeddingModel(...)`.
- **RAG must cite sources / never fabricate** — this rule is baked into the agent system prompt; preserve it.

## Commands (intended — see plan §15; nothing is scaffolded yet)
- Install: `bun install`
- App dev: `bun run dev` (in `apps/web`) · Worker dev: `wrangler dev` (in `workers/data-api`)
- DB: `bunx drizzle-kit generate` → `wrangler d1 migrations apply aabw --local`
- Local Chroma: `podman run -d --name chroma -p 8000:8000 docker.io/chromadb/chroma:latest`
- Verify order: `bunx biome check . && bunx tsc --noEmit && bun test`
- Deploy: `wrangler deploy` (Worker) **then** `vercel deploy --prod` (app)

## Env (keys; full list in plan §9)
`GOOGLE_GENERATIVE_AI_API_KEY` (auto-read by `@ai-sdk/google`), `GEMINI_CHAT_MODEL`, `GEMINI_EMBED_MODEL`, `FIRECRAWL_API_KEY`, Chroma (`CHROMA_API_KEY`/`CHROMA_TENANT`/`CHROMA_DATABASE` **or** `CHROMA_HOST`/`CHROMA_PORT`), D1 (`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`/`D1_DATABASE_ID`), `VAPID_*`.

## Conventions
- **Zod schemas defined once in `packages/core`**, reused by Firecrawl `extract`, AI SDK `tool().inputSchema`, and API validation.
- Lint/format = **Biome** (not ESLint/Prettier). Tests = `bun test`.
- Plan priority labels: 🔴 must-have · 🟡 nice · 🟢 stretch.
