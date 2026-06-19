/**
 * Local D1 HTTP shim (DEV ONLY) — a tiny `bun:sqlite` server that speaks the
 * same `{ sql, params } → { success, result:[{ results }], errors }` contract as
 * the Cloudflare D1 REST API. Point the app at it with
 * `D1_LOCAL_URL=http://localhost:8787/query` so the full user-data loop
 * (reminders / push / preferences) runs offline via CLI — no Cloudflare account.
 *
 * `bun:sqlite` is Bun-only and intentionally used here: this is a dev toolchain
 * script, never deployed (deployed code uses the REST path in packages/core/d1.ts).
 *
 * Usage:  bun run scripts/d1-local.ts            (db file: .local/d1.sqlite)
 *         D1_LOCAL_DB=/tmp/x.sqlite D1_LOCAL_PORT=8787 bun run scripts/d1-local.ts
 */

import { Database } from "bun:sqlite";
import { localDbPath } from "./local-db-path";

const dbPath = localDbPath();
const port = Number(process.env.D1_LOCAL_PORT ?? 8787);

const db = new Database(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
// Match D1, which enforces foreign keys (bun:sqlite defaults them OFF) so a bad
// FK fails locally exactly as it would in production.
db.exec("PRAGMA foreign_keys = ON;");

type Body = { sql?: unknown; params?: unknown };

/** D1 .bind() only accepts string | number | null (+ booleans as 0/1). Reject the rest. */
function normalizeParams(params: unknown): (string | number | null)[] {
  if (params == null) return [];
  if (!Array.isArray(params)) throw new Error("params must be an array");
  return params.map((p) => {
    if (p === null || typeof p === "string" || typeof p === "number") return p;
    if (typeof p === "boolean") return p ? 1 : 0;
    throw new Error(`unsupported param type: ${typeof p}`);
  });
}

const server = Bun.serve({
  port,
  // Loopback only — this is an unauthenticated arbitrary-SQL dev endpoint and
  // must never be reachable from the LAN (e.g. shared conference wifi).
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, db: dbPath });
    }
    if (req.method !== "POST" || url.pathname !== "/query") {
      return new Response("Not found", { status: 404 });
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return Response.json({ success: false, errors: [{ message: "invalid json" }] });
    }

    if (typeof body.sql !== "string") {
      return Response.json({ success: false, errors: [{ message: "sql must be a string" }] });
    }

    try {
      const params = normalizeParams(body.params);
      // Single-statement-per-request by design: `db.query(sql)` is a prepared
      // statement and runs only the FIRST statement of a multi-statement string.
      // The app always sends one parameterized statement; batch SQL (migrations,
      // seed) goes through db.exec in db-reset-local.ts, never here.
      // `.all()` works for SELECT (rows) and writes (empty array) alike.
      const results = db.query(body.sql).all(...params);
      // Match the D1 REST shape the client parser expects.
      return Response.json({ success: true, result: [{ results, success: true }] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ success: false, errors: [{ message }] });
    }
  },
});

console.log(`[d1-local] sqlite shim on http://127.0.0.1:${server.port}/query  (db: ${dbPath})`);
