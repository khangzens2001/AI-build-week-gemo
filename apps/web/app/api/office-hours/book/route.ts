import { auth } from "@/auth";
import { bookOfficeHours, upsertUser } from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";

const BookBody = z.object({
  mentorId: z.string(),
  slotId: z.string(),
  topic: z.string().nullable().optional(),
});

/**
 * Book a mentor office-hours slot for the signed-in user. This is the
 * authenticated write behind the `bookOfficeHours` intent tool. Rejects with
 * 409 when the slot is already taken or doesn't exist on that mentor.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = BookBody.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { mentorId, slotId, topic } = parsed.data;

  const userId = await upsertUser({
    googleSub: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
  });

  const result = await bookOfficeHours({ userId, mentorId, slotId, topic: topic ?? null });
  if (result.ok) {
    return Response.json({ id: result.id }, { status: 201 });
  }
  return Response.json({ error: result.reason }, { status: 409 });
}
