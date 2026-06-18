# workers/data-api — D1 Data API + ingest cron (Cloudflare)

**Responsibility:** the only component with a real D1 binding (`env.DB`). Exposes a typed read API for the Vercel app and runs scheduled Firecrawl ingest.

## Key facts
- Use `drizzle(env.DB, { schema })` from **`drizzle-orm/d1`** — this binding does not exist outside Workers.
- Authenticate incoming requests with `DATA_API_TOKEN` (the Vercel app sends `Authorization: Bearer`).
- `scheduled()` handler = cron ingest; configure `[triggers] crons` in `wrangler.toml`. Spec: plan §10.7.
- Bindings + `database_id` live in `wrangler.toml` (`[[d1_databases]] binding = "DB"`).
- Local: `wrangler dev`. Deploy: `wrangler deploy`.
- Apply migrations from `/drizzle`: `wrangler d1 migrations apply aabw`.
