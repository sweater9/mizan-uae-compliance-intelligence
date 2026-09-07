const MAX_BUCKETS = 10_000;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const active = new Map<string, number>();

export class RequestBodyTooLargeError extends Error {}

function configuredOrigins() {
  return (process.env.CORS_ORIGIN ?? "").split(",").map((value) => value.trim()).filter((value) => {
    try { return value !== "null" && new URL(value).origin === value; }
    catch { return false; }
  });
}

export function apiHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  const allowed = !origin || origin === new URL(request.url).origin || configuredOrigins().includes(origin);
  if (origin && allowed) headers.set("Access-Control-Allow-Origin", origin);
  return { allowed, headers };
}

export function preflight(request: Request, methods: string) {
  const { allowed, headers } = apiHeaders(request);
  if (!allowed) return Response.json({ error: "This origin is not allowed to access Mizan." }, { status: 403, headers });
  headers.set("Access-Control-Allow-Methods", methods);
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "600");
  return new Response(null, { status: 204, headers });
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return request.headers.get("cf-connecting-ip")?.trim() || forwarded || "unknown";
}

export function enterRequest(request: Request, route: string, limit: number, maxConcurrent: number) {
  const now = Date.now();
  const key = `${route}:${clientKey(request)}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + 60_000 };
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > MAX_BUCKETS) {
    for (const [candidate, value] of buckets) {
      if (value.resetAt <= now || buckets.size > MAX_BUCKETS) buckets.delete(candidate);
      if (buckets.size <= MAX_BUCKETS) break;
    }
  }
  const running = active.get(route) ?? 0;
  if (bucket.count > limit || running >= maxConcurrent) {
    return { allowed: false as const, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)), release() {} };
  }
  active.set(route, running + 1);
  let released = false;
  return { allowed: true as const, retryAfter: 0, release() {
    if (released) return;
    released = true;
    const current = active.get(route) ?? 1;
    if (current <= 1) active.delete(route); else active.set(route, current - 1);
  } };
}

export async function readJsonBody(request: Request, maxBytes: number, timeoutMs = 5_000): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyTooLargeError();
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const timeout = setTimeout(() => { void reader.cancel().catch(() => {}); }, timeoutMs);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new RequestBodyTooLargeError();
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    clearTimeout(timeout);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function resetApiGuardsForTests() {
  buckets.clear();
  active.clear();
}
