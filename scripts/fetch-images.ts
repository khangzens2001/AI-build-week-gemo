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

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { imageSources } from "../packages/ingest/src/seed/transform";

const repoRoot = resolve(import.meta.dir, "..");
// Both dirs are env-overridable so the VM crawl-ingest loop can read the FRESH
// crawl JSON from the crawl volume and write covers into the nginx-served static
// dir, while local dev keeps the in-repo defaults.
const dataDir = process.env.FETCH_IMAGES_DATA_DIR
  ? resolve(process.env.FETCH_IMAGES_DATA_DIR)
  : join(repoRoot, "craw_data1", "data", "latest");
const publicDir = process.env.FETCH_IMAGES_PUBLIC_DIR
  ? resolve(process.env.FETCH_IMAGES_PUBLIC_DIR)
  : join(repoRoot, "apps", "web", "public");

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
  const dir = dirname(dest);
  mkdirSync(dir, { recursive: true });
  // Atomic write: download to a temp sibling then rename, so a reader never sees
  // a half-written image. (File perms for the VM's nginx are handled by the
  // deploy wrapper's `chmod -R a+rX`, keeping this script environment-agnostic.)
  const tmp = `${dest}.tmp`;
  writeFileSync(tmp, buf);
  renameSync(tmp, dest);
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
  // NON-FATAL: never exit non-zero just because some covers failed. In the VM
  // crawl-ingest loop this runs under `set -e` AFTER seed+embed; a transient
  // Luma 404 must not abort the cycle and suppress the /api/ingest/hook signal.
  // A partial cover set is acceptable (baseline-seeded fallbacks cover the gaps).
  if (ok === 0 && sources.length > 0) {
    // Total failure is worth a loud non-zero so a misconfig surfaces — but only
    // when we got literally nothing (network/dir broken), not on partial loss.
    console.error("fetch-images: ZERO images fetched — likely a network or path misconfig.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("fetch-images failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
