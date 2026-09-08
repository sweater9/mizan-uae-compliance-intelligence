import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { loadAndValidateMigratedCorpus, normalizeInstrument } from "./validate-migrated-corpus.mjs";

const databaseUrl = process.env.MIZAN_DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("Missing MIZAN_DATABASE_URL");
const sql = neon(databaseUrl);
const { records } = loadAndValidateMigratedCorpus();
const fetchedAt = new Date().toISOString();

const existing = await sql`select id, title, instrument_number, official_source_url from regulatory_documents`;
const existingKeys = new Set(existing.map((record) => normalizeInstrument(record.instrument_number) || normalizeInstrument(record.title)));
const existingUrls = new Set(existing.map((record) => record.official_source_url));
let added = 0;
let skipped = 0;

for (const record of records) {
  const instrumentKey = normalizeInstrument(record.instrumentNumber) || normalizeInstrument(record.title);
  if (existingKeys.has(instrumentKey) || (existingUrls.has(record.officialSourceUrl) && !record.instrumentNumber)) {
    skipped += 1;
    continue;
  }

  const sourceRows = await sql`
    insert into regulatory_sources (id, authority, jurisdiction, canonical_url, enabled)
    values (${record.sourceId}, ${record.sourceAuthority}, ${record.sourceJurisdiction}, ${record.officialSourceUrl}, true)
    on conflict (canonical_url) do update set enabled = true
    returning id
  `;
  const sourceId = sourceRows[0].id;
  const inserted = await sql`
    insert into regulatory_documents (
      id, source_id, title, title_arabic, instrument_type, instrument_number, authority, jurisdiction,
      status, official_source_url, publication_date, effective_date, summary, topics, aliases,
      applicability, obligations, related_record_ids, evidence_status, languages
    ) values (
      ${record.id}, ${sourceId}, ${record.title}, ${record.titleArabic}, ${record.instrumentType}, ${record.instrumentNumber},
      ${record.authority}, ${record.jurisdiction}, ${record.status}::regulatory_status, ${record.officialSourceUrl},
      ${record.publicationDate}, ${record.effectiveDate}, ${record.summary}, ${JSON.stringify(record.topics)}::jsonb,
      ${JSON.stringify(record.aliases)}::jsonb, ${JSON.stringify(record.applicability)}::jsonb,
      ${JSON.stringify(record.obligations)}::jsonb, ${JSON.stringify(record.relatedRecordIds)}::jsonb,
      'official-source-pending-review', ${JSON.stringify(record.languages)}::jsonb
    ) on conflict (id) do nothing returning id
  `;
  if (!inserted.length) {
    skipped += 1;
    continue;
  }

  const rawContent = JSON.stringify({
    title: record.title,
    instrumentNumber: record.instrumentNumber,
    summary: record.summary,
    applicability: record.applicability,
    obligations: record.obligations,
    officialSource: record.officialSourceUrl,
    migrationProvenance: record.migrationProvenance,
  });
  const contentHash = crypto.createHash("sha256").update(rawContent).digest("hex");
  const versions = await sql`
    insert into regulatory_versions (document_id, version, content_hash, raw_content, fetched_at, review_status)
    values (${record.id}, 1, ${contentHash}, ${rawContent}, ${fetchedAt}, 'pending')
    returning id
  `;
  await sql`
    insert into regulatory_evidence (document_id, version_id, source_id, type, url, captured_at, review_status, review_note)
    values (${record.id}, ${versions[0].id}, ${sourceId}, 'official-source', ${record.officialSourceUrl}, ${fetchedAt}, 'pending',
      'Migrated from sweater9/mizan-uae-legal-research. The legacy verification claim was not trusted; official instrument review is required before publication.')
  `;
  existingKeys.add(instrumentKey);
  existingUrls.add(record.officialSourceUrl);
  added += 1;
}

console.log(`Migrated corpus seed complete: ${added} pending-review records added; ${skipped} production duplicates skipped.`);
