import { auth } from "@/auth";
import { getUserIdByGoogleSub, listBookings } from "@event/core";

export const runtime = "nodejs";

/** List the signed-in user's office-hours bookings. Read-only — no write on GET. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = await getUserIdByGoogleSub(session.user.id);
  if (!userId) {
    // No user row yet → no bookings. Avoid an upsert on a pure read.
    return Response.json({ bookings: [] });
  }
  return Response.json({ bookings: await listBookings(userId) });
}
