import { defineConfig } from "drizzle-kit";

/**
 * D1 over HTTP (Option B). drizzle-kit talks to Cloudflare's REST API using an
 * API token with D1 edit permission. Migrations generated here are applied with
 * `wrangler d1 migrations apply aabw` (see package.json scripts).
 */
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.D1_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_API_TOKEN ?? "",
  },
});
