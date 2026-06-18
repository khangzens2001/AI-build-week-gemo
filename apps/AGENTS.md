# apps/ — deployable applications (→ Vercel)

Groups user-facing deployables. Currently only `web/`.

- Everything here ships to **Vercel on the Node runtime** — no Bun-runtime or container assumptions.
- Data/DB access goes through `workers/data-api` or the D1 REST helper; never import `drizzle-orm/d1` here (binding is Worker-only).

See `web/AGENTS.md` for specifics.
