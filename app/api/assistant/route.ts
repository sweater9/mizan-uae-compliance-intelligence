const NVIDIA_CHAT_COMPLETIONS_URL =
  "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";

export async function POST(request: Request) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The NVIDIA integration is not configured on this deployment." },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    question?: unknown;
  } | null;
  const question =
    typeof payload?.question === "string" ? payload.question.trim() : "";
  if (!question || question.length > 4000) {
    return Response.json(
      { error: "question is required and must be 4,000 characters or fewer." },
      { status: 400 },
    );
  }

  const upstream = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL,
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
    return Response.json(
      { error: "The NVIDIA service could not answer the request." },
      { status: 502 },
    );
  }

  const result = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const answer = result.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    return Response.json(
      { error: "The NVIDIA service returned an empty answer." },
      { status: 502 },
    );
  }

  return Response.json({ answer });
}
