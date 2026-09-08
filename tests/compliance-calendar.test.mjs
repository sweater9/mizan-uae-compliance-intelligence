import test from "node:test";
import assert from "node:assert/strict";
import { classifyCalendarItems, hasVerifiedCalendarEvidence } from "../lib/compliance-calendar.ts";

const item = (overrides = {}) => ({
  id: "deadline-1", obligationTitle: "Submit return", description: "Submit the verified return.",
  dueDate: "2026-04-15", authority: "Federal Tax Authority", jurisdiction: "federal",
  applicabilityBasis: ["vatStatus=registered"], officialSourceUrl: "https://official.example/return",
  evidenceStatus: "official-verified", verifiedVersionId: 3, evidenceId: 8,
  deadlineBasis: "explicit-official-date",
  lastVerifiedAt: "2026-01-01T00:00:00.000Z", calendarStatus: "active",
  completionState: "open", ...overrides,
});

test("verified applicable deadline retains official evidence and is classified deterministically", () => {
  const result = classifyCalendarItems([item()], new Date("2026-04-01T12:00:00.000Z"));
  assert.equal(result.state, "verified");
  assert.equal(result.items[0].state, "next-30-days");
  assert.equal(result.items[0].officialSourceUrl, "https://official.example/return");
  assert.equal(result.items[0].verifiedVersionId, 3);
});

test("pending, rejected, incomplete and completed items cannot become definitive deadlines", () => {
  const result = classifyCalendarItems([
    item({ evidenceStatus: "official-source-pending-review" }),
    item({ id: "rejected", evidenceStatus: "official-verified", evidenceId: 9, calendarStatus: "rejected" }),
    item({ id: "completed", completionState: "completed" }),
  ], new Date("2026-04-01T00:00:00.000Z"));
  assert.equal(result.state, "insufficient-verified-evidence");
  assert.equal(result.items.length, 0);
});

test("overdue and 90-day boundaries are stable and sorted by nearest due date", () => {
  const result = classifyCalendarItems([
    item({ id: "far", dueDate: "2026-06-30" }),
    item({ id: "overdue", dueDate: "2026-03-31" }),
    item({ id: "today", dueDate: "2026-04-01" }),
  ], new Date("2026-04-01T23:59:00.000Z"));
  assert.deepEqual(result.items.map((entry) => [entry.id, entry.state]), [
    ["overdue", "overdue"], ["today", "due-today"], ["far", "next-90-days"],
  ]);
  assert.deepEqual(result, classifyCalendarItems([
    item({ id: "far", dueDate: "2026-06-30" }),
    item({ id: "overdue", dueDate: "2026-03-31" }),
    item({ id: "today", dueDate: "2026-04-01" }),
  ], new Date("2026-04-01T23:59:00.000Z")));
});

test("descriptive text does not create a deadline without an explicit due date", () => {
  assert.throws(() => classifyCalendarItems([item({ dueDate: "not-a-date" })], new Date("2026-04-01T00:00:00.000Z")), /Invalid calendar date/);
});

test("only a complete verified evidence chain can support a definitive calendar item", () => {
  const chain = {
    evidenceStatus: "official-verified", verifiedVersionId: 3, documentVerifiedVersionId: 3,
    documentLastVerifiedAt: new Date("2026-01-01"), versionDocumentId: "doc-1", documentId: "doc-1",
    versionReviewStatus: "verified", evidenceDocumentId: "doc-1", evidenceVersionId: 3,
    evidenceReviewStatus: "verified", evidenceUrl: "https://official.example/return",
    officialSourceUrl: "https://official.example/return", status: "in-force", jurisdictionMatches: true,
  };
  assert.equal(hasVerifiedCalendarEvidence(chain), true);
  for (const change of [
    { evidenceStatus: "official-source-pending-review" },
    { verifiedVersionId: null },
    { evidenceVersionId: 2 },
    { evidenceReviewStatus: "rejected" },
    { jurisdictionMatches: false },
  ]) assert.equal(hasVerifiedCalendarEvidence({ ...chain, ...change }), false);
});

test("recurrence is accepted only when explicitly supported by the evidence-bound deadline basis", () => {
  assert.equal(classifyCalendarItems([item({ recurrenceRule: "annual", deadlineBasis: "explicit-official-date" })], new Date("2026-04-01")).items.length, 0);
  assert.equal(classifyCalendarItems([item({ recurrenceRule: "annual", deadlineBasis: "explicit-official-recurrence" })], new Date("2026-04-01")).items.length, 1);
});
