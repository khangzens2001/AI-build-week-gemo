import { listMentors } from "@event/core";

export const runtime = "nodejs";
// Reads live D1 (mentors/office-hours change at runtime), so never prerender.
export const dynamic = "force-dynamic";

/**
 * Mentors directory API.
 *
 * GET is a public read of mentors with their currently-free office-hours slots.
 * Optional `?q=` filters by expertise/keyword. Mentors are already camelCase
 * from the `listMentors` helper, so they pass straight through.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  return Response.json({ mentors: await listMentors(q) });
}
