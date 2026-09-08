import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildCorpusReview } from "../scripts/audit-migrated-corpus.mjs";
import { loadAndValidateMigratedCorpus } from "../scripts/validate-migrated-corpus.mjs";

test("migrated corpus is substantial, deduplicated and pending official review", () => {
  const { records, rejected, summary } = loadAndValidateMigratedCorpus();
  assert.equal(summary.records, 90);
  assert.equal(summary.rejected, 14);
  assert.ok(records.every((record) => record.evidenceStatus === "official-source-pending-review"));
  assert.ok(rejected.some((record) => record.reason.startsWith("production-duplicate")));
  assert.ok(rejected.some((record) => record.reason.startsWith("official-url-rejected")));
  assert.ok(rejected.some((record) => record.reason.startsWith("citation-conflict")));
});

test("migration seed cannot promote legacy material to official-verified", () => {
  const seed = fs.readFileSync(new URL("../scripts/seed-migrated-regulatory-corpus.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(seed, /evidence_status\s*=\s*'official-verified'/);
  assert.doesNotMatch(seed, /review_status[^\n]*'verified'/);
  assert.doesNotMatch(seed, /update\s+regulatory_documents/i);
  assert.match(seed, /'official-source-pending-review'/);
  assert.match(seed, /on conflict \(id\) do nothing/);
  assert.match(seed, /existingUrls\.has\(canonicalUrl\)/);
});

test("every accepted record has an auditable pending review entry", () => {
  const review = buildCorpusReview();
  assert.equal(review.summary.recordsReviewed, 90);
  assert.equal(review.summary.newlyVerified, 0);
  assert.equal(review.summary.pending, 90);
  assert.equal(review.records.length, 90);
  assert.ok(review.records.every((record) => record.evidenceStatus === "official-source-pending-review"));
  assert.ok(review.records.every((record) => record.reviewState === "pending"));
  assert.ok(review.records.every((record) => record.verification.citationConsistency === "unconfirmed"));
});
