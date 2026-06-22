/**
 * Stable-key disk cache for label classification. Repeated seed runs should not
 * reclassify unchanged inputs — that avoids label flap between runs and saves
 * MiMo API calls (100 RPM cap). Offline batch, so reads/writes are synchronous.
 *
 * Key = `${id}:${sha256(text + "|" + labels.join(","))}` so the cache entry is
 * invalidated whenever either the input text OR the allowed label set changes.
 *
 * Resilience: a missing cache file is treated as empty; a corrupt one is started
 * fresh (we never crash the seed on a bad cache).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type ClassifyInput,
  type ClassifyOpts,
  type GenerateLabels,
  classifyLabels,
  isClassifyActive,
} from "./classify";

const here = dirname(fileURLToPath(import.meta.url));
// packages/ingest/data/classify-cache.json
const DEFAULT_CACHE_FILE = join(here, "..", "..", "data", "classify-cache.json");

type CacheMap = Record<string, string[]>;

/** Stable cache key for an input + its allowed label set. */
function cacheKey(input: ClassifyInput, opts: ClassifyOpts): string {
  const hash = createHash("sha256")
    .update(`${input.text}|${opts.labels.join(",")}`)
    .digest("hex");
  return `${input.id}:${hash}`;
}

/** Read the cache map; `{}` if missing or corrupt (never throws). */
function readCache(file: string): CacheMap {
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as CacheMap;
    }
    return {};
  } catch {
    // Corrupt cache — start fresh rather than crash the offline batch.
    return {};
  }
}

/** Persist the cache map, creating the data dir if needed. */
function writeCache(file: string, map: CacheMap): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

/**
 * Cached wrapper around {@link classifyLabels}. On a hit, returns the stored
 * labels without invoking the model; on a miss, classifies, stores, and writes
 * the file back. Same graceful-degrade semantics as classifyLabels (`[]` never
 * crashes).
 *
 * @param generate optional test seam forwarded to classifyLabels.
 */
export async function classifyLabelsCached(
  input: ClassifyInput,
  opts: ClassifyOpts,
  cacheFile: string = DEFAULT_CACHE_FILE,
  generate?: GenerateLabels,
): Promise<string[]> {
  // When classification is inactive (CLASSIFY!=1 or no key), classifyLabels
  // returns [] WITHOUT consulting the model. Do NOT cache that — persisting an
  // empty result would later be served as a hit even after CLASSIFY is enabled,
  // permanently masking real labels. Just return the (empty) degrade value.
  if (!isClassifyActive()) {
    return generate
      ? await classifyLabels(input, opts, generate)
      : await classifyLabels(input, opts);
  }

  const key = cacheKey(input, opts);
  const map = readCache(cacheFile);

  const hit = map[key];
  if (hit !== undefined) return hit;

  const labels = generate
    ? await classifyLabels(input, opts, generate)
    : await classifyLabels(input, opts);

  // Only cache a NON-empty result. An empty array here means either a legit
  // "no labels" OR a transient failure (429/timeout → classifyLabels caught it
  // and returned []). Caching [] would pin that failure forever (next run = hit
  // → never retries). At this scale reclassifying a genuine-empty each run is
  // negligible, so we never persist [].
  if (labels.length > 0) {
    map[key] = labels;
    writeCache(cacheFile, map);
  }
  return labels;
}

/** Remove the cache file so the next run reclassifies from scratch. */
export function clearClassifyCache(cacheFile: string = DEFAULT_CACHE_FILE): void {
  if (existsSync(cacheFile)) rmSync(cacheFile);
}
