import { serverConfig } from './config.mjs';
export function health(bindings, readiness = false) {
  const config = serverConfig(bindings);
  return Response.json({
    service: 'Mizan', version: config.revision,
    status: readiness && !config.ready ? 'not_ready' : 'ok',
    timestamp: new Date().toISOString(),
    ...(readiness ? { checks: { assistantConfiguration: config.ready ? 'configured' : 'missing_or_invalid', upstream: 'not_probed' } } : {})
  }, { status: readiness && !config.ready ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
}
