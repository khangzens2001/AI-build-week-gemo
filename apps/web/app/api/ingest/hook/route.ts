export const runtime = "nodejs";

/**
 * Firecrawl monitor → re-ingest webhook (stretch). When a Firecrawl monitor
 * detects that an AABW source page changed, it POSTs here. We verify a shared
 * secret, then acknowledge. Actual re-embedding is delegated to the offline
 * `bun run seed && bun run embed` pipeline (the seed transform owns parsing),
 * so this endpoint records the signal and returns fast rather than doing heavy
 * work inside the request.
 *
 * Auth: `Authorization: Bearer <INGEST_HOOK_TOKEN>`.
 */
function authorized(req: Request): boolean {
  const token = process.env.INGEST_HOOK_TOKEN;
  if (!token) return false;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as {
    url?: string;
    changeType?: string;
  };

  // Record the change signal. Re-ingest is run out-of-band (seed+embed) so the
  // webhook stays fast and the parsing logic lives in one place.
  console.log(
    `[ingest-hook] change detected: ${payload.url ?? "unknown"} (${payload.changeType ?? "changed"})`,
  );

  return Response.json({
    ok: true,
    received: { url: payload.url ?? null, changeType: payload.changeType ?? null },
    note: "Signal recorded. Run `bun run seed && bun run embed` to re-ingest changed content.",
  });
}
