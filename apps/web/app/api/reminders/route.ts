import { auth } from "@/auth";
import {
  type CreateReminderInput,
  createReminder,
  getDeadlineById,
  getSessionById,
  getUserIdByGoogleSub,
  listReminders,
  upsertUser,
} from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";

/** List the signed-in user's reminders. Read-only — no user write on GET. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = await getUserIdByGoogleSub(session.user.id);
  if (!userId) {
    // No user row yet → no reminders. Avoid an upsert on a pure read.
    return Response.json({ reminders: [] });
  }
  return Response.json({ reminders: await listReminders(userId) });
}

const CreateBody = z.object({
  targetId: z.string(),
  targetKind: z.enum(["session", "deadline"]).default("session"),
  minutesBefore: z.number().int().min(0).max(1440).default(15),
});

/** Create a reminder for a session/deadline, computed from its start/due time. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { targetId, targetKind, minutesBefore } = parsed.data;

  // Resolve fire time from the session start or deadline due time.
  const target = targetKind === "deadline" ? getDeadlineById(targetId) : getSessionById(targetId);
  const baseAt =
    targetKind === "deadline"
      ? (target as ReturnType<typeof getDeadlineById>)?.dueAt
      : (target as ReturnType<typeof getSessionById>)?.startsAt;
  if (!target || baseAt == null) {
    return Response.json({ error: "target has no scheduled time" }, { status: 400 });
  }

  const userId = await upsertUser({
    googleSub: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
  });

  const input: CreateReminderInput = {
    userId,
    targetId,
    targetKind,
    fireAt: baseAt - minutesBefore * 60_000,
    label: `${target.title} in ${minutesBefore} min`,
  };
  const id = await createReminder(input);
  return Response.json({ id, fireAt: input.fireAt, label: input.label }, { status: 201 });
}
