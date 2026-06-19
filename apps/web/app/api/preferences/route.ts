import { auth } from "@/auth";
import { UserPreferencesSchema, setUserPreferences, upsertUser } from "@event/core";

export const runtime = "nodejs";

/** Save the signed-in user's onboarding preferences (skills, topics, language). */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = UserPreferencesSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid preferences", issues: parsed.error.issues },
      {
        status: 400,
      },
    );
  }

  const userId = await upsertUser({
    googleSub: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
  });

  await setUserPreferences(userId, parsed.data);
  return Response.json({ ok: true });
}
