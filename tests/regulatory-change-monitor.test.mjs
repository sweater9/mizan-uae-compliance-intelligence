import test from "node:test";
import assert from "node:assert/strict";
import { filterAndSortChanges, isDefinitiveChange } from "../lib/regulatory-change-monitor.ts";

const chain = (overrides = {}) => ({
  documentId: "doc-1", documentEvidenceStatus: "official-verified", documentVerifiedVersionId: 2,
  documentLastVerifiedAt: new Date("2026-08-01"), documentStatus: "amended",
  currentVersionId: 2, currentVersionDocumentId: "doc-1", currentVersionReviewStatus: "verified",
  previousVersionId: 1, previousVersionDocumentId: "doc-1", previousVersionReviewStatus: "verified",
  evidenceId: 22, evidenceDocumentId: "doc-1", evidenceVersionId: 2,
  evidenceReviewStatus: "verified", evidenceUrl: "https://official.example/change",
  officialSourceUrl: "https://official.example/change",
  definitionDocumentId: "doc-1", definitionChangeType: "amendment",
  definitionPreviousVersionId: 1, definitionCurrentVersionId: 2, definitionCurrentEvidenceId: 22,
  definitionSummary: "Verified amendment", definitionAffectedObligations: ["Report"],
  definitionOfficialSourceUrl: "https://official.example/change",
  definitionEvidenceStatus: "official-verified", definitionLastVerifiedAt: new Date("2026-08-01"), ...overrides,
});

test("verified old and new versions with matching evidence produce a definitive change", () => {
  assert.equal(isDefinitiveChange(chain()), true);
});

test("pending, rejected, mismatched, or unchanged source chains cannot produce alerts", () => {
  for (const overrides of [
    { documentEvidenceStatus: "official-source-pending-review" },
    { currentVersionReviewStatus: "rejected" },
    { evidenceReviewStatus: "rejected" },
    { currentVersionDocumentId: "other-doc" },
    { evidenceVersionId: 1 },
    { previousVersionDocumentId: "other-doc" },
    { documentVerifiedVersionId: 1 },
  ]) assert.equal(isDefinitiveChange(chain(overrides)), false);
});

test("unchanged version identity is not a change", () => {
  assert.equal(isDefinitiveChange(chain({ previousVersionId: 2 })), false);
});

test("verified changes retain source and version traceability", () => {
  const items = [{
    id: "change-1", authority: "DFSA", jurisdiction: "difc", changeType: "amendment",
    effectiveDate: "2026-10-01", summary: "Verified amendment", affectedObligations: ["Report"],
    officialSourceUrl: "https://official.example/change", currentVersionId: 2, previousVersionId: 1,
    currentEvidenceId: 22, lastVerifiedAt: "2026-08-01T00:00:00.000Z", applicability: "applies",
  }];
  assert.equal(items[0].officialSourceUrl.startsWith("https://"), true);
  assert.equal(items[0].currentVersionId, 2);
  assert.equal(items[0].currentEvidenceId, 22);
});

test("change filtering and ordering are deterministic and company-aware", () => {
  const items = [
    { id: "b", authority: "DFSA", jurisdiction: "difc", changeType: "amendment", effectiveDate: "2026-12-01", summary: "B", affectedObligations: [], officialSourceUrl: "https://b", currentVersionId: 2, currentEvidenceId: 2, lastVerifiedAt: "2026-08-02", applicability: "not-applicable" },
    { id: "a", authority: "DFSA", jurisdiction: "difc", changeType: "amendment", effectiveDate: "2026-10-01", summary: "A", affectedObligations: [], officialSourceUrl: "https://a", currentVersionId: 3, currentEvidenceId: 3, lastVerifiedAt: "2026-08-03", applicability: "applies" },
  ];
  assert.deepEqual(filterAndSortChanges(items, { appliesToCompany: true }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterAndSortChanges(items, { jurisdiction: "difc" }).map((item) => item.id), ["a", "b"]);
});

test("insufficient applicability is never treated as definitive company applicability", () => {
  const item = { id: "a", authority: "FSRA", jurisdiction: "adgm", changeType: "scope-applicability-change", summary: "Verified", affectedObligations: [], officialSourceUrl: "https://a", currentVersionId: 2, currentEvidenceId: 2, lastVerifiedAt: "2026-08-01", applicability: "insufficient-information" };
  assert.deepEqual(filterAndSortChanges([item], { appliesToCompany: true }), []);
});

test("descriptive text alone cannot create a change", () => {
  assert.equal(isDefinitiveChange(chain({ currentVersionId: 1, previousVersionId: 1 })), false);
});

test("alert-owned claims cannot override the verified definition", () => {
  const verified = chain();
  assert.equal(isDefinitiveChange({ ...verified, definitionSummary: "" }), false);
  assert.equal(isDefinitiveChange({ ...verified, definitionEffectiveDate: "2026-01-01" }), true);
});

test("definition version and evidence mismatches are rejected", () => {
  for (const overrides of [
    { definitionPreviousVersionId: 3 },
    { definitionCurrentVersionId: 3 },
    { definitionCurrentEvidenceId: 99 },
    { definitionDocumentId: "other-doc" },
    { definitionEvidenceStatus: "official-source-pending-review" },
    { definitionEvidenceStatus: "rejected" },
  ]) assert.equal(isDefinitiveChange(chain(overrides)), false);
});

test("new regulations require explicit new classification and may omit a previous version", () => {
  assert.equal(isDefinitiveChange(chain({
    definitionChangeType: "new-regulation",
    definitionPreviousVersionId: null,
    previousVersionId: null,
    previousVersionDocumentId: null,
    previousVersionReviewStatus: null,
  })), true);
  assert.equal(isDefinitiveChange(chain({
    definitionChangeType: "new-regulation",
    definitionPreviousVersionId: 1,
    previousVersionId: 1,
  })), false);
  assert.equal(isDefinitiveChange(chain({
    definitionChangeType: "amendment",
    definitionPreviousVersionId: null,
    previousVersionId: null,
  })), false);
});

test("applicability state is independent of regulatory-change provenance", () => {
  assert.equal(isDefinitiveChange(chain()), true);
  assert.equal(isDefinitiveChange(chain({ definitionSummary: "Same verified amendment" })), true);
});
