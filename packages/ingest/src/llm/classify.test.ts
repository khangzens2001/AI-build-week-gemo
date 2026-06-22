/**
 * Hermetic tests for the MiMo classification module. NO real network calls:
 * we either exercise the pure post-processing (sanitizeLabels), the
 * graceful-degrade early returns (CLASSIFY!=1 / MIMO unset), or inject a stub
 * `generate` seam so `classifyLabels` never reaches the real model.
 *
 * Env is mutated within tests and restored in afterEach.
 */

import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { classifyLabelsCached, clearClassifyCache } from "./cache";
import { type GenerateLabels, classifyLabels, sanitizeLabels } from "./classify";

const LABELS = ["ai", "web", "mobile", "data"] as const;

// Snapshot the two env vars we toggle so each test is isolated.
let savedClassify: string | undefined;
let savedKey: string | undefined;

beforeEach(() => {
  savedClassify = process.env.CLASSIFY;
  savedKey = process.env.MIMO_API_KEY;
});

afterEach(() => {
  if (savedClassify === undefined) Reflect.deleteProperty(process.env, "CLASSIFY");
  else process.env.CLASSIFY = savedClassify;
  if (savedKey === undefined) Reflect.deleteProperty(process.env, "MIMO_API_KEY");
  else process.env.MIMO_API_KEY = savedKey;
});

/** Make a unique temp cache file path per test; cleaned up by the test. */
function tmpCacheFile(name: string): string {
  return join(tmpdir(), `classify-cache-test-${name}-${process.pid}-${Date.now()}.json`);
}

// --- pure post-processing ---------------------------------------------------

test("sanitizeLabels removes out-of-set labels, dedupes, and caps at maxLabels", () => {
  const raw = ["ai", "bogus", "web", "ai", "mobile", "data"];
  const out = sanitizeLabels(raw, LABELS, 2);
  // "bogus" dropped (out of set), duplicate "ai" dropped, capped at 2.
  expect(out).toEqual(["ai", "web"]);
});

test("sanitizeLabels returns [] when nothing is in the allowed set", () => {
  expect(sanitizeLabels(["nope", "also-nope"], LABELS, 5)).toEqual([]);
});

// --- graceful-degrade early returns -----------------------------------------

test("classifyLabels returns [] when CLASSIFY != 1", async () => {
  Reflect.deleteProperty(process.env, "CLASSIFY");
  process.env.MIMO_API_KEY = "tp-test"; // key set, but flag off
  let called = false;
  const generate: GenerateLabels = async () => {
    called = true;
    return ["ai"];
  };
  const out = await classifyLabels({ id: "x", text: "hi" }, { labels: LABELS }, generate);
  expect(out).toEqual([]);
  expect(called).toBe(false);
});

test("classifyLabels returns [] when MIMO_API_KEY is unset", async () => {
  process.env.CLASSIFY = "1";
  Reflect.deleteProperty(process.env, "MIMO_API_KEY");
  let called = false;
  const generate: GenerateLabels = async () => {
    called = true;
    return ["ai"];
  };
  const out = await classifyLabels({ id: "x", text: "hi" }, { labels: LABELS }, generate);
  expect(out).toEqual([]);
  expect(called).toBe(false);
});

test("classifyLabels returns [] (never throws) when the model errors", async () => {
  process.env.CLASSIFY = "1";
  process.env.MIMO_API_KEY = "tp-test";
  const generate: GenerateLabels = async () => {
    throw new Error("429 rate limited");
  };
  const out = await classifyLabels({ id: "x", text: "hi" }, { labels: LABELS }, generate);
  expect(out).toEqual([]);
});

// --- full path with injected generate (filter + dedupe + cap) ---------------

test("classifyLabels filters, dedupes, and caps the model output", async () => {
  process.env.CLASSIFY = "1";
  process.env.MIMO_API_KEY = "tp-test";
  const generate: GenerateLabels = async () => ["web", "hallucinated", "web", "ai", "data"];
  const out = await classifyLabels(
    { id: "x", text: "a web + ai project" },
    { labels: LABELS, maxLabels: 2 },
    generate,
  );
  expect(out).toEqual(["web", "ai"]);
});

// --- cache ------------------------------------------------------------------

test("classifyLabelsCached returns the stored value on a hit without re-invoking", async () => {
  process.env.CLASSIFY = "1";
  process.env.MIMO_API_KEY = "tp-test";
  const cacheFile = tmpCacheFile("hit");
  clearClassifyCache(cacheFile);

  let calls = 0;
  const generate: GenerateLabels = async () => {
    calls += 1;
    return ["ai"];
  };

  const input = { id: "evt-1", text: "an ai project" };
  const opts = { labels: LABELS, maxLabels: 3 };

  try {
    const first = await classifyLabelsCached(input, opts, cacheFile, generate);
    const second = await classifyLabelsCached(input, opts, cacheFile, generate);
    expect(first).toEqual(["ai"]);
    expect(second).toEqual(["ai"]);
    // Second call served from cache — generate invoked exactly once.
    expect(calls).toBe(1);
  } finally {
    if (existsSync(cacheFile)) rmSync(cacheFile);
  }
});

test("classifyLabelsCached re-invokes when the allowed label set changes (key invalidation)", async () => {
  process.env.CLASSIFY = "1";
  process.env.MIMO_API_KEY = "tp-test";
  const cacheFile = tmpCacheFile("invalidate");
  clearClassifyCache(cacheFile);

  let calls = 0;
  const generate: GenerateLabels = async () => {
    calls += 1;
    return ["ai"];
  };
  const input = { id: "evt-2", text: "same text" };

  try {
    await classifyLabelsCached(input, { labels: ["ai", "web"] }, cacheFile, generate);
    // Different label set → different key → cache miss → re-invoke.
    await classifyLabelsCached(input, { labels: ["ai", "data"] }, cacheFile, generate);
    expect(calls).toBe(2);
  } finally {
    if (existsSync(cacheFile)) rmSync(cacheFile);
  }
});

test("classifyLabelsCached starts fresh on a corrupt cache file", async () => {
  process.env.CLASSIFY = "1";
  process.env.MIMO_API_KEY = "tp-test";
  const cacheFile = tmpCacheFile("corrupt");
  // Write garbage so JSON.parse throws inside readCache.
  Bun.write(cacheFile, "{ not valid json ");
  await Bun.sleep(0);

  const generate: GenerateLabels = async () => ["data"];
  try {
    const out = await classifyLabelsCached(
      { id: "evt-3", text: "data heavy" },
      { labels: LABELS },
      cacheFile,
      generate,
    );
    expect(out).toEqual(["data"]);
  } finally {
    if (existsSync(cacheFile)) rmSync(cacheFile);
  }
});
