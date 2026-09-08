import { index, integer, jsonb, pgTable, text, timestamp, date } from "drizzle-orm/pg-core";
import { companyProfiles, applicabilityResults } from "./company-profile-schema";
import { regulatoryDocuments, regulatoryEvidence, regulatoryVersions } from "./regulatory-schema";

export const complianceCalendarItems = pgTable("compliance_calendar_items", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => companyProfiles.id),
  regulatoryDocumentId: text("regulatory_document_id").notNull().references(() => regulatoryDocuments.id),
  applicabilityResultId: text("applicability_result_id").notNull().references(() => applicabilityResults.id),
  verifiedVersionId: integer("verified_version_id").notNull().references(() => regulatoryVersions.id),
  evidenceId: integer("evidence_id").notNull().references(() => regulatoryEvidence.id),
  authority: text("authority").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  obligationTitle: text("obligation_title").notNull(),
  description: text("description").notNull(),
  effectiveDate: date("effective_date"),
  dueDate: date("due_date").notNull(),
  recurrenceRule: text("recurrence_rule"),
  deadlineBasis: text("deadline_basis").notNull().default("explicit-official-date"),
  applicabilityBasis: jsonb("applicability_basis").$type<string[]>().notNull().default([]),
  officialSourceUrl: text("official_source_url").notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull(),
  evidenceStatus: text("evidence_status").notNull(),
  calendarStatus: text("calendar_status").notNull().default("active"),
  completionState: text("completion_state").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("compliance_calendar_items_profile_due_idx").on(table.profileId, table.dueDate),
  index("compliance_calendar_items_document_idx").on(table.regulatoryDocumentId),
]);
