import { eq } from "drizzle-orm";
import { authErrorResponse, requireUser } from "../../../lib/auth";
import { getDatabase } from "../../../lib/db";
import { workspaceMemberships, workspaces } from "../../../lib/auth-schema";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const rows = await getDatabase().select({ id: workspaces.id, name: workspaces.name, role: workspaceMemberships.role })
      .from(workspaceMemberships).innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
      .where(eq(workspaceMemberships.userId, user.id));
    return Response.json({ workspaces: rows });
  } catch (error) { return authErrorResponse(error) ?? Response.json({ error: "Workspace service is temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json() as { name?: unknown };
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 160) return Response.json({ error: "A workspace name of 1–160 characters is required." }, { status: 400 });
    const workspace = { id: crypto.randomUUID(), name: body.name.trim(), createdBy: user.id };
    await getDatabase().insert(workspaces).values(workspace);
    await getDatabase().insert(workspaceMemberships).values({ id: crypto.randomUUID(), workspaceId: workspace.id, userId: user.id, role: "owner" });
    return Response.json({ workspace }, { status: 201 });
  } catch (error) { return authErrorResponse(error) ?? Response.json({ error: "Workspace could not be created." }, { status: 500 }); }
}
