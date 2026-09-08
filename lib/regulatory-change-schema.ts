import { index, integer, jsonb, pgTable, text, timestamp, date } from "drizzle-orm/pg-core";
import { applicabilityResults } from "./company-profile-schema";
import { regulatoryDocuments, regulatoryEvidence, regulatoryVersions } from "./regulatory-schema";

export const regulatoryChangeDefinitions = pgTable("regulatory_change_definitions", {
  id: text("id").primaryKey(),
  regulatoryDocumentId: text("regulatory_document_id").notNull().references(() => regulatoryDocuments.id),
  previousVersionId: integer("previous_version_id").references(() => regulatoryVersions.id),
  currentVersionId: integer("current_version_id").notNull().references(() => regulatoryVersions.id),
  currentEvidenceId: integer("current_evidence_id").notNull().references(() => regulatoryEvidence.id),
  changeType: text("change_type").notNull(),
  issuedDate: date("issued_date"),
  effectiveDate: date("effective_date"),
  summary: text("summary").notNull(),
  affectedObligations: jsonb("affected_obligations").$type<string[]>().notNull().default([]),
  officialSourceUrl: text("official_source_url").notNull(),
  evidenceStatus: text("evidence_status").notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("regulatory_change_definitions_document_idx").on(table.regulatoryDocumentId),
  index("regulatory_change_definitions_current_version_idx").on(table.currentVersionId),
  index("regulatory_change_definitions_current_evidence_idx").on(table.currentEvidenceId),
]);

export const regulatoryChangeAlerts = pgTable("regulatory_change_alerts", {
  id: text("id").primaryKey(),
  changeDefinitionId: text("change_definition_id").notNull().references(() => regulatoryChangeDefinitions.id),
  applicabilityResultId: text("applicability_result_id").references(() => applicabilityResults.id),
  // Legacy claim columns remain for forward-compatible storage, but are never authoritative.
  changeType: text("change_type").notNull(),
  regulatoryDocumentId: text("regulatory_document_id").notNull().references(() => regulatoryDocuments.id),
  previousVersionId: integer("previous_version_id").references(() => regulatoryVersions.id),
  currentVersionId: integer("current_version_id").notNull().references(() => regulatoryVersions.id),
  currentEvidenceId: integer("current_evidence_id").notNull().references(() => regulatoryEvidence.id),
  authority: text("authority").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  issuedDate: date("issued_date"),
  effectiveDate: date("effective_date"),
  summary: text("summary").notNull(),
  affectedObligations: jsonb("affected_obligations").$type<string[]>().notNull().default([]),
  officialSourceUrl: text("official_source_url").notNull(),
  evidenceStatus: text("evidence_status").notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("regulatory_change_alerts_document_idx").on(table.regulatoryDocumentId),
  index("regulatory_change_alerts_effective_idx").on(table.effectiveDate),
  index("regulatory_change_alerts_type_idx").on(table.changeType),
  index("regulatory_change_alerts_current_version_idx").on(table.currentVersionId),
  index("regulatory_change_alerts_definition_idx").on(table.changeDefinitionId),
]);
