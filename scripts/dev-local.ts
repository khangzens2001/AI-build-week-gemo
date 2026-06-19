/**
 * One-shot local dev bootstrap (CLI-only, no Cloudflare/Vercel account):
 *   1. start Chroma (Podman) if not already up
 *   2. regenerate the snapshot + seed.sql from the bundled crawl
 *   3. reset the local D1 sqlite (migrate + seed) the shim will serve
 *   4. print which keys are still required, then hand off
 *
 * After this finishes, run the two long-lived processes (separate terminals or
 * a multiplexer), since this script intentionally does NOT background them:
 *   bun run d1:local      # local D1 sqlite HTTP shim on :8787
 *   bun --filter @event/web dev   # Next.js on :3000  (set D1_LOCAL_URL in .env.local)
 *
 * Usage:  bun run scripts/dev-local.ts
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./local-db-path";

const root = repoRoot();

function run(cmd: string[], opts: { cwd?: string; allowFail?: boolean } = {}): void {
  console.log(`\n$ ${cmd.join(" ")}`);
  const res = spawnSync(cmd[0]!, cmd.slice(1), {
    cwd: opts.cwd ?? root,
    stdio: "inherit",
  });
  if (res.status !== 0 && !opts.allowFail) {
    console.error(`Command failed: ${cmd.join(" ")}`);
    process.exit(res.status ?? 1);
  }
}

// 1. Chroma (idempotent: start existing container, else create).
console.log("== 1/4  Chroma (Podman) ==");
const started = spawnSync("podman", ["start", "chroma"], { stdio: "ignore" });
if (started.status !== 0) {
  run([
    "podman",
    "run",
    "-d",
    "--name",
    "chroma",
    "-p",
    "8000:8000",
    "docker.io/chromadb/chroma:latest",
  ]);
} else {
  console.log("chroma container already present — started.");
}

// 2. Snapshot + seed.sql from the bundled crawl (deterministic, offline).
console.log("\n== 2/4  Seed transform ==");
run(["bun", "run", "packages/ingest/src/seed/run.ts"]);

// 3. Local D1 sqlite: migrate + seed.
console.log("\n== 3/4  Local D1 (bun:sqlite) reset ==");
run(["bun", "run", "scripts/db-reset-local.ts"]);

// 4. Key check + handoff.
console.log("\n== 4/4  Env check ==");
const envPath = join(root, "apps", "web", ".env.local");
if (!existsSync(envPath)) {
  console.warn("⚠ apps/web/.env.local not found — copy .env.example and fill keys.");
} else {
  const env = readFileSync(envPath, "utf8");
  const needs: Array<[string, string]> = [
    ["AUTH_SECRET", "sign-in (generate: npx auth secret)"],
    ["GOOGLE_GENERATIVE_AI_API_KEY", "chat + embeddings"],
    ["AUTH_GOOGLE_ID", "Google sign-in"],
    ["D1_LOCAL_URL", "local D1 shim (set to http://localhost:8787/query)"],
  ];
  for (const [key, why] of needs) {
    const m = new RegExp(`^${key}=(.*)$`, "m").exec(env);
    const val = m?.[1]?.split("#")[0]?.trim() ?? "";
    const ok = val && !val.startsWith("TODO");
    console.log(`  ${ok ? "✓" : "•"} ${key}${ok ? "" : `  — needed for ${why}`}`);
  }
}

console.log(
  "\nReady. Now run in two terminals:\n" +
    "  bun run d1:local\n" +
    "  bun --filter @event/web dev\n" +
    "(ensure D1_LOCAL_URL=http://localhost:8787/query is set in apps/web/.env.local)\n",
);
