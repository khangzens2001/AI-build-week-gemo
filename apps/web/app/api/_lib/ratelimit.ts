/**
 * Minimal in-memory fixed-window rate limiter for public LLM routes.
 *
 * This is a pragmatic guard for a single-region demo deployment — it protects
 * against a `curl` loop draining the Gemini budget, not a distributed attacker.
 * State lives in module memory (per serverless instance); good enough to blunt
 * abuse without adding infra. For production-grade limits use a shared store.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/**
 * Allow `limit` requests per `windowMs` for a given key (e.g. ip:route).
 * Returns ok=false with retryAfter when the window is exhausted.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    // Evict the stale bucket (if any) before starting a fresh window so expired
    // keys don't accumulate unboundedly under header rotation.
    if (existing) buckets.delete(key);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Best-effort client IP from common proxy headers (Vercel sets x-forwarded-for).
 * Returns null when no IP header is present so callers can decide how to key
 * anonymous traffic (don't collapse everyone into a shared "unknown" bucket).
 */
export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") ?? null;
}
