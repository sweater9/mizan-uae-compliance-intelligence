import { publicTrialDenial, publicTrialResponse } from "../../public-trial.mjs";

const NVIDIA_CHAT_COMPLETIONS_URL =
  `${process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1"}/chat/completions`;
const DEFAULT_NVIDIA_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(response.body, { status: response.status, headers });
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export function GET() {
  return withCors(publicTrialResponse(process.env.PUBLIC_TRIAL_START_AT));
}

export async function POST(request: Request) {
  try {
    const denial = publicTrialDenial(process.env.PUBLIC_TRIAL_START_AT);
    if (denial) return withCors(denial);
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return withCors(Response.json(
        { error: "The NVIDIA integration is not configured on this deployment." },
        { status: 503 },
      ));
    }

    const payload = (await request.json().catch(() => null)) as {
      question?: unknown;
    } | null;
    const question =
      typeof payload?.question === "string" ? payload.question.trim() : "";
    if (!question || question.length > 4000) {
      return withCors(Response.json(
        { error: "question is required and must be 4,000 characters or fewer." },
        { status: 400 },
      ));
    }

    const upstream = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.NVIDIA_NIM_MODEL ||
          process.env.NVIDIA_MODEL ||
          DEFAULT_NVIDIA_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a UAE compliance information assistant. Explain structured compliance results clearly, cite uncertainty, and never present legal or tax advice as a definitive determination.",
          },
          { role: "user", content: question },
        ],
        temperature: 0.2,
        max_tokens: 700,
      }),
    });

    if (!upstream.ok) {
      return withCors(Response.json(
        { error: "The NVIDIA service could not answer the request." },
        { status: 502 },
      ));
    }

    const result = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return withCors(Response.json(
        { error: "The NVIDIA service returned an empty answer." },
        { status: 502 },
      ));
    }

    return withCors(Response.json({ answer }));
  } catch {
    return withCors(Response.json(
      { error: "The NVIDIA service could not be reached." },
      { status: 502 },
    ));
  }
}
