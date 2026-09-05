import { health } from '../../../server/health.mjs';
export function GET() { return health(undefined, true); }
