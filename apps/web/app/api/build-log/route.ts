import { auth } from "@/auth";
import { createBuildLog, isTeamMember, listBuildLogs, upsertUser } from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";
// Reads live D1 (build-log feed changes at runtime), so never prerender.
export const dynamic = "force-dynamic";

/** Public build-log feed (newest first), optionally scoped to one team. */
export async function GET(req: Request) {
  const teamId = new URL(req.url).searchParams.get("teamId");
  return Response.json({ logs: await listBuildLogs(teamId ?? null, 50) });
}

const CreateBody = z.object({
  teamId: z.string(),
  body: z.string().min(1).max(2000),
});

/** Post a build-log entry — only for a team the signed-in user belongs to. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { teamId, body } = parsed.data;

  const userId = await upsertUser({
    googleSub: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
  });

  // Only members can post to a team's log (keeps the public feed attributable).
  if (!(await isTeamMember(teamId, userId))) {
    return Response.json({ error: "not a member of this team" }, { status: 403 });
  }

  const id = await createBuildLog({ teamId, userId, body });
  return Response.json({ id }, { status: 201 });
}
