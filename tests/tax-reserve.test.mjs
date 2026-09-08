import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { calculateTaxReserve, INSUFFICIENT_TAX_EVIDENCE, isVerifiedTaxRule, validateTaxReserveInput } from "../lib/tax-reserve.ts";
import { OPTIONS, POST } from "../app/api/tax-reserve/route.ts";

const input = (overrides = {}) => ({
  profileId: "profile-1", reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-12-31", scenario: "current",
  revenue: 2_000_000, accountingProfit: 600_000, taxAdjustments: 25_000, corporateTaxPaid: 5_000,
  vatTaxableSales: 1_000_000, vatCollected: 50_000, recoverableInputVat: 20_000, vatPaid: 2_000,
  amountAlreadyReserved: 20_000, ...overrides,
});

function rule(overrides = {}) {
  return {
    ruleId: "ct-rule", regulatoryDocumentId: "doc-1", taxType: "corporate_tax", ruleKind: "progressive-rate-bands",
    ruleLabel: "Verified Corporate Tax bands", parameters: { bands: [{ fromInclusive: 0, toExclusive: 375_000, rate: 0 }, { fromInclusive: 375_000, toExclusive: null, rate: 0.09 }] }, applicableFrom: "2025-01-01", applicableTo: null,
    authority: "Official authority", jurisdiction: "federal", officialSourceUrl: "https://official.example/tax",
    evidenceStatus: "official-verified", verifiedVersionId: 3, evidenceId: 8, verifiedVersionLabel: "2",
    verificationDate: "2026-01-10T00:00:00.000Z", documentVerifiedVersionId: 3,
    documentLastVerifiedAt: "2026-01-10T00:00:00.000Z", documentStatus: "in-force", documentJurisdiction: "federal", documentAuthority: "Official authority",
    versionId: 3, versionDocumentId: "doc-1", versionReviewStatus: "verified", evidenceDocumentId: "doc-1",
    evidenceVersionId: 3, evidenceReviewStatus: "verified", evidenceUrl: "https://official.example/tax", applicabilityState: "applies", ...overrides,
  };
}
const vatRule = (overrides = {}) => rule({ ruleId: "vat-rule", regulatoryDocumentId: "doc-2", taxType: "vat", ruleKind: "net-output-minus-recoverable-input", ruleLabel: "Verified VAT net-position rule", parameters: {}, versionDocumentId: "doc-2", evidenceDocumentId: "doc-2", documentJurisdiction: "federal", ...overrides });

test("verified applicable rules and valid inputs produce deterministic Corporate Tax and VAT estimates", () => {
  const first = calculateTaxReserve(input(), [rule(), vatRule()], "uae_mainland");
  const second = calculateTaxReserve(input(), [rule(), vatRule()], "uae_mainland");
  assert.deepEqual(first, second);
  assert.equal(first.corporateTax.amount, 22_500);
  assert.equal(first.corporateTax.recommendedReserve, 17_500);
  assert.equal(first.vat.amount, 30_000);
  assert.equal(first.vat.recommendedReserve, 28_000);
});

test("pending or rejected regulatory material cannot drive a calculation", () => {
  for (const invalid of [rule({ versionReviewStatus: "pending" }), rule({ evidenceReviewStatus: "rejected" }), rule({ evidenceStatus: "official-source-pending-review" })]) {
    const result = calculateTaxReserve(input({ vatCollected: undefined, recoverableInputVat: undefined }), [invalid], "uae_mainland");
    assert.equal(result.corporateTax.state, "insufficient-verified-evidence");
    assert.equal(result.corporateTax.message, INSUFFICIENT_TAX_EVIDENCE);
  }
});

test("mismatched document, version, evidence or official source chains are rejected", () => {
  for (const invalid of [rule({ versionDocumentId: "other" }), rule({ documentVerifiedVersionId: 4 }), rule({ evidenceVersionId: 4 }), rule({ evidenceUrl: "https://official.example/other" })]) {
    assert.equal(isVerifiedTaxRule(invalid, "uae_mainland"), false);
  }
});

test("missing applicable verified rate returns the exact insufficient-evidence state", () => {
  const result = calculateTaxReserve(input({ vatCollected: undefined, recoverableInputVat: undefined }), [], "uae_mainland");
  assert.equal(result.state, "insufficient-verified-evidence");
  assert.equal(result.corporateTax.message, INSUFFICIENT_TAX_EVIDENCE);
});

test("multiple applicable rules fail closed instead of selecting an arbitrary rate", () => {
  const duplicate = rule({ ruleId: "ct-rule-2" });
  const result = calculateTaxReserve(input({ vatCollected: undefined, recoverableInputVat: undefined }), [rule(), duplicate], "uae_mainland");
  assert.equal(result.corporateTax.state, "insufficient-verified-evidence");
});

test("a verified rule must cover the entire reporting period", () => {
  const result = calculateTaxReserve(input({ vatCollected: undefined, recoverableInputVat: undefined }), [rule({ applicableFrom: "2026-06-01" })], "uae_mainland");
  assert.equal(result.corporateTax.state, "insufficient-verified-evidence");
});

test("VAT and reserve gap/surplus arithmetic are deterministic", () => {
  const gap = calculateTaxReserve(input({ accountingProfit: undefined, taxAdjustments: undefined, amountAlreadyReserved: 10_000 }), [vatRule()], "uae_mainland");
  assert.equal(gap.vat.amount, 30_000); assert.equal(gap.vat.recommendedReserve, 28_000); assert.equal(gap.reserveGap, 18_000); assert.equal(gap.reserveSurplus, 0);
  const surplus = calculateTaxReserve(input({ accountingProfit: undefined, taxAdjustments: undefined, amountAlreadyReserved: 40_000 }), [vatRule()], "uae_mainland");
  assert.equal(surplus.reserveGap, 0); assert.equal(surplus.reserveSurplus, 12_000);
});

test("scenarios change financial amounts but never regulatory rates", () => {
  const current = calculateTaxReserve(input(), [rule(), vatRule()], "uae_mainland");
  const conservative = calculateTaxReserve(input({ scenario: "conservative" }), [rule(), vatRule()], "uae_mainland");
  const custom = calculateTaxReserve(input({ scenario: "custom", profitChangePercent: 20, vatChangePercent: 5 }), [rule(), vatRule()], "uae_mainland");
  assert.ok(conservative.corporateTax.amount > current.corporateTax.amount);
  assert.ok(custom.corporateTax.amount > conservative.corporateTax.amount);
  for (const result of [current, conservative, custom]) assert.match(result.corporateTax.basis.at(-1), /9%/);
});

test("malformed, negative impossible, non-finite and out-of-range inputs are rejected", () => {
  for (const invalid of [null, input({ revenue: -1 }), input({ vatCollected: Number.NaN }), input({ recoverableInputVat: Number.POSITIVE_INFINITY }), input({ amountAlreadyReserved: 1e20 }), input({ scenario: "invented" }), input({ reportingPeriodEnd: "bad" })]) {
    assert.ok(validateTaxReserveInput(invalid).errors.length > 0);
  }
  assert.ok(validateTaxReserveInput(input({ accountingProfit: -50_000, taxAdjustments: -1_000 })).input, "losses and legitimate negative tax adjustments remain valid");
});

test("Company Profile jurisdiction and applicability are respected", () => {
  assert.equal(isVerifiedTaxRule(rule({ jurisdiction: "difc", documentJurisdiction: "difc" }), "uae_mainland"), false);
  assert.equal(isVerifiedTaxRule(rule({ applicabilityState: "likely-applies" }), "uae_mainland"), false);
  assert.equal(isVerifiedTaxRule(rule(), "uae_mainland"), true);
});

test("every returned regulatory assumption contains inspectable official evidence", () => {
  const result = calculateTaxReserve(input(), [rule(), vatRule()], "uae_mainland");
  for (const evidence of [...result.corporateTax.evidence, ...result.vat.evidence]) {
    assert.equal(evidence.evidenceStatus, "official-verified"); assert.ok(evidence.authority); assert.ok(evidence.jurisdiction);
    assert.match(evidence.officialSourceUrl, /^https:\/\//); assert.ok(evidence.verifiedVersionId); assert.ok(evidence.verificationDate);
  }
});

test("Tax Reserve API enforces exact-origin CORS and rejects malformed inputs before database access", async () => {
  const saved = process.env.CORS_ORIGIN; process.env.CORS_ORIGIN = "https://allowed.example";
  try {
    const allowed = OPTIONS(new Request("https://mizan.test/api/tax-reserve", { method: "OPTIONS", headers: { Origin: "https://allowed.example" } }));
    assert.equal(allowed.status, 204); assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://allowed.example");
    const denied = OPTIONS(new Request("https://mizan.test/api/tax-reserve", { method: "OPTIONS", headers: { Origin: "https://attacker.example" } }));
    assert.equal(denied.status, 403); assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
    const malformed = await POST(new Request("https://mizan.test/api/tax-reserve", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }));
    assert.equal(malformed.status, 400);
    const oversized = await POST(new Request("https://mizan.test/api/tax-reserve", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "24001" }, body: "{}" }));
    assert.equal(oversized.status, 413);
  } finally { if (saved === undefined) delete process.env.CORS_ORIGIN; else process.env.CORS_ORIGIN = saved; }
});

test("pending PR #14 corpus material cannot silently populate production tax rules", async () => {
  const migration = await readFile(new URL("../drizzle/0006_tax_reserve_rules.sql", import.meta.url), "utf8");
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+"?regulatory_tax_rules/i);
  for (const file of ["migrated-regulatory-corpus.json", "migrated-regulatory-corpus-review.json", "migrated-regulatory-corpus-rejections.json"]) {
    const content = await readFile(new URL(`../data/${file}`, import.meta.url), "utf8");
    assert.ok(content.length > 0);
  }
});

test("upcoming tax actions are sourced only by filtering the verified Compliance Calendar result", async () => {
  const source = await readFile(new URL("../server/tax-reserve.ts", import.meta.url), "utf8");
  assert.match(source, /await getComplianceCalendar\(input\.profileId\)/);
  assert.match(source, /upcomingTaxActions: calendar\.items\.filter/);
  assert.doesNotMatch(source, /dueDate:\s*["'`]/);
});
