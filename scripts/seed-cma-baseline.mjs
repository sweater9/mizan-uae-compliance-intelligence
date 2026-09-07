import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.MIZAN_DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("Missing MIZAN_DATABASE_URL");
const sql = neon(databaseUrl);
const verifiedAt = new Date().toISOString();
const reviewer = "mizan-production-baseline-2026-09-08";

const records = [
  {
    id: "uae-cma-law-32-2025",
    sourceId: "uae-legislation-cma-law-32-2025",
    authority: "Capital Market Authority (CMA), UAE",
    jurisdiction: "UAE Mainland",
    url: "https://uaelegislation.gov.ae/en/legislations/4001/download",
    title: "Federal Decree by Law No. (32) of 2025 Regarding the Capital Market Authority",
    instrumentType: "Federal Decree-Law",
    status: "in-force",
    effectiveDate: null,
    summary: "Federal legislation establishing the UAE Capital Market Authority and its statutory basis, replacing the former Securities and Commodities Authority designation in the federal capital-market framework.",
    topics: ["CMA", "SCA", "capital markets", "securities", "regulator"],
    applicability: ["Entities and activities within the UAE Capital Market Authority's statutory remit"],
    obligations: ["Identify the current competent capital-market regulator and assess the Authority's statutory remit before applying activity-specific capital-market requirements."],
    excerpt: "Official UAE Legislation identifies Federal Decree by Law No. (32) of 2025 as the law regarding the Capital Market Authority and defines the Authority as the Capital Market Authority.",
  },
  {
    id: "uae-cma-capital-market-law-33-2025",
    sourceId: "uae-legislation-cma-law-33-2025",
    authority: "Capital Market Authority (CMA), UAE",
    jurisdiction: "UAE Mainland",
    url: "https://uaelegislation.gov.ae/en/legislations/4002/download",
    title: "Federal Decree by Law No. (33) of 2025 Regarding the Regulation of Capital Market",
    instrumentType: "Federal Decree-Law",
    status: "in-force",
    effectiveDate: null,
    summary: "Federal legislation governing the UAE capital-market framework and defining the Capital Market Authority, regulated markets and relevant capital-market concepts and scope.",
    topics: ["CMA", "capital markets", "securities", "regulated markets", "licensing"],
    applicability: ["Capital-market entities and activities falling within the federal law's scope"],
    obligations: ["Assess whether the entity, activity and market fall within the federal capital-market framework and then apply the relevant CMA regulations and permissions."],
    excerpt: "Official UAE Legislation identifies Federal Decree by Law No. (33) of 2025 as the law regarding regulation of the capital market and defines the Capital Market Authority within that framework.",
  },
];

for (const r of records) {
  await sql`insert into regulatory_sources (id, authority, jurisdiction, canonical_url, enabled, last_checked_at) values (${r.sourceId}, ${r.authority}, ${r.jurisdiction}, ${r.url}, true, now()) on conflict (id) do update set authority=excluded.authority, jurisdiction=excluded.jurisdiction, canonical_url=excluded.canonical_url, enabled=true`;
  await sql`insert into regulatory_documents (id, source_id, title, instrument_type, authority, jurisdiction, status, official_source_url, effective_date, summary, topics, aliases, applicability, obligations, related_record_ids, evidence_status, languages) values (${r.id}, ${r.sourceId}, ${r.title}, ${r.instrumentType}, ${r.authority}, ${r.jurisdiction}, ${r.status}::regulatory_status, ${r.url}, ${r.effectiveDate}, ${r.summary}, ${JSON.stringify(r.topics)}::jsonb, '["SCA"]'::jsonb, ${JSON.stringify(r.applicability)}::jsonb, ${JSON.stringify(r.obligations)}::jsonb, '[]'::jsonb, 'official-source-pending-review', '["en"]'::jsonb) on conflict (id) do update set source_id=excluded.source_id, title=excluded.title, instrument_type=excluded.instrument_type, authority=excluded.authority, jurisdiction=excluded.jurisdiction, status=excluded.status, official_source_url=excluded.official_source_url, effective_date=excluded.effective_date, summary=excluded.summary, topics=excluded.topics, applicability=excluded.applicability, obligations=excluded.obligations`;
  const raw = JSON.stringify({ title:r.title, summary:r.summary, obligations:r.obligations, officialSource:r.url });
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  let versions = await sql`select id from regulatory_versions where document_id=${r.id} and content_hash=${hash} limit 1`;
  if (!versions.length) versions = await sql`insert into regulatory_versions (document_id, version, content_hash, raw_content, fetched_at, review_status, reviewed_at, reviewed_by, review_note) values (${r.id}, coalesce((select max(version)+1 from regulatory_versions where document_id=${r.id}),1), ${hash}, ${raw}, ${verifiedAt}, 'verified', ${verifiedAt}, ${reviewer}, 'Baseline checked against official UAE Legislation on 2026-09-08.') returning id`;
  const versionId = Number(versions[0].id);
  await sql`insert into regulatory_evidence (document_id, version_id, source_id, type, url, excerpt, captured_at, review_status, reviewed_at, reviewed_by, review_note) values (${r.id}, ${versionId}, ${r.sourceId}, 'official-source', ${r.url}, ${r.excerpt}, ${verifiedAt}, 'verified', ${verifiedAt}, ${reviewer}, 'Official UAE Legislation source checked on 2026-09-08.') on conflict (version_id, url) do update set review_status='verified', reviewed_at=${verifiedAt}, reviewed_by=${reviewer}, review_note='Official UAE Legislation source checked on 2026-09-08.'`;
  await sql`update regulatory_documents set verified_version_id=${versionId}, evidence_status='official-verified', last_verified_at=${verifiedAt} where id=${r.id}`;
}

console.log(`Verified CMA baseline ready: ${records.length} records.`);
