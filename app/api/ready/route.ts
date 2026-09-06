import { checkDatabaseReadiness } from '../../../lib/database-readiness';

export async function GET() {
  try {
    const database = await checkDatabaseReadiness();
    return Response.json(
      {
        service: 'Mizan',
        status: database.ready ? 'ready' : 'not_ready',
        checks: { regulatoryDatabase: database.ready ? 'ready' : 'unavailable' },
      },
      {
        status: database.ready ? 200 : 503,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      },
    );
  } catch {
    return Response.json(
      { service: 'Mizan', status: 'not_ready', checks: { regulatoryDatabase: 'unavailable' } },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      },
    );
  }
}
