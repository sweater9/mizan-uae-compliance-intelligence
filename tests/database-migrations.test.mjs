import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkDatabaseReadiness, REQUIRED_MIGRATION_TIMESTAMP } from "../lib/database-readiness.ts";

const migrationUrl = new URL("../drizzle/0000_left_justin_hammer.sql", import.meta.url);
const journalUrl = new URL("../drizzle/meta/_journal.json", import.meta.url);

function mockNeon(...responses) {
  const queries = [];
  const client = async (strings) => {
    queries.push(strings.join("?"));
    return responses.shift();
  };
  return { client, queries };
}

test("migration metadata is PostgreSQL and identifies the readiness baseline", async () => {
  const journal = JSON.parse(await readFile(journalUrl, "utf8"));
  assert.equal(journal.dialect, "postgresql");
  assert.equal(journal.entries.length, 1);
  assert.equal(journal.entries[0].when, REQUIRED_MIGRATION_TIMESTAMP);
  assert.equal(journal.entries[0].tag, "0000_left_justin_hammer");
});

test("initial migration creates constrained evidence and verified-version model", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  for (const required of [
    'CREATE TYPE "public"."review_status"',
    'CREATE TABLE "regulatory_evidence"',
    'CONSTRAINT "regulatory_evidence_version_document_fk"',
    'CONSTRAINT "regulatory_evidence_document_source_fk"',
    'CONSTRAINT "regulatory_documents_verification_state"',
    'CREATE CONSTRAINT TRIGGER regulatory_documents_verified_version_guard',
    'CREATE CONSTRAINT TRIGGER regulatory_versions_verified_document_guard',
    'CREATE CONSTRAINT TRIGGER regulatory_evidence_verified_document_guard',
    'DEFERRABLE INITIALLY DEFERRED',
    "version.review_status = 'verified'",
    "evidence.review_status = 'verified'",
  ]) assert.match(migration, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("readiness fails closed when schema or migration metadata is absent", async () => {
  const { client, queries } = mockNeon([{ schema_present: false, migrations_table_present: false }]);
  const result = await checkDatabaseReadiness(client);
  assert.equal(result.ready, false);
  assert.equal(result.schemaPresent, false);
  assert.equal(queries.length, 1);
});

test("readiness rejects an outdated database", async () => {
  const { client, queries } = mockNeon(
    [{ schema_present: true, migrations_table_present: true }],
    [{ migrations_current: false }],
  );
  const result = await checkDatabaseReadiness(client);
  assert.equal(result.ready, false);
  assert.equal(result.migrationsCurrent, false);
  assert.equal(queries.length, 2);
});

test("readiness validates verified document relationships", async () => {
  const healthy = mockNeon(
    [{ schema_present: true, migrations_table_present: true }],
    [{ migrations_current: true }],
    [{ invalid_verified_documents: 0 }],
  );
  assert.equal((await checkDatabaseReadiness(healthy.client)).ready, true);

  const broken = mockNeon(
    [{ schema_present: true, migrations_table_present: true }],
    [{ migrations_current: true }],
    [{ invalid_verified_documents: "1" }],
  );
  const result = await checkDatabaseReadiness(broken.client);
  assert.equal(result.ready, false);
  assert.equal(result.integrityValid, false);
});
