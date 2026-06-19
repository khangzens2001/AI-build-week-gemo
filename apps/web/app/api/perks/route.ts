import { allPerks } from "@event/core";

export const runtime = "nodejs";

/** Sponsor/partner perks + how to claim. Public, snapshot-backed. */
export function GET() {
  return Response.json({ perks: allPerks() });
}
