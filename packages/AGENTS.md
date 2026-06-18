# packages/ — shared TypeScript libraries

Not deployed directly; imported by `apps/web`, `workers/data-api`, and scripts.

- Keep code **runtime-agnostic**: anything shared with the Worker must run on both Node/Vercel and Cloudflare Workers — avoid Node-only and Bun-only APIs there.

Members: `core/` (schemas, clients, RAG, tools), `ingest/` (Firecrawl pipeline).
