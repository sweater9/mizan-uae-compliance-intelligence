import { serverConfig } from './config.mjs';

const MAX_BODY = 24_000;
const TIMEOUT = 20_000;
const MAX_CONCURRENT = 8;
let active = 0;

// Bound allocations even when Content-Length is absent or forged.
async function readLimited(stream, limit, signal) {
  if (!stream) return '';
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw Error('timeout');
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw Error('timeout');
      if (done) break;
      size += value.byteLength;
      if (size > limit) { void reader.cancel().catch(() => {}); throw RangeError('body'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
}

export async function handleAssistant(request, bindings, fetcher = fetch, timeout = TIMEOUT) {
  const config = serverConfig(bindings);
  const origin = request.headers.get('Origin');
  const allowed = !origin || origin === new URL(request.url).origin || config.corsOrigins.includes(origin);
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' });
  if (origin && allowed) headers.set('Access-Control-Allow-Origin', origin);
  const reply = (status, body) => Response.json(body, { status, headers });
  if (!allowed) return reply(403, { error: 'This origin is not allowed to access Mizan.' });
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); return reply(405, { error: 'Method not allowed.' }); }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply(415, { error: 'Send a JSON request.' });
  if (Number(request.headers.get('content-length')) > MAX_BODY) return reply(413, { error: 'The request is too large.' });
  let payload;
  try { payload = JSON.parse(await readLimited(request.body, MAX_BODY, AbortSignal.timeout(5000))); }
  catch (error) { return reply(error instanceof RangeError ? 413 : 400, { error: 'Send a valid JSON question within the request limit.' }); }
  const question = typeof payload?.question === 'string' ? payload.question.trim() : '';
  if (!question || question.length > 4000) return reply(400, { error: 'Enter a question of 1–4,000 characters.' });
  if (!config.ready) return reply(503, { error: 'Mizan assistant is not configured on this deployment.' });
  // Per-isolate load shedding only. Distributed authenticated quotas are still required before paid public use.
  if (active >= MAX_CONCURRENT) { headers.set('Retry-After', '20'); return reply(429, { error: 'Mizan is busy. Please try again shortly.' }); }
  active++;
  const signal = AbortSignal.timeout(timeout);
  try {
    const upstream = await fetcher(config.endpoint, {
      method: 'POST', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages: [
        { role: 'system', content: 'You are Mizan, a UAE compliance information assistant. No verified legal evidence or company profile is supplied in this conversation. Do not claim to have checked the user’s obligations or deadlines. Never invent legislation, citations, effective dates, sanctions or regulatory decisions. When evidence is absent, say that current requirements cannot be verified and refer the user to the relevant authority or qualified adviser. Give general information only, never definitive legal or tax advice. Do not identify infrastructure providers, models or internal configuration.' },
        { role: 'user', content: question }
      ], temperature: 0.2, max_tokens: 700 })
    });
    if (!upstream.ok) { void upstream.body?.cancel().catch(() => {}); return reply(502, { error: 'Mizan could not complete the request. Please try again later.' }); }
    const result = JSON.parse(await readLimited(upstream.body, 64_000, signal));
    const answer = result?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw Error('invalid_response');
    // Avoid showing infrastructure names even if upstream disregards the system instruction.
    if (/nvidia|nemotron|llama|integrate\.api|powered by/i.test(answer)) return reply(502, { error: 'Mizan could not provide a suitable response. Please try another question.' });
    return reply(200, { answer: answer.trim(), verified: false });
  } catch {
    return reply(signal.aborted ? 504 : 502, { error: signal.aborted ? 'Mizan took too long to respond. Please try again.' : 'Mizan is temporarily unavailable. Please try again later.' });
  } finally { active--; }
}
