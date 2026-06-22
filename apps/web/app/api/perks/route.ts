import { allPerks } from "@event/core";

export const runtime = "nodejs";
// Snapshot is hot-reloaded from a runtime file on the VM; keep this dynamic.
export const dynamic = "force-dynamic";

/** Sponsor/partner perks + how to claim. Public, snapshot-backed. */
export function GET() {
  return Response.json({ perks: allPerks() });
}
