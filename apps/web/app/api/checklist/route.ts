import { auth } from "@/auth";
import {
  type ChecklistTargetType,
  createChecklistItem,
  getUserIdByGoogleSub,
  listChecklist,
  upsertUser,
} from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";

/** List the signed-in user's checklist items. Read-only — no user write on GET. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = await getUserIdByGoogleSub(session.user.id);
  if (!userId) {
    // No user row yet → no items. Avoid an upsert on a pure read.
    return Response.json({ items: [] });
  }
  const rows = await listChecklist(userId);
  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    completed: !!row.completed,
    targetId: row.target_id,
    targetType: row.target_type,
    fireAt: row.fire_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  return Response.json({ items });
}

const CreateBody = z.object({
  title: z.string(),
  notes: z.string().nullable().optional(),
  targetId: z.string().nullable().optional(),
  targetType: z.enum(["session", "deadline", "perk", "submission", "custom"]).default("custom"),
  fireAt: z.number().int().nullable().optional(),
});

/** Add a checklist item for the signed-in user (dedupes non-custom targets). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { title, notes, targetId, targetType, fireAt } = parsed.data;

  const userId = await upsertUser({
    googleSub: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
  });

  const id = await createChecklistItem({
    userId,
    title,
    notes: notes ?? null,
    targetId: targetId ?? null,
    targetType: targetType as ChecklistTargetType,
    fireAt: fireAt ?? null,
  });
  return Response.json({ id }, { status: 201 });
}
