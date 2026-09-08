import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const legacyIndex = process.argv[2];
if (!legacyIndex) throw new Error("Usage: node scripts/generate-migrated-corpus.mjs <legacy-data/index.json>");

const legacy = JSON.parse(fs.readFileSync(path.resolve(legacyIndex), "utf8"));
const sourceChecks = process.env.MIZAN_SOURCE_CHECK_REPORT
  ? JSON.parse(fs.readFileSync(process.env.MIZAN_SOURCE_CHECK_REPORT, "utf8"))
  : [];
const checksByUrl = new Map(sourceChecks.map((check) => [check.url, check]));

const productionInstrumentNumbers = new Set([
  "federal decree law no 10 of 2025",
  "federal decree law no 30 of 2024",
  "cabinet resolution no 55 of 2026",
  "cabinet resolution no 56 of 2026",
  "federal decree law no 32 of 2025",
  "federal decree law no 33 of 2025",
]);
const rejectedLegacyIds = new Map([
  ["federal-cabinet-resolution-no-134-of-2025", "citation-conflict: reuses the AML Decree-Law URL and requires instrument-level review"],
  ["federal-moet-dnfbp-aml-cft-cpf-guidance-march-2026", "official-url-rejected: official Ministry URL returned 404 on 2026-09-08"],
  ["adgm-fsra-aml-rules-and-guidance", "production-duplicate: existing ADGM FSRA AML framework record uses the same official announcement"],
]);

function normalize(value = "") {
  return value.toLowerCase().replace(/[—–]/g, "-").replace(/\b(ver|version)\s*\d.*$/, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function slug(value = "") {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110);
}
function instrumentType(number = "", title = "") {
  const value = `${number} ${title}`.toLowerCase();
  if (value.includes("federal decree-law") || value.includes("federal law by decree")) return "Federal Decree-Law";
  if (value.includes("federal law")) return "Federal Law";
  if (value.includes("cabinet resolution")) return "Cabinet Resolution";
  if (value.includes("cabinet decision")) return "Cabinet Decision";
  if (value.includes("law no.")) return "Law";
  if (value.includes("regulation")) return "Regulations";
  if (value.includes("rulebook") || value.includes("module")) return "Rulebook";
  if (value.includes("guidance") || value.includes("guideline")) return "Guidance";
  return "Regulatory instrument";
}
function jurisdiction(value) {
  return value === "Federal" ? "UAE Mainland" : value;
}
function status(value) {
  return ({ current: "in-force", superseded: "amended", repealed: "repealed", draft: "draft", unknown: "unknown" })[value] ?? "unknown";
}
function authority(record) {
  return record.regulator || record.authority || (record.jurisdiction === "Federal" ? "UAE Federal Government" : record.jurisdiction);
}
function sourceAuthority(hostname) {
  if (hostname === "uaelegislation.gov.ae") return "UAE Federal Legislation";
  if (hostname.endsWith("difc.com") || hostname === "dfsaen.thomsonreuters.com") return hostname.startsWith("dfsa") ? "Dubai Financial Services Authority" : "Dubai International Financial Centre";
  if (hostname.endsWith("adgm.com")) return "Abu Dhabi Global Market";
  if (hostname.endsWith("centralbank.ae")) return "Central Bank of the UAE";
  if (hostname.endsWith("vara.ae")) return "Virtual Assets Regulatory Authority";
  if (hostname.endsWith("moet.gov.ae")) return "UAE Ministry of Economy and Tourism";
  return authority(record);
}
function applicability(record) {
  const applies = (record.applies_to || []).map((item) => typeof item === "string" ? item : `${item.entity_type}: ${item.condition}`);
  const exclusions = (record.does_not_apply_to || []).map((item) => `Exclusion: ${item}`);
  if (record.trigger_condition) applies.push(`Trigger: ${record.trigger_condition}`);
  return [...new Set([...applies, ...exclusions])];
}
function obligations(record) {
  const values = [];
  if (record.relevance_en) values.push(record.relevance_en);
  if (record.note_en) values.push(record.note_en);
  if (!values.length) values.push("Review the official instrument to determine the operative obligations for the applicable entity, activity or transaction.");
  return values;
}

const accepted = [];
const rejected = [];
const seenInstruments = new Map();
for (const record of legacy) {
  const key = normalize(record.number) || normalize(record.title_en);
  if (seenInstruments.has(key)) {
    rejected.push({ legacyId: record.id, title: record.title_en, reason: `legacy-duplicate: duplicates ${seenInstruments.get(key)}` });
    continue;
  }
  seenInstruments.set(key, record.id);
  if (productionInstrumentNumbers.has(key)) {
    rejected.push({ legacyId: record.id, title: record.title_en, reason: "production-duplicate: instrument is already present in a production seed" });
    continue;
  }
  if (rejectedLegacyIds.has(record.id)) {
    rejected.push({ legacyId: record.id, title: record.title_en, reason: rejectedLegacyIds.get(record.id) });
    continue;
  }
  const url = new URL(record.source_url);
  const check = checksByUrl.get(record.source_url);
  const checkOutcome = check?.ok ? "reachable" : check?.status ? `http-${check.status}` : "not-reconfirmed";
  const number = record.number || null;
  accepted.push({
    id: `legacy-${record.id}`,
    sourceId: `official-${slug(url.hostname + url.pathname)}`,
    sourceAuthority: sourceAuthority(url.hostname),
    sourceJurisdiction: jurisdiction(record.jurisdiction),
    authority: authority(record),
    jurisdiction: jurisdiction(record.jurisdiction),
    officialSourceUrl: record.source_url,
    title: record.title_en,
    titleArabic: record.title_ar || null,
    instrumentType: instrumentType(number, record.title_en),
    instrumentNumber: number,
    status: status(record.status),
    publicationDate: null,
    effectiveDate: record.effective_date || null,
    summary: record.plain_summary_en,
    topics: record.topic_tags || [],
    aliases: record.search_terms || [],
    applicability: applicability(record),
    obligations: obligations(record),
    relatedRecordIds: (record.related_ids || []).map((id) => `legacy-${id}`),
    evidenceStatus: "official-source-pending-review",
    languages: ["en"],
    migrationProvenance: {
      repository: "sweater9/mizan-uae-legal-research",
      legacyId: record.id,
      legacyLastVerifiedClaim: record.last_verified || null,
      sourceCheck: { checkedAt: "2026-09-08", outcome: checkOutcome, httpStatus: check?.status ?? null, finalUrl: check?.finalUrl ?? null },
      reviewNote: "Legacy verification metadata was not trusted. Instrument identity, status, dates and substantive obligations require official-source review before publication.",
    },
  });
}

const acceptedIds = new Set(accepted.map((record) => record.id));
for (const record of accepted) record.relatedRecordIds = record.relatedRecordIds.filter((id) => acceptedIds.has(id));

fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.writeFileSync(path.join(root, "data", "migrated-regulatory-corpus.json"), `${JSON.stringify(accepted, null, 2)}\n`);
fs.writeFileSync(path.join(root, "data", "migrated-regulatory-corpus-rejections.json"), `${JSON.stringify(rejected, null, 2)}\n`);
console.log(`Generated ${accepted.length} pending-review records; rejected ${rejected.length} duplicates or unsupported citations.`);
