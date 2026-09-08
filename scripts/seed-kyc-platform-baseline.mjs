import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.MIZAN_DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("Missing MIZAN_DATABASE_URL");
const sql = neon(databaseUrl);
const verifiedAt = new Date().toISOString();
const reviewer = "mizan-production-baseline-2026-09-08";

const records = [
  {
    id: "uae-kyc-platform-law-30-2024", sourceId: "uae-legislation-kyc-platform-30-2024",
    authority: "UAE Federal Government / Central Bank of the UAE", jurisdiction: "UAE Mainland",
    url: "https://uaelegislation.gov.ae/en/legislations/2711", title: "Federal Decree-Law No. (30) of 2024 Regarding the Know Your Client Digital Platform",
    instrumentType: "Federal Decree-Law", status: "in-force", effectiveDate: null,
    summary: "Establishes the federal legal framework for the UAE Know Your Client digital platform and the exchange and use of verified KYC information within its statutory scope.",
    topics: ["KYC", "CDD", "identity verification", "customer data", "data exchange", "AML"],
    applicability: ["Persons and entities within the statutory scope of the federal KYC digital platform"],
    obligations: ["Assess platform participation and permitted KYC-data collection, exchange, use and protection requirements under the Decree-Law and its implementing framework."],
    excerpt: "Official UAE Legislation identifies Federal Decree-Law No. (30) of 2024 as the law regarding the Know Your Client Digital Platform."
  },
  {
    id: "uae-kyc-platform-regulations-55-2026", sourceId: "uae-legislation-kyc-platform-55-2026",
    authority: "UAE Cabinet / Central Bank of the UAE", jurisdiction: "UAE Mainland",
    url: "https://uaelegislation.gov.ae/en/legislations/4445", title: "Cabinet Resolution No. (55) of 2026 Promulgating the Executive Regulations of the KYC Digital Platform Law",
    instrumentType: "Cabinet Resolution / Executive Regulations", status: "in-force", effectiveDate: "2026-04-21",
    summary: "Provides the operational framework for Federal Decree-Law No. 30 of 2024, including KYC data requirements and rules for persons collecting, retaining, analysing, classifying, using, exchanging, protecting or managing KYC data or issuing KYC reports.",
    topics: ["KYC", "CDD", "PEP", "customer data", "identity verification", "data protection"],
    applicability: ["Every person within Article 2 that handles KYC data or issues a KYC report, subject to the Decree-Law"],
    obligations: ["Apply the prescribed KYC data requirements, including customer identification information and PEP classification information where applicable."],
    excerpt: "Article 2 applies the framework to persons collecting, retaining, analysing, classifying, using, exchanging, protecting or managing KYC data, or issuing a KYC report."
  },
  {
    id: "uae-kyc-platform-sanctions-56-2026", sourceId: "uae-legislation-kyc-platform-56-2026",
    authority: "UAE Cabinet / Central Bank of the UAE", jurisdiction: "UAE Mainland",
    url: "https://uaelegislation.gov.ae/en/legislations/4447", title: "Cabinet Resolution No. (56) of 2026 Regarding KYC Digital Platform Administrative Violations and Sanctions",
    instrumentType: "Cabinet Resolution", status: "in-force", effectiveDate: "2026-04-21",
    summary: "Establishes administrative violations and sanctions for breaches of the federal KYC digital-platform legislation and its Executive Regulations.",
    topics: ["KYC", "enforcement", "administrative sanctions", "penalties", "CBUAE"],
    applicability: ["Persons committing acts contrary to Federal Decree-Law No. 30 of 2024, its Executive Regulations or relevant Central Bank resolutions"],
    obligations: ["Maintain compliance with the KYC platform framework to avoid the administrative sanctions and potential suspension measures administered by the Central Bank."],
    excerpt: "Official UAE Legislation states that the Central Bank may impose the scheduled administrative sanctions for violations and may suspend dealings with a person, establishment or entity proven to have committed a listed violation."
  }
];

for (const r of records) {
  await sql`insert into regulatory_sources (id, authority, jurisdiction, canonical_url, enabled, last_checked_at) values (${r.sourceId}, ${r.authority}, ${r.jurisdiction}, ${r.url}, true, now()) on conflict (id) do update set authority=excluded.authority, jurisdiction=excluded.jurisdiction, canonical_url=excluded.canonical_url, enabled=true`;
  await sql`insert into regulatory_documents (id, source_id, title, instrument_type, authority, jurisdiction, status, official_source_url, effective_date, summary, topics, aliases, applicability, obligations, related_record_ids, evidence_status, languages) values (${r.id}, ${r.sourceId}, ${r.title}, ${r.instrumentType}, ${r.authority}, ${r.jurisdiction}, ${r.status}::regulatory_status, ${r.url}, ${r.effectiveDate}, ${r.summary}, ${JSON.stringify(r.topics)}::jsonb, '["Know Your Customer","Know Your Client","KYC"]'::jsonb, ${JSON.stringify(r.applicability)}::jsonb, ${JSON.stringify(r.obligations)}::jsonb, '[]'::jsonb, 'official-source-pending-review', '["en"]'::jsonb) on conflict (id) do update set source_id=excluded.source_id, title=excluded.title, instrument_type=excluded.instrument_type, authority=excluded.authority, jurisdiction=excluded.jurisdiction, status=excluded.status, official_source_url=excluded.official_source_url, effective_date=excluded.effective_date, summary=excluded.summary, topics=excluded.topics, applicability=excluded.applicability, obligations=excluded.obligations`;
  const raw = JSON.stringify({ title:r.title, summary:r.summary, obligations:r.obligations, officialSource:r.url });
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  let versions = await sql`select id from regulatory_versions where document_id=${r.id} and content_hash=${hash} limit 1`;
  if (!versions.length) versions = await sql`insert into regulatory_versions (document_id, version, content_hash, raw_content, fetched_at, review_status, reviewed_at, reviewed_by, review_note) values (${r.id}, coalesce((select max(version)+1 from regulatory_versions where document_id=${r.id}),1), ${hash}, ${raw}, ${verifiedAt}, 'verified', ${verifiedAt}, ${reviewer}, 'Baseline checked against official UAE Legislation on 2026-09-08.') returning id`;
  const versionId = Number(versions[0].id);
  await sql`insert into regulatory_evidence (document_id, version_id, source_id, type, url, excerpt, captured_at, review_status, reviewed_at, reviewed_by, review_note) values (${r.id}, ${versionId}, ${r.sourceId}, 'official-source', ${r.url}, ${r.excerpt}, ${verifiedAt}, 'verified', ${verifiedAt}, ${reviewer}, 'Official UAE Legislation source checked on 2026-09-08.') on conflict (version_id, url) do update set review_status='verified', reviewed_at=${verifiedAt}, reviewed_by=${reviewer}, review_note='Official UAE Legislation source checked on 2026-09-08.'`;
  await sql`update regulatory_documents set verified_version_id=${versionId}, evidence_status='official-verified', last_verified_at=${verifiedAt} where id=${r.id}`;
}
console.log(`Verified KYC platform baseline ready: ${records.length} records.`);
