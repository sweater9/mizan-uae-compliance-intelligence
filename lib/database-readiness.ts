import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export const REQUIRED_MIGRATION_TIMESTAMP = 1788685698753;

export interface DatabaseReadiness {
  ready: boolean;
  migrationsCurrent: boolean;
  schemaPresent: boolean;
  integrityValid: boolean;
  reason?: string;
}

type ReadinessRow = {
  schema_present: boolean;
  migrations_table_present: boolean;
};

type MigrationRow = {
  migrations_current: boolean;
};

type IntegrityRow = {
  invalid_verified_documents: number | string;
};

export async function checkDatabaseReadiness(client?: NeonQueryFunction<false, false>): Promise<DatabaseReadiness> {
  const databaseUrl = process.env.MIZAN_DATABASE_URL?.trim();
  if (!client && !databaseUrl) {
    return { ready: false, migrationsCurrent: false, schemaPresent: false, integrityValid: false, reason: "MIZAN_DATABASE_URL is not configured." };
  }

  const sql = client ?? neon(databaseUrl!);
  const [catalog] = await sql`
    select
      to_regclass('public.regulatory_sources') is not null
        and to_regclass('public.regulatory_documents') is not null
        and to_regclass('public.regulatory_versions') is not null
        and to_regclass('public.regulatory_evidence') is not null
        and to_regclass('public.regulatory_update_runs') is not null as schema_present,
      to_regclass('drizzle.__drizzle_migrations') is not null as migrations_table_present
  ` as ReadinessRow[];

  if (!catalog?.schema_present || !catalog.migrations_table_present) {
    return {
      ready: false,
      migrationsCurrent: false,
      schemaPresent: Boolean(catalog?.schema_present),
      integrityValid: false,
      reason: !catalog?.schema_present ? "Regulatory database schema is incomplete." : "Drizzle migration metadata is missing.",
    };
  }

  const [migration] = await sql`
    select coalesce(max(created_at) >= ${REQUIRED_MIGRATION_TIMESTAMP}, false) as migrations_current
    from drizzle.__drizzle_migrations
  ` as MigrationRow[];
  if (!migration?.migrations_current) {
    return { ready: false, migrationsCurrent: false, schemaPresent: true, integrityValid: false, reason: "Database migrations are not current." };
  }

  const [integrity] = await sql`
    select count(*)::int as invalid_verified_documents
    from regulatory_documents document
    left join regulatory_versions version
      on version.id = document.verified_version_id
      and version.document_id = document.id
      and version.review_status = 'verified'
    left join regulatory_evidence evidence
      on evidence.version_id = version.id
      and evidence.document_id = document.id
      and evidence.source_id = document.source_id
      and evidence.review_status = 'verified'
    where document.evidence_status = 'official-verified'
      and (version.id is null or evidence.id is null)
  ` as IntegrityRow[];
  const integrityValid = Number(integrity?.invalid_verified_documents ?? 1) === 0;

  return {
    ready: integrityValid,
    migrationsCurrent: true,
    schemaPresent: true,
    integrityValid,
    reason: integrityValid ? undefined : "Verified regulatory documents have invalid version or evidence relationships.",
  };
}

export async function assertDatabaseReady(client?: NeonQueryFunction<false, false>) {
  const readiness = await checkDatabaseReadiness(client);
  if (!readiness.ready) throw new Error(readiness.reason ?? "Database is not ready.");
  return readiness;
}
