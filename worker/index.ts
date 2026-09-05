/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  NVIDIA_API_KEY?: string;
  NVIDIA_MODEL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const NVIDIA_CHAT_COMPLETIONS_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";

async function handleAssistant(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (!env.NVIDIA_API_KEY) {
    return Response.json(
      { error: "The NVIDIA integration is not configured on this deployment." },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof payload?.question === "string" ? payload.question.trim() : "";
  if (!question || question.length > 4000) {
    return Response.json(
      { error: "question is required and must be 4,000 characters or fewer." },
      { status: 400 },
    );
  }

  const upstream = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL,
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
    return Response.json({ error: "The NVIDIA service returned an empty answer." }, { status: 502 });
  }

  return Response.json({ answer });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/assistant") {
      return handleAssistant(request, env);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
