import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadAndValidateMigratedCorpus } from "./validate-migrated-corpus.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "data", "migrated-regulatory-corpus-review.json");

function reviewRecord(record) {
  const sourceCheck = record.migrationProvenance?.sourceCheck ?? {};
  const reachable = sourceCheck.httpStatus >= 200 && sourceCheck.httpStatus < 300;
  const accessState = reachable
    ? "reachable-but-not-substantively-verified"
    : "source-inaccessible";

  return {
    id: record.id,
    legacyId: record.migrationProvenance?.legacyId ?? null,
    title: record.title,
    instrumentNumber: record.instrumentNumber ?? null,
    authority: record.authority,
    jurisdiction: record.jurisdiction,
    officialSourceUrl: record.officialSourceUrl,
    evidenceStatus: record.evidenceStatus,
    reviewState: "pending",
    sourceAccess: {
      state: accessState,
      checkedAt: sourceCheck.checkedAt ?? null,
      httpStatus: sourceCheck.httpStatus ?? null,
      finalUrl: sourceCheck.finalUrl ?? record.officialSourceUrl,
    },
    verification: {
      authority: "unconfirmed",
      jurisdiction: "unconfirmed",
      instrumentIdentity: "unconfirmed",
      title: "unconfirmed",
      status: "unconfirmed",
      publicationDate: "unconfirmed",
      issuanceDate: "unconfirmed",
      effectiveDate: "unconfirmed",
      obligations: "unconfirmed",
      applicability: "unconfirmed",
      exclusions: "unconfirmed",
      officialUrl: "citation-only",
      citationConsistency: "unconfirmed",
    },
    reviewNote: reachable
      ? "The official page responded, but no instrument-level human or approved-browser review has reconfirmed the authority, dates, current status, obligations, applicability, exclusions, and citation consistency. Do not promote."
      : `The cited official source was not substantively accessible during the migration audit (HTTP ${sourceCheck.httpStatus ?? "unknown"}). Authority, instrument identity, title, dates, current status, obligations, applicability, exclusions and citation consistency remain unconfirmed. Do not promote.`,
  };
}

export function buildCorpusReview() {
  const { records, rejected } = loadAndValidateMigratedCorpus();
  const reviews = records.map(reviewRecord);
  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    policy: "HTTP reachability and legacy verification claims never establish official verification.",
    summary: {
      recordsReviewed: reviews.length,
      newlyVerified: reviews.filter((record) => record.reviewState === "verified").length,
      pending: reviews.filter((record) => record.reviewState === "pending").length,
      rejectedOrDeduplicated: rejected.length,
    },
    rejectedOrDeduplicated: rejected,
    records: reviews,
  };
}

export function writeCorpusReview() {
  const review = buildCorpusReview();
  fs.writeFileSync(outputPath, `${JSON.stringify(review, null, 2)}\n`);
  return review;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const review = writeCorpusReview();
  console.log(`Corpus review ledger written: ${review.summary.recordsReviewed} pending records; ${review.summary.rejectedOrDeduplicated} rejected or deduplicated.`);
}
