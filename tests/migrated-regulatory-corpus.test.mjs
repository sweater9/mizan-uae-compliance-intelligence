import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
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
});
