# packages/ingest — Firecrawl pipeline

**Responsibility:** `map` → `crawl`/`scrape` → `extract` (Zod schema) → normalize/dedupe → upsert D1 + embed → upsert Chroma. Spec: plan §3, §10.

## Key facts
- `extract` **must** use a Zod schema (reuse from `packages/core`) for stable JSON.
- Runs either as a script (`bun run ingest`) or inside the Worker `scheduled()` handler.
- `firecrawl monitor` watches the schedule page → triggers re-ingest + Web Push on change.
- Keep a **mock-data fallback** — source sites may block crawling and demos must not depend on network.
