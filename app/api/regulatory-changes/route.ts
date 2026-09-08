import { apiHeaders, enterRequest, preflight } from "../../../lib/api-security";
import { getRegulatoryChanges } from "../../../server/regulatory-change-monitor";

export function OPTIONS(request: Request) { return preflight(request, "GET, OPTIONS"); }

export async function GET(request: Request) {
  const { allowed, headers } = apiHeaders(request);
  if (!allowed) return Response.json({ error: "This origin is not allowed to access Mizan." }, { status: 403, headers });
  const guard = enterRequest(request, "regulatory-changes", 60, 8);
  if (!guard.allowed) return Response.json({ error: "Too many requests. Please try again shortly." }, { status: 429, headers: { ...Object.fromEntries(headers), "Retry-After": String(guard.retryAfter) } });
  try {
    const params = new URL(request.url).searchParams;
    const profileId = params.get("profileId") || undefined;
    const jurisdiction = params.get("jurisdiction") || undefined;
    const authority = params.get("authority") || undefined;
    const changeType = params.get("changeType") || undefined;
    if ([profileId, jurisdiction, authority, changeType].some((value) => value && value.length > 100)) return Response.json({ error: "Filter value is too long." }, { status: 400, headers });
    const result = await getRegulatoryChanges(profileId, { jurisdiction, authority, changeType, appliesToCompany: params.get("appliesToCompany") === "true" });
    return Response.json(result, { headers });
  } catch { return Response.json({ error: "The regulatory change monitor is temporarily unavailable." }, { status: 503, headers }); }
  finally { guard.release(); }
}
