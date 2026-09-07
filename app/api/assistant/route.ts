import { askMizanFromRepository } from "../../../lib/ask-mizan-repository";
import { apiHeaders, enterRequest, preflight, readJsonBody, RequestBodyTooLargeError } from "../../../lib/api-security";
import { RegulatoryDatabaseUnavailableError } from "../../../lib/regulatory-repository";

const MAX_BODY = 24_000;

export async function POST(request: Request) {
  const { allowed, headers } = apiHeaders(request);
  if (!allowed) return Response.json({ error: "This origin is not allowed to access Mizan." }, { status: 403, headers });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "Send a JSON request." }, { status: 415, headers });
  }

  let payload: unknown;
  try { payload = await readJsonBody(request, MAX_BODY); }
  catch (error) { return Response.json({ error: error instanceof RequestBodyTooLargeError ? "The request is too large." : "Send a valid JSON question." }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers }); }

  const question = typeof (payload as { question?: unknown })?.question === "string"
    ? (payload as { question: string }).question.trim()
    : "";
  if (!question || question.length > 4000) {
    return Response.json({ error: "Enter a question of 1–4,000 characters." }, { status: 400, headers });
  }

  const guard = enterRequest(request, "assistant", 30, 8);
  if (!guard.allowed) { headers.set("Retry-After", String(guard.retryAfter)); return Response.json({ error: "Mizan is busy. Please try again shortly." }, { status: 429, headers }); }
  try {
    return Response.json(await askMizanFromRepository(question), { headers });
  } catch (error) {
    if (!(error instanceof RegulatoryDatabaseUnavailableError)) console.error("Ask Mizan request failed");
    return Response.json({ error: "Mizan's verified regulatory database is temporarily unavailable." }, { status: 503, headers });
  } finally { guard.release(); }
}

export function OPTIONS(request: Request) { return preflight(request, "POST, OPTIONS"); }
