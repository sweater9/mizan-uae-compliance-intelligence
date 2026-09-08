const DATABASE_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export class DatabaseConfigurationError extends Error {
  constructor(message = "MIZAN_DATABASE_URL is invalid.") {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export function validateDatabaseUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) throw new DatabaseConfigurationError("MIZAN_DATABASE_URL is not configured.");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DatabaseConfigurationError("MIZAN_DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (!DATABASE_PROTOCOLS.has(parsed.protocol) || !parsed.hostname || parsed.username.length === 0) {
    throw new DatabaseConfigurationError("MIZAN_DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  return raw;
}

function redact(value: string): string {
  return value
    .replace(/\b(?:postgres(?:ql)?):\/\/[^\s"'<>]+/gi, "[redacted database URL]")
    .replace(/\bnpg_[A-Za-z0-9_-]+/g, "[redacted database credential]");
}

export function safeDatabaseError(error: unknown) {
  const source = error instanceof Error ? error : new Error(String(error));
  return {
    name: source.name,
    message: redact(source.message),
    stack: source.stack ? redact(source.stack) : undefined,
  };
}
