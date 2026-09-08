import test from "node:test";
import assert from "node:assert/strict";
import { evaluateApplicability } from "../lib/applicability.ts";

const base = {
  legalName: "Example LLC",
  jurisdiction: "uae_mainland",
  authorities: ["Federal Tax Authority"],
  activities: ["technology services"],
  regulated: false,
  financialServices: false,
  vatStatus: "registered",
  corporateTaxStatus: "registered",
  freeZoneStatus: "mainland",
};

const record = (overrides = {}) => ({
  id: "vat-1", title: "VAT obligations", jurisdiction: "federal",
  authorities: ["Federal Tax Authority"], appliesTo: [{ attribute: "vatStatus", values: ["registered"] }],
  sourceUrl: "https://example.test/official", evidenceStatus: "official-verified", reviewStatus: "verified",
  summary: "Official record", ...overrides,
});

test("verified federal evidence produces a definitive applies result", () => {
  assert.equal(evaluateApplicability(base, [record()])[0].state, "applies");
});

test("pending evidence never produces a definitive applies result", () => {
  const result = evaluateApplicability(base, [record({ evidenceStatus: "official-source-pending-review", reviewStatus: "pending" })])[0];
  assert.equal(result.state, "likely-applies");
  assert.equal(result.evidenceStatus, "official-source-pending-review");
});

test("DIFC and ADGM records do not apply to mainland profiles", () => {
  const result = evaluateApplicability(base, [record({ jurisdiction: "difc" })])[0];
  assert.equal(result.state, "does-not-apply");
  assert.equal(evaluateApplicability({ ...base, jurisdiction: "adgm" }, [record({ jurisdiction: "adgm" })])[0].state, "applies");
});

test("regulated financial institutions and DNFBPs can match alternative scope rules", () => {
  const aml = record({
    id: "aml-1", title: "AML/CFT controls", matchMode: "any",
    appliesTo: [
      { attribute: "financialServices", values: ["true"] },
      { attribute: "dnfbpCategory" },
    ],
  });
  assert.equal(evaluateApplicability({ ...base, regulated: true, financialServices: true }, [aml])[0].state, "applies");
  assert.equal(evaluateApplicability({ ...base, dnfbpCategory: "auditor" }, [aml])[0].state, "applies");
  assert.equal(evaluateApplicability({ ...base, financialServices: false, dnfbpCategory: undefined }, [aml])[0].state, "insufficient-information");
});

test("non-financial businesses do not match a financial-services-only record", () => {
  const result = evaluateApplicability({ ...base, financialServices: false }, [record({
    id: "fs-1", title: "Financial services rule",
    appliesTo: [{ attribute: "financialServices", values: ["true"] }],
  })])[0];
  assert.equal(result.state, "does-not-apply");
});

test("records without structured applicability rules cannot become obligations", () => {
  const result = evaluateApplicability(base, [record({ appliesTo: [] })])[0];
  assert.equal(result.state, "insufficient-information");
});

test("missing profile attributes are conservative and explain the gap", () => {
  const result = evaluateApplicability({ ...base, vatStatus: "unknown" }, [record()])[0];
  assert.equal(result.state, "insufficient-information");
  assert.deepEqual(result.missingInformation, ["vatStatus"]);
});

test("evaluation is deterministic and preserves traceability", () => {
  const records = [record(), record({ id: "aml-1", title: "AML/CFT", appliesTo: [{ attribute: "financialServices", values: ["true"] }] })];
  const first = evaluateApplicability(base, records);
  assert.deepEqual(first, evaluateApplicability(base, records));
  assert.equal(first[0].sourceUrl, "https://example.test/official");
});
