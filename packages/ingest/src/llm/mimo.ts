/**
 * MiMo (Xiaomi) classifier provider — OpenAI-compatible chat model used by the
 * OFFLINE seed/ingest pipeline only (never on a request hot path).
 *
 * MiMo speaks the OpenAI Chat Completions wire format: `{baseURL}/chat/completions`,
 * Bearer auth, model `mimo-v2.5`. We wire it through `@ai-sdk/openai-compatible`
 * (v2.0.x, which pairs with `ai@6`). JSON-object mode only — we deliberately do
 * NOT advertise `supportsStructuredOutputs`, and thinking is disabled at the call
 * site via providerOptions so `temperature: 0` actually takes effect.
 *
 * Env (all optional at import time; the key is only required when invoked):
 *   - MIMO_BASE_URL  default https://token-plan-sgp.xiaomimimo.com/v1
 *   - MIMO_MODEL     default mimo-v2.5
 *   - MIMO_API_KEY   no default — when unset, classification degrades to a no-op.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { envOr, optionalEnv } from "@event/core";

const MIMO_BASE_URL = envOr("MIMO_BASE_URL", "https://token-plan-sgp.xiaomimimo.com/v1");
const MIMO_MODEL = envOr("MIMO_MODEL", "mimo-v2.5");

// No default — used as the Bearer credential. Empty string when unset; we never
// throw at import time so importing this module is always safe offline.
const MIMO_API_KEY = optionalEnv("MIMO_API_KEY") ?? "";

const mimo = createOpenAICompatible({
  name: "mimo",
  baseURL: MIMO_BASE_URL,
  apiKey: MIMO_API_KEY,
});

/** The MiMo chat model used for label classification. */
export const classifierModel = mimo.chatModel(MIMO_MODEL);

/** Whether MiMo is configured (i.e. MIMO_API_KEY is set). */
export function isMimoEnabled(): boolean {
  return Boolean(optionalEnv("MIMO_API_KEY"));
}
