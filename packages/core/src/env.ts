/**
 * Typed environment access for @event/core. Centralizes env reads so the rest
 * of the package never touches `process.env` directly and failures are loud and
 * specific. Runtime-agnostic: works on Node/Vercel and inside scripts.
 */

function read(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

/** Required env var; throws a clear error if missing (call at use site, not import time). */
export function requireEnv(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example for the full list.`,
    );
  }
  return value;
}

/** Optional env var with a fallback. */
export function envOr(name: string, fallback: string): string {
  return read(name) ?? fallback;
}

/** Optional env var, undefined if unset. */
export function optionalEnv(name: string): string | undefined {
  return read(name);
}

/**
 * Whether dev-only conveniences are allowed (e.g. the seeded "mock account"
 * Credentials sign-in used to test authed flows without Google OAuth). NEVER in
 * production — there, only real Google sign-in exists.
 */
export function isDevAuthEnabled(): boolean {
  if (read("NODE_ENV") === "production") return false;
  // On by default in dev; opt out with CUE_DEV_AUTH=0.
  return read("CUE_DEV_AUTH") !== "0";
}

/** Gemini model + embedding configuration. */
export const llmConfig = {
  get chatModel(): string {
    return envOr("GEMINI_CHAT_MODEL", "gemini-3-flash-preview");
  },
  get embedModel(): string {
    return envOr("GEMINI_EMBED_MODEL", "gemini-embedding-001");
  },
  /** Embedding dimension — IMMUTABLE once the Chroma collection exists. */
  get embedDim(): number {
    const raw = read("GEMINI_EMBED_DIM");
    const n = raw ? Number.parseInt(raw, 10) : 3072;
    return Number.isNaN(n) ? 3072 : n;
  },
};

/** Chroma connection config. Cloud when CHROMA_API_KEY is set, else local host:port. */
export const chromaConfig = {
  get isCloud(): boolean {
    return Boolean(read("CHROMA_API_KEY"));
  },
  get collection(): string {
    return envOr("CHROMA_COLLECTION", "aabw");
  },
  get host(): string {
    return envOr("CHROMA_HOST", "localhost");
  },
  get port(): number {
    const n = Number.parseInt(envOr("CHROMA_PORT", "8000"), 10);
    return Number.isNaN(n) ? 8000 : n;
  },
};
