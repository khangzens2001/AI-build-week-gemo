import { auth } from "@/auth";
import { createTeam, listTeams, upsertUser } from "@event/core";
import { z } from "zod";

export const runtime = "nodejs";

/** Public list of all teams, newest first. No auth required. */
export async function GET() {
  return Response.json({ teams: await listTeams() });
}

const CreateBody = z.object({
  name: z.string().min(1),
  tagline: z.string().optional(),
  lookingFor: z.array(z.string()).optional(),
});

/** Create a team; the signed-in user becomes its founder. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, tagline, lookingFor } = parsed.data;

  const userId = await upsertUser({
    googleSub: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
  });

  const id = await createTeam({ userId, name, tagline, lookingFor });
  return Response.json({ id }, { status: 201 });
}
