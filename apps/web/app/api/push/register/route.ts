import { auth } from "@/auth";
import { savePushToken, upsertUser } from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  token: z.string().min(1),
});

/**
 * Persist the browser's FCM registration token for the signed-in user. Replaces
 * the old Web Push `/api/push/subscribe` (which stored an {endpoint,p256dh,auth}
 * subscription). One token per device; re-registering upserts and reassigns the
 * token to the current user (see savePushToken).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid token" }, { status: 400 });
  }

  const userId = await upsertUser({
    googleSub: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
  });

  await savePushToken({ userId, token: parsed.data.token });

  return Response.json({ ok: true }, { status: 201 });
}
