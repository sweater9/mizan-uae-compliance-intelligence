import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpusPath = path.join(root, "data", "migrated-regulatory-corpus.json");
const rejectionPath = path.join(root, "data", "migrated-regulatory-corpus-rejections.json");
const officialHosts = new Set([
  "uaelegislation.gov.ae",
  "www.difc.com",
  "dfsaen.thomsonreuters.com",
  "www.adgm.com",
  "rulebook.centralbank.ae",
  "rulebooks.vara.ae",
]);

export function normalizeInstrument(value = "") {
  return value.toLowerCase().replace(/[—–]/g, "-").replace(/\b(ver|version)\s*\d.*$/, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function validateMigratedCorpus(records, rejected) {
  const errors = [];
  if (records.length < 50) errors.push(`Expected a meaningful corpus expansion; found only ${records.length} records.`);
  const ids = new Set();
  const instruments = new Set();
  for (const [index, record] of records.entries()) {
    const label = record.id || `record ${index + 1}`;
    for (const field of ["id", "sourceId", "sourceAuthority", "sourceJurisdiction", "authority", "jurisdiction", "officialSourceUrl", "title", "instrumentType", "status", "summary"]) {
      if (!record[field]) errors.push(`${label}: missing ${field}`);
    }
    for (const field of ["topics", "aliases", "applicability", "obligations", "relatedRecordIds", "languages"]) {
      if (!Array.isArray(record[field])) errors.push(`${label}: ${field} must be an array`);
    }
    if (!record.obligations?.length) errors.push(`${label}: obligations must not be empty`);
    if (!record.applicability?.length) errors.push(`${label}: applicability must not be empty`);
    if (record.evidenceStatus !== "official-source-pending-review") errors.push(`${label}: migrated evidence must remain pending review`);
    if (record.verifiedVersionId || record.lastVerifiedAt) errors.push(`${label}: pending records cannot contain verified-version state`);
    let url;
    try { url = new URL(record.officialSourceUrl); } catch { errors.push(`${label}: invalid officialSourceUrl`); }
    if (url && (url.protocol !== "https:" || !officialHosts.has(url.hostname))) errors.push(`${label}: source is not in the official-source allowlist (${url.hostname})`);
    if (ids.has(record.id)) errors.push(`${label}: duplicate id`);
    ids.add(record.id);
    const instrumentKey = normalizeInstrument(record.instrumentNumber) || normalizeInstrument(record.title);
    if (instruments.has(instrumentKey)) errors.push(`${label}: duplicate instrument identity`);
    instruments.add(instrumentKey);
  }
  for (const record of records) for (const relatedId of record.relatedRecordIds) if (!ids.has(relatedId)) errors.push(`${record.id}: missing related record ${relatedId}`);
  if (!rejected.length) errors.push("Expected an auditable rejection list for duplicates and unsupported citations.");
  if (errors.length) throw new Error(`Migrated corpus validation failed:\n- ${errors.join("\n- ")}`);
  return { records: records.length, rejected: rejected.length };
}

export function loadAndValidateMigratedCorpus() {
  const records = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
  const rejected = JSON.parse(fs.readFileSync(rejectionPath, "utf8"));
  return { records, rejected, summary: validateMigratedCorpus(records, rejected) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { summary } = loadAndValidateMigratedCorpus();
  console.log(`Migrated corpus valid: ${summary.records} pending-review records; ${summary.rejected} rejected duplicates or unsupported citations.`);
}
