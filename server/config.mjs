// Server-only: imported exclusively by API routes and the Worker entry.
// Explicit Worker bindings are authoritative; never merge tenants with Node env.
export function serverConfig(bindings) {
  const source = bindings ?? globalThis.process?.env ?? {};
  const value = (key) => typeof source[key] === 'string' ? source[key].trim() : '';
  const apiKey = value('NVIDIA_API_KEY');
  let endpoint;
  try {
    const url = new URL(value('NVIDIA_NIM_BASE_URL') || 'https://integrate.api.nvidia.com/v1');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error();
    url.pathname = url.pathname.replace(/\/$/, '') + '/chat/completions';
    endpoint = url.href;
  } catch { /* Invalid server configuration is reported without exposing values. */ }
  const corsOrigins = value('CORS_ORIGIN').split(',').map(x => x.trim()).filter(x => {
    try { return new URL(x).origin === x && x !== 'null'; } catch { return false; }
  });
  const revision = value('RENDER_GIT_COMMIT') || value('APP_VERSION');
  return { apiKey, endpoint, model: value('NVIDIA_NIM_MODEL') || value('NVIDIA_MODEL') || 'nvidia/nemotron-3.5-lightning-30b-a3b', corsOrigins, revision: revision ? revision.slice(0, 12) : 'unknown', ready: Boolean(apiKey && endpoint) };
}
