import { allVenues } from "@event/core";

export const runtime = "nodejs";
// Snapshot is hot-reloaded from a runtime file on the VM; keep this dynamic.
export const dynamic = "force-dynamic";

/** All venues (deduped, with coords/map links). Public, snapshot-backed. */
export function GET() {
  return Response.json({ venues: allVenues() });
}
