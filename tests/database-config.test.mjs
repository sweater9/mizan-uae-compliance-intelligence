import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseConfigurationError, safeDatabaseError, validateDatabaseUrl } from "../lib/database-config.ts";

test("accepts valid Neon and PostgreSQL connection URLs", () => {
  assert.equal(validateDatabaseUrl("postgresql://user:password@ep-example.eu-central-1.aws.neon.tech/mizan?sslmode=require"), "postgresql://user:password@ep-example.eu-central-1.aws.neon.tech/mizan?sslmode=require");
  assert.equal(validateDatabaseUrl(" postgres://user@localhost:5432/mizan "), "postgres://user@localhost:5432/mizan");
});

test("rejects a bare Neon credential", () => {
  assert.throws(() => validateDatabaseUrl("npg_0123456789abcdef"), DatabaseConfigurationError);
});

test("rejects malformed, unsupported and missing database configuration", () => {
  for (const value of [undefined, "", "not a URL", "https://example.test/db", "postgresql:///missing-host"]) {
    assert.throws(() => validateDatabaseUrl(value), DatabaseConfigurationError);
  }
});

test("database error diagnostics redact URLs and credentials", () => {
  const credential = "npg_secret123";
  const url = `postgresql://user:${credential}@ep-example.neon.tech/mizan`;
  const diagnostic = safeDatabaseError(new Error(`connection failed for ${url}; token ${credential}`));
  const serialized = JSON.stringify(diagnostic);
  assert.doesNotMatch(serialized, /npg_secret123/);
  assert.doesNotMatch(serialized, /ep-example\.neon\.tech/);
  assert.match(serialized, /redacted/);
});
