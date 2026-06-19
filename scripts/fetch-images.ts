/**
 * Image downloader (DEV step, network — NOT part of `bun run seed`). Fetches the
 * remote session covers + venue images into apps/web/public/ so the PWA serves
 * them locally (self-contained, no runtime third-party CDN dependency). The
 * remote→local mapping is the single source of truth in the seed transform
 * (`imageSources`), so this never drifts from what the snapshot references.
 *
 * Run with: bun run scripts/fetch-images.ts   (wired as `bun run fetch:images`)
 * Commit the resulting files. Idempotent: re-fetches + overwrites.
 *
 * Guards (per review): https only, host-pinned to known sources, assert an
 * image content-type, cap response size.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { imageSources } from "../packages/ingest/src/seed/transform";

const repoRoot = resolve(import.meta.dir, "..");
const dataDir = join(repoRoot, "craw_data1", "data", "latest");
const publicDir = join(repoRoot, "apps", "web", "public");

const ALLOWED_HOSTS = new Set(["images.lumacdn.com", "agenticaibuildweek.genaifund.ai"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB ceiling per image

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(dataDir, file), "utf8")) as T;
}

async function download(remote: string, local: string): Promise<"ok" | "skip" | "fail"> {
  const url = new URL(remote);
  if (url.protocol !== "https:") {
    console.warn(`  [skip] non-https: ${remote}`);
    return "skip";
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    console.warn(`  [skip] host not allowed: ${url.hostname}`);
    return "skip";
  }

  const res = await fetch(remote);
  if (!res.ok) {
    console.error(`  [fail] ${res.status} ${remote}`);
    return "fail";
  }
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.startsWith("image/")) {
    console.error(`  [fail] not an image (${ctype}): ${remote}`);
    return "fail";
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    console.error(`  [fail] too large (${buf.byteLength}b): ${remote}`);
    return "fail";
  }

  // `local` is a public-relative path like "/covers/day01-byteplus.png".
  const dest = join(publicDir, local);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  console.log(`  [ok]  ${local}  (${(buf.byteLength / 1024).toFixed(0)}kb)`);
  return "ok";
}

async function main(): Promise<void> {
  const events = readJson<Parameters<typeof imageSources>[0]>("events.json");
  const bundle = readJson<Parameters<typeof imageSources>[1]>("bundle_schedule.json");
  const sources = imageSources(events, bundle);

  console.log(`Fetching ${sources.length} images → ${publicDir}`);
  let ok = 0;
  let fail = 0;
  for (const { remote, local } of sources) {
    const r = await download(remote, local);
    if (r === "ok") ok++;
    else if (r === "fail") fail++;
  }
  console.log(`Done. ${ok} ok, ${fail} failed, ${sources.length - ok - fail} skipped.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("fetch-images failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
