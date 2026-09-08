import { and, eq } from "drizzle-orm";
import { getDatabase } from "./db";
import { requireWorkspaceAccess, type WorkspaceAccess } from "./auth";
import { companyProfiles } from "./company-profile-schema";

export async function requireProfileAccess(request: Request, profileId: string, workspaceId: string): Promise<WorkspaceAccess> {
  const access = await requireWorkspaceAccess(request, workspaceId);
  const rows = await getDatabase().select({ id: companyProfiles.id }).from(companyProfiles)
    .where(and(eq(companyProfiles.id, profileId), eq(companyProfiles.workspaceId, workspaceId))).limit(1);
  if (!rows[0]) throw new Response(JSON.stringify({ error: "Company profile not found." }), { status: 404, headers: { "Content-Type": "application/json" } });
  return access;
}
