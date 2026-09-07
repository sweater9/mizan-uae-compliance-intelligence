import test from "node:test";
import assert from "node:assert/strict";
import { decideIngestion } from "../lib/regulatory-ingestion.ts";
import { searchRegulations } from "../lib/regulatory-search.ts";
import { askMizan } from "../lib/ask-mizan.ts";

const record = {
  id: "verified-ubo-test",
  title: "Beneficial Ownership Requirements",
  instrumentType: "regulation",
  instrumentNumber: "TEST-1",
  authority: "Test Official Authority",
  jurisdiction: "Mainland",
  topics: ["UBO", "beneficial ownership"],
  aliases: ["ultimate beneficial owner"],
  status: "in-force",
  officialSourceUrl: "https://example.gov.test/ubo",
  sourceAuthority: "Test Official Authority",
  lastVerifiedAt: "2026-09-05T00:00:00Z",
  summary: "Verified test fixture summary.",
  applicability: ["Test companies"],
  obligations: ["Test obligation"],
  relatedRecordIds: [],
  evidenceStatus: "official-verified",
  languages: ["en"],
};

test("UBO synonym search retrieves beneficial ownership record", () => {
  const results = searchRegulations([record], "What are the UBO requirements?");
  assert.equal(results[0].record.id, record.id);
});

test("jurisdiction filter is deterministic", () => {
  assert.equal(searchRegulations([record], "UBO", { jurisdiction: "Mainland" }).length, 1);
  assert.equal(searchRegulations([record], "UBO", { jurisdiction: "DIFC" }).length, 0);
});

test("unchanged source content does not require processing", () => {
  const first = decideIngestion({ sourceId: "s", canonicalUrl: "https://example.gov.test", fetchedAt: "now", content: "Official text" });
  const second = decideIngestion({ sourceId: "s", canonicalUrl: "https://example.gov.test", fetchedAt: "later", content: "Official   text" }, { sourceId: "s", contentHash: first.contentHash, version: 1 });
  assert.equal(second.changed, false);
  assert.equal(second.requiresProcessing, false);
  assert.equal(second.nextVersion, 1);
});

test("changed content increments version and requires processing", () => {
  const previous = decideIngestion({ sourceId: "s", canonicalUrl: "https://example.gov.test", fetchedAt: "now", content: "Version one" });
  const changed = decideIngestion({ sourceId: "s", canonicalUrl: "https://example.gov.test", fetchedAt: "later", content: "Version two" }, { sourceId: "s", contentHash: previous.contentHash, version: 1 });
  assert.equal(changed.changed, true);
  assert.equal(changed.nextVersion, 2);
  assert.equal(changed.requiresProcessing, true);
});

test("Ask Mizan answers only from retrieved records", () => {
  const result = askMizan([record], "UBO requirements");
  assert.equal(result.verified, true);
  assert.deepEqual(result.recordIds, [record.id]);
  assert.match(result.answer, /Verified test fixture summary/);
});

test("Ask Mizan refuses when verified database has no evidence", () => {
  const result = askMizan([], "What is required?");
  assert.equal(result.verified, false);
  assert.equal(result.sources.length, 0);
  assert.match(result.answer, /does not currently have sufficient verified regulatory information/i);
});
