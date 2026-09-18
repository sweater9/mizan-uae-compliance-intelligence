import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseConfigurationError, safeDatabaseError, validateDatabaseUrl } from "../lib/database-config.ts";

test("accepts valid PostgreSQL connection URLs", () => {
  assert.equal(validateDatabaseUrl("postgresql://user:password@database.internal/mizan"), "postgresql://user:password@database.internal/mizan");
  assert.equal(validateDatabaseUrl(" postgres://user@localhost:5432/mizan "), "postgres://user@localhost:5432/mizan");
});

test("rejects a bare database credential", () => {
  assert.throws(() => validateDatabaseUrl("npg_0123456789abcdef"), DatabaseConfigurationError);
});

test("rejects malformed, unsupported and missing database configuration", () => {
  for (const value of [undefined, "", "not a URL", "https://example.test/db", "postgresql:///missing-host"]) {
    assert.throws(() => validateDatabaseUrl(value), DatabaseConfigurationError);
  }
});

test("database error diagnostics redact URLs and credentials", () => {
  const credential = "npg_secret123";
  const url = `postgresql://user:${credential}@database.internal/mizan`;
  const diagnostic = safeDatabaseError(new Error(`connection failed for ${url}; token ${credential}`));
  const serialized = JSON.stringify(diagnostic);
  assert.doesNotMatch(serialized, /npg_secret123/);
  assert.doesNotMatch(serialized, /database\.internal/);
  assert.match(serialized, /redacted/);
});
