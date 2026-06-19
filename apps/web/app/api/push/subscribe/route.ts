import { auth } from "@/auth";
import { savePushSubscription, upsertUser } from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

/** Persist the browser's Web Push subscription for the signed-in user. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid subscription" }, { status: 400 });
  }

  const userId = await upsertUser({
    googleSub: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
  });

  await savePushSubscription({
    userId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });

  return Response.json({ ok: true }, { status: 201 });
}
