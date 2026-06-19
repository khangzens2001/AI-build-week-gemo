import { allVenues } from "@event/core";

export const runtime = "nodejs";

/** All venues (deduped, with coords/map links). Public, snapshot-backed. */
export function GET() {
  return Response.json({ venues: allVenues() });
}
