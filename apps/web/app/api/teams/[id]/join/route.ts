import { auth } from "@/auth";
import { joinTeam, upsertUser } from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";

const JoinBody = z.object({
  role: z.string().optional(),
});

/** Join a team as the signed-in user. Idempotent (joining twice is a no-op). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = JoinBody.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const userId = await upsertUser({
    googleSub: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
  });

  const { id } = await params;
  await joinTeam(id, userId, parsed.data.role);
  return Response.json({ ok: true });
}
