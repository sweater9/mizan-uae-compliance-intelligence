import { getComplianceCalendar } from "../../../server/compliance-calendar";
import { apiHeaders, preflight } from "../../../lib/api-security";
import { authErrorResponse } from "../../../lib/auth";
import { requireProfileAccess } from "../../../lib/workspace-authorization";

export function OPTIONS(request: Request) {
  return preflight(request, "GET, OPTIONS");
}

export async function GET(request: Request) {
  const { allowed, headers } = apiHeaders(request);
  if (!allowed) return Response.json({ error: "This origin is not allowed to access Mizan." }, { status: 403, headers });
  const profileId = new URL(request.url).searchParams.get("profileId");
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!profileId || profileId.length > 100) return Response.json({ error: "A valid profileId is required." }, { status: 400, headers });
  try { await requireProfileAccess(request, profileId, workspaceId || ""); } catch (error) { return authErrorResponse(error) ?? Response.json({ error: "Authentication could not be verified." }, { status: 401, headers }); }
  const asOfValue = new URL(request.url).searchParams.get("asOf");
  const asOf = asOfValue ? new Date(`${asOfValue}T00:00:00Z`) : new Date();
  if (Number.isNaN(asOf.getTime())) return Response.json({ error: "asOf must be a valid date." }, { status: 400, headers });
  try {
    return Response.json({ profileId, ...(await getComplianceCalendar(profileId, asOf)) }, { headers });
  } catch {
    return Response.json({ error: "The compliance calendar is temporarily unavailable." }, { status: 503, headers });
  }
}
