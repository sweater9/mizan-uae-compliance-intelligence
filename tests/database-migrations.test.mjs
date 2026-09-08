import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkDatabaseReadiness, REQUIRED_MIGRATION_TIMESTAMP } from "../lib/database-readiness.ts";

const migrationUrl = new URL("../drizzle/0000_left_justin_hammer.sql", import.meta.url);
const calendarMigrationUrl = new URL("../drizzle/0002_compliance_calendar.sql", import.meta.url);
const provenanceMigrationUrl = new URL("../drizzle/0003_loving_viper.sql", import.meta.url);
const taxRulesMigrationUrl = new URL("../drizzle/0006_tax_reserve_rules.sql", import.meta.url);
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
  assert.ok(journal.entries.length >= 1);
  assert.equal(journal.entries[0].when, REQUIRED_MIGRATION_TIMESTAMP);
  assert.equal(journal.entries[0].tag, "0000_left_justin_hammer");
  assert.match(journal.entries.at(-1).tag, /^0006_/);
  assert.ok(journal.entries.every((entry, index) => index === 0 || entry.when > journal.entries[index - 1].when));
});

test("change monitor migration creates an alert table linked to verified source records", async () => {
  const migration = await readFile(new URL("../drizzle/0004_clever_juggernaut.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE "regulatory_change_alerts"/);
  assert.match(migration, /current_version_id/);
  assert.match(migration, /current_evidence_id/);
  assert.match(migration, /regulatory_change_alerts_current_version_id/);
  assert.match(migration, /regulatory_change_alerts_current_evidence_id/);
});

test("change definition migration creates the authoritative comparison and alert link", async () => {
  const migration = await readFile(new URL("../drizzle/0005_lean_tiger_shark.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE "regulatory_change_definitions"/);
  assert.match(migration, /regulatory_change_definitions_current_version_id/);
  assert.match(migration, /regulatory_change_definitions_current_evidence_id/);
  assert.match(migration, /ADD COLUMN "change_definition_id"/);
  assert.match(migration, /regulatory_change_alerts_change_definition_id/);
});

test("tax reserve migration adds evidence-bound rules without seeding tax claims", async () => {
  const migration = await readFile(taxRulesMigrationUrl, "utf8");
  assert.match(migration, /CREATE TABLE "regulatory_tax_rules"/);
  for (const field of ["regulatory_document_id", "verified_version_id", "evidence_id", "official_source_url", "last_verified_at"]) assert.match(migration, new RegExp(`"${field}"`));
  assert.match(migration, /regulatory_tax_rules_verified_version_id_regulatory_versions_id_fk/);
  assert.match(migration, /regulatory_tax_rules_evidence_id_regulatory_evidence_id_fk/);
  assert.doesNotMatch(migration, /INSERT\s+INTO/i);
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

test("calendar migration creates a normalized evidence-bound deadline definition", async () => {
  const migration = await readFile(calendarMigrationUrl, "utf8");
  assert.match(migration, /CREATE TABLE "compliance_calendar_items"/);
  assert.ok(migration.indexOf('CREATE TABLE "compliance_calendar_items"') < migration.indexOf('ALTER TABLE "compliance_calendar_items"'));
  assert.doesNotMatch(migration, /deadline_definition_id/);
  const provenance = await readFile(provenanceMigrationUrl, "utf8");
  assert.match(provenance, /CREATE TABLE "regulatory_deadline_definitions"/);
  assert.ok(provenance.indexOf('CREATE TABLE "regulatory_deadline_definitions"') < provenance.indexOf('ALTER TABLE "compliance_calendar_items" ADD COLUMN "deadline_definition_id"'));
  assert.match(provenance, /"verified_version_id" integer NOT NULL/);
  assert.match(provenance, /"evidence_id" integer NOT NULL/);
  assert.match(provenance, /ADD COLUMN "deadline_definition_id" text NOT NULL/);
  assert.match(provenance, /compliance_calendar_items_deadline_definition_id/);
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
