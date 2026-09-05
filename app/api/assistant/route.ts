import { handleAssistant } from '../../../server/assistant.mjs';
export function POST(request: Request) { return handleAssistant(request); }
export function OPTIONS(request: Request) { return handleAssistant(request); }
