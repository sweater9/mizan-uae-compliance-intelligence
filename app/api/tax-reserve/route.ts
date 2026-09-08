import { apiHeaders, enterRequest, preflight, readJsonBody, RequestBodyTooLargeError } from "../../../lib/api-security";
import { validateTaxReserveInput } from "../../../lib/tax-reserve";
import { createTaxReserveAssessment } from "../../../server/tax-reserve";

const MAX_BODY = 24_000;

export function OPTIONS(request: Request) { return preflight(request, "POST, OPTIONS"); }

export async function POST(request: Request) {
  const { allowed, headers } = apiHeaders(request);
  if (!allowed) return Response.json({ error: "This origin is not allowed to access Mizan." }, { status: 403, headers });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "Send a JSON request." }, { status: 415, headers });
  let body: unknown;
  try { body = await readJsonBody(request, MAX_BODY); }
  catch (error) { return Response.json({ error: error instanceof RequestBodyTooLargeError ? "The request is too large." : "Send valid JSON." }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers }); }
  const validated = validateTaxReserveInput(body);
  if (!validated.input) return Response.json({ error: "Invalid tax reserve inputs.", details: validated.errors }, { status: 400, headers });
  const guard = enterRequest(request, "tax-reserve", 30, 6);
  if (!guard.allowed) { headers.set("Retry-After", String(guard.retryAfter)); return Response.json({ error: "Mizan is busy. Please try again shortly." }, { status: 429, headers }); }
  try {
    const result = await createTaxReserveAssessment(validated.input);
    return result ? Response.json(result, { headers }) : Response.json({ error: "Company profile not found." }, { status: 404, headers });
  } catch {
    return Response.json({ error: "The Tax Reserve Planner is temporarily unavailable." }, { status: 503, headers });
  } finally { guard.release(); }
}
