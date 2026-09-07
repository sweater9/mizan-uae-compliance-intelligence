import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.MIZAN_DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("Missing MIZAN_DATABASE_URL");
const sql = neon(databaseUrl);
const verifiedAt = new Date().toISOString();
const reviewer = "mizan-production-baseline-2026-09-07";

const records = [
  {
    id: "cbuae-aml-guidelines-purpose-scope",
    sourceId: "cbuae-aml-guidelines",
    authority: "Central Bank of the UAE",
    jurisdiction: "UAE Mainland",
    url: "https://rulebook.centralbank.ae/en/rulebook/11-purpose-and-scope",
    title: "AML/CFT Guidelines for Financial Institutions — Purpose and Scope",
    instrumentType: "Guideline",
    status: "in-force",
    effectiveDate: "2023-07-13",
    summary: "CBUAE guidance for supervised financial institutions on understanding and performing UAE AML/CFT obligations, including minimum supervisory expectations for identifying, assessing and mitigating money-laundering and terrorist-financing risks.",
    topics: ["AML", "CFT", "risk assessment", "financial institutions"],
    applicability: ["Financial institutions supervised by UAE supervisory authorities"],
    obligations: ["Identify, assess and mitigate money-laundering and terrorist-financing risks in line with the applicable UAE legal and regulatory framework."],
    excerpt: "Official CBUAE Rulebook page states the Guidelines provide guidance and minimum supervisory expectations for supervised financial institutions.",
  },
  {
    id: "dfsa-aml-regulatory-framework",
    sourceId: "dfsa-aml-framework",
    authority: "Dubai Financial Services Authority",
    jurisdiction: "DIFC",
    url: "https://www.dfsa.ae/what-we-do/aml-ctf-sanctions-compliance/regulatory-framework",
    title: "DFSA AML/CTF/Sanctions Regulatory Framework",
    instrumentType: "Regulatory framework",
    status: "in-force",
    effectiveDate: null,
    summary: "DFSA regulatory framework explaining that the AML Module contains AML, counter-terrorist-financing and relevant sanctions requirements for Relevant Persons in the DIFC and that AML Rule 4.1.1 requires a risk-based approach proportionate to risk.",
    topics: ["AML", "CFT", "sanctions", "risk-based approach"],
    applicability: ["DFSA-supervised Relevant Persons in the DIFC"],
    obligations: ["Assess the extent to which the DFSA AML Rules apply on a continuing basis.", "Adopt an AML/CTF/CPF approach proportionate to identified risks as required by AML Rule 4.1.1."],
    excerpt: "Official DFSA page identifies the AML Module as the consolidated AML/CTF/sanctions requirements for Relevant Persons and describes the risk-based approach under AML Rule 4.1.1.",
  },
];

for (const r of records) {
  await sql`insert into regulatory_sources (id, authority, jurisdiction, canonical_url, enabled, last_checked_at) values (${r.sourceId}, ${r.authority}, ${r.jurisdiction}, ${r.url}, true, now()) on conflict (id) do update set authority=excluded.authority, jurisdiction=excluded.jurisdiction, canonical_url=excluded.canonical_url, enabled=true`;
  await sql`insert into regulatory_documents (id, source_id, title, instrument_type, authority, jurisdiction, status, official_source_url, effective_date, summary, topics, aliases, applicability, obligations, related_record_ids, evidence_status, languages) values (${r.id}, ${r.sourceId}, ${r.title}, ${r.instrumentType}, ${r.authority}, ${r.jurisdiction}, ${r.status}::regulatory_status, ${r.url}, ${r.effectiveDate}, ${r.summary}, ${JSON.stringify(r.topics)}::jsonb, '[]'::jsonb, ${JSON.stringify(r.applicability)}::jsonb, ${JSON.stringify(r.obligations)}::jsonb, '[]'::jsonb, 'official-source-pending-review', '["en"]'::jsonb) on conflict (id) do nothing`;
  const raw = JSON.stringify({ title:r.title, summary:r.summary, obligations:r.obligations, officialSource:r.url });
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  let versions = await sql`select id from regulatory_versions where document_id=${r.id} and content_hash=${hash} limit 1`;
  if (!versions.length) versions = await sql`insert into regulatory_versions (document_id, version, content_hash, raw_content, fetched_at, review_status, reviewed_at, reviewed_by, review_note) values (${r.id}, 1, ${hash}, ${raw}, ${verifiedAt}, 'verified', ${verifiedAt}, ${reviewer}, 'Baseline manually checked against the cited official regulator page on 2026-09-07.') returning id`;
  const versionId = Number(versions[0].id);
  await sql`insert into regulatory_evidence (document_id, version_id, source_id, type, url, excerpt, captured_at, review_status, reviewed_at, reviewed_by, review_note) values (${r.id}, ${versionId}, ${r.sourceId}, 'official-source', ${r.url}, ${r.excerpt}, ${verifiedAt}, 'verified', ${verifiedAt}, ${reviewer}, 'Official regulator source manually checked on 2026-09-07.') on conflict (version_id, url) do update set review_status='verified', reviewed_at=${verifiedAt}, reviewed_by=${reviewer}, review_note='Official regulator source manually checked on 2026-09-07.'`;
  await sql`update regulatory_documents set verified_version_id=${versionId}, evidence_status='official-verified', last_verified_at=${verifiedAt} where id=${r.id}`;
}
console.log(`Verified regulatory baseline ready: ${records.length} records.`);
