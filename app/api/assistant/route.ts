import { askMizanFromRepository } from "../../../lib/ask-mizan-repository";
import { RegulatoryDatabaseUnavailableError } from "../../../lib/regulatory-repository";

const MAX_BODY = 24_000;

function headers() {
  return { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return Response.json({ error: "Send a JSON request." }, { status: 415, headers: headers() });
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY) {
    return Response.json({ error: "The request is too large." }, { status: 413, headers: headers() });
  }

  let payload: unknown;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Send a valid JSON question." }, { status: 400, headers: headers() }); }

  const question = typeof (payload as { question?: unknown })?.question === "string"
    ? (payload as { question: string }).question.trim()
    : "";
  if (!question || question.length > 4000) {
    return Response.json({ error: "Enter a question of 1–4,000 characters." }, { status: 400, headers: headers() });
  }

  try {
    return Response.json(await askMizanFromRepository(question), { headers: headers() });
  } catch (error) {
    if (error instanceof RegulatoryDatabaseUnavailableError) {
      return Response.json({ error: "Regulatory database unavailable." }, { status: 503, headers: headers() });
    }
    console.error("Ask Mizan failed", error);
    return Response.json({ error: "Ask Mizan is temporarily unavailable." }, { status: 503, headers: headers() });
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
