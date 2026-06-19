import { optionalEnv, requireEnv } from "./env";

/**
 * Cloudflare D1 access for mutable user data (reminders, preferences, push
 * subscriptions). Static event data is served from the bundled snapshot
 * (see ./data) and never goes through here at request time.
 *
 * Two targets, chosen per request:
 * - **Local dev:** if `D1_LOCAL_URL` is set, POST to that endpoint (the local
 *   `bun:sqlite` HTTP shim — see scripts/d1-local.ts) with no auth. Lets the
 *   full user-data loop run offline via CLI, no Cloudflare account needed.
 * - **Production (Option B):** POST to the Cloudflare D1 REST API with a Bearer
 *   token. This hits the global Cloudflare API rate limit, so it's reserved for
 *   user-data only. Bulk seeding uses `wrangler d1 execute` (batch SQL), not this.
 *
 * Both speak the same `{ sql, params } → { success, result:[{ results }], errors }`
 * contract, so the parsing below is identical for either target.
 */

interface D1QueryResponse<T> {
  success: boolean;
  errors?: { code?: number; message: string }[];
  result?: { results?: T[]; success?: boolean }[];
}

interface D1Target {
  url: string;
  headers: Record<string, string>;
}

/**
 * Resolve the D1 endpoint + headers. The Cloudflare creds are only required on
 * the remote path, so `requireEnv` lives inside the remote branch — a local
 * `D1_LOCAL_URL` run never needs them.
 */
function target(): D1Target {
  const local = optionalEnv("D1_LOCAL_URL");
  if (local) {
    return { url: local, headers: { "Content-Type": "application/json" } };
  }
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const databaseId = requireEnv("D1_DATABASE_ID");
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  return {
    url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
}

/**
 * Execute a parameterized SQL statement against D1 and return the rows.
 * Always use `?` placeholders + `params` — never string-interpolate user input.
 */
export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { url, headers } = target();

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ sql, params }),
  });

  if (!res.ok) {
    throw new Error(`D1 query failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as D1QueryResponse<T>;
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") ?? "unknown error";
    throw new Error(`D1 query error: ${msg}`);
  }

  return json.result?.[0]?.results ?? [];
}

/** Execute a write (INSERT/UPDATE/DELETE). Returns nothing; throws on failure. */
export async function d1Execute(sql: string, params: unknown[] = []): Promise<void> {
  await d1Query(sql, params);
}
