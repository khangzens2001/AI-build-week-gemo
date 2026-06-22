/**
 * Label classification via MiMo — OFFLINE seed/ingest only. Given a piece of
 * text and an allowed label set, returns the MOST relevant labels (capped).
 *
 * This NEVER runs on a request hot path and MUST degrade gracefully: any of the
 * following yields `[]` so the caller falls back to a deterministic heuristic
 * and the seed never crashes:
 *   - CLASSIFY env flag is not "1" (off by default → seed stays offline/deterministic)
 *   - MIMO_API_KEY is unset (isMimoEnabled() === false)
 *   - any error / 429 / timeout from the model
 *
 * JSON-object mode only. Thinking is disabled via providerOptions so
 * `temperature: 0` is honored. One attempt, ~20s abort timeout, never throws.
 * The model is asked for `{"labels":[...]}`; we parse + Zod-validate that JSON
 * ourselves (MiMo supports json_object, not json_schema), so a malformed reply
 * is caught and degrades to `[]` rather than crashing the seed.
 */

import { generateText } from "ai";
import { z } from "zod";

import { classifierModel, isMimoEnabled } from "./mimo";

/** Per-call timeout for the single classification attempt (offline batch). */
const CLASSIFY_TIMEOUT_MS = 20_000;
/** Default cap on returned labels when opts.maxLabels is unset. */
const DEFAULT_MAX_LABELS = 5;

/** Shape we ask MiMo to emit (JSON-object mode). Validated before use. */
const LabelsResponseSchema = z.object({ labels: z.array(z.string()) });

export interface ClassifyInput {
  id: string;
  text: string;
}

export interface ClassifyOpts {
  /** Allowed label set — the model may only return labels from this list. */
  labels: readonly string[];
  /** Max labels to return (default 5). */
  maxLabels?: number;
}

/**
 * Seam for tests: the underlying structured-generation call. Production wires
 * this to the real `generateObject`; tests inject a stub so no network happens.
 */
export type GenerateLabels = (args: {
  labels: readonly string[];
  maxLabels: number;
  input: ClassifyInput;
  signal: AbortSignal;
}) => Promise<string[]>;

/** Whether classification is opted-in for this run (CLASSIFY=1). */
function isClassifyOptedIn(): boolean {
  return process.env.CLASSIFY === "1";
}

/**
 * Whether classification will actually consult the model this run: opted-in AND
 * a MiMo key present. When false, callers should NOT cache the (empty) result —
 * a `[]` produced by a disabled run must never be persisted, or enabling
 * CLASSIFY later would serve stale empties. The cache wrapper gates on this.
 */
export function isClassifyActive(): boolean {
  return isClassifyOptedIn() && isMimoEnabled();
}

/**
 * Post-process raw model labels: keep only allowed-set members, dedupe
 * (first-seen wins), and cap at maxLabels. Pure + exported for testing.
 */
export function sanitizeLabels(
  raw: readonly string[],
  labels: readonly string[],
  maxLabels: number,
): string[] {
  const allowed = new Set(labels);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of raw) {
    if (!allowed.has(label) || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= maxLabels) break;
  }
  return out;
}

/**
 * Extract the first balanced JSON object from a model response. MiMo in
 * JSON-object mode returns a bare object, but we strip any stray ```json fences
 * or leading/trailing prose defensively before parsing.
 */
function extractJsonObject(text: string): unknown {
  const fenced = text.replace(/```(?:json)?/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON object in response");
  }
  return JSON.parse(fenced.slice(start, end + 1));
}

/**
 * Real MiMo call. Uses `generateText` with JSON-object response mode (MiMo only
 * reliably supports `response_format: {type:"json_object"}`, NOT json_schema),
 * then parses + Zod-validates the response ourselves. The strict allowed-set
 * filtering happens later in `sanitizeLabels`, so even a loose model response
 * can't inject a bad label.
 */
const realGenerate: GenerateLabels = async ({ labels, maxLabels, input, signal }) => {
  const system = `You are a strict classifier. Pick the MOST relevant labels for the text from the ALLOWED set only. Never invent labels. If unsure, return fewer. Reply with ONLY a JSON object of the form {"labels": ["..."]} with at most ${maxLabels} labels.`;

  const { text } = await generateText({
    model: classifierModel,
    system,
    prompt: `Allowed labels: ${labels.join(", ")}\n\nText:\n${input.text}`,
    temperature: 0,
    maxOutputTokens: 120,
    // JSON-object mode + disable MiMo "thinking" so temperature:0 applies.
    providerOptions: {
      mimo: {
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      },
    },
    abortSignal: signal,
  });

  const parsed = LabelsResponseSchema.parse(extractJsonObject(text));
  return parsed.labels;
};

/**
 * Classify `input.text` against `opts.labels`. Returns the validated,
 * allowed-set-filtered, deduped, capped label array — or `[]` on opt-out /
 * disabled MiMo / any error. Never throws.
 *
 * @param generate test seam; defaults to the real MiMo `generateObject` call.
 */
export async function classifyLabels(
  input: ClassifyInput,
  opts: ClassifyOpts,
  generate: GenerateLabels = realGenerate,
): Promise<string[]> {
  const maxLabels = opts.maxLabels ?? DEFAULT_MAX_LABELS;

  // Off by default: keep seed deterministic/offline unless explicitly opted-in.
  if (!isClassifyOptedIn()) return [];
  // No key → no-op, caller heuristic-falls-back.
  if (!isMimoEnabled()) return [];
  if (opts.labels.length === 0) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLASSIFY_TIMEOUT_MS);
  try {
    const raw = await generate({
      labels: opts.labels,
      maxLabels,
      input,
      signal: controller.signal,
    });
    return sanitizeLabels(raw, opts.labels, maxLabels);
  } catch (err) {
    // Graceful degrade: one-line warning, return [] so the caller falls back.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`classifyLabels: skipping "${input.id}" (${msg})`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
