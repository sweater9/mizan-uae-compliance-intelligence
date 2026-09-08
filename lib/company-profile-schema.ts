import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { regulatoryDocuments } from "./regulatory-schema";
import { workspaces } from "./auth-schema";

export const companyProfiles = pgTable("company_profiles", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  ownerKey: text("owner_key"),
  legalName: text("legal_name").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  authorities: jsonb("authorities").$type<string[]>().notNull().default([]),
  legalForm: text("legal_form"),
  sector: text("sector"),
  regulated: boolean("regulated"),
  financialServices: boolean("financial_services"),
  activities: jsonb("activities").$type<string[]>().notNull().default([]),
  licenceCategory: text("licence_category"),
  employeeBand: text("employee_band"),
  vatStatus: text("vat_status"),
  corporateTaxStatus: text("corporate_tax_status"),
  amlReportingEntity: boolean("aml_reporting_entity"),
  dnfbpCategory: text("dnfbp_category"),
  freeZoneStatus: text("free_zone_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("company_profiles_workspace_idx").on(table.workspaceId)]);

export const applicabilityAssessments = pgTable("applicability_assessments", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull().references(() => companyProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("applicability_assessments_profile_idx").on(table.profileId)]);

export const applicabilityResults = pgTable("applicability_results", {
  id: text("id").primaryKey(),
  assessmentId: text("assessment_id").notNull().references(() => applicabilityAssessments.id),
  regulatoryDocumentId: text("regulatory_document_id").notNull().references(() => regulatoryDocuments.id),
  state: text("state").notNull(),
  triggeredAttributes: jsonb("triggered_attributes").$type<string[]>().notNull().default([]),
  missingInformation: jsonb("missing_information").$type<string[]>().notNull().default([]),
  reasoning: text("reasoning").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("applicability_results_assessment_idx").on(table.assessmentId)]);
