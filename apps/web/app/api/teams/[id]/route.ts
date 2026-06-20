import { getTeamById, listBuildLogs, listTeamMembers } from "@event/core";

export const runtime = "nodejs";

/** Public team detail: team, members, and its build log. 404 if no such team. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeamById(id);
  if (!team) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({
    team,
    members: await listTeamMembers(id),
    logs: await listBuildLogs(id),
  });
}
