# drizzle — D1 schema + migrations

**Responsibility:** Drizzle schema (`schema.ts`) and generated SQL migrations for Cloudflare D1 (SQLite). Spec: plan §8.

## Key facts
- Edit `schema.ts` (uses `drizzle-orm/sqlite-core`), then `bunx drizzle-kit generate`.
- Apply with **wrangler**, not `drizzle-kit push`: `wrangler d1 migrations apply aabw --local` (dev) / `wrangler d1 migrations apply aabw` (remote).
- D1 = SQLite semantics. **Vectors live in Chroma, not here** — this DB holds only structured data (sessions/venues/perks/deadlines/reminders).
