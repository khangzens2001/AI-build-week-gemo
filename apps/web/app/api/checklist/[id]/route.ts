import { auth } from "@/auth";
import { deleteChecklistItem, getUserIdByGoogleSub, updateChecklistItem } from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";

const PatchBody = z.object({
  title: z.string().optional(),
  notes: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  fireAt: z.number().int().nullable().optional(),
});

/** Patch a checklist item the signed-in user owns. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = await getUserIdByGoogleSub(session.user.id);
  if (!userId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await params;
  await updateChecklistItem(userId, id, parsed.data);
  return Response.json({ ok: true });
}

/** Delete a checklist item the signed-in user owns. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = await getUserIdByGoogleSub(session.user.id);
  if (!userId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const { id } = await params;
  await deleteChecklistItem(userId, id);
  return Response.json({ ok: true });
}
