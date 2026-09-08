import { check, date, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { regulatoryDocuments, regulatoryEvidence, regulatoryVersions } from "./regulatory-schema";

export const regulatoryTaxRules = pgTable("regulatory_tax_rules", {
  id: text("id").primaryKey(),
  regulatoryDocumentId: text("regulatory_document_id").notNull().references(() => regulatoryDocuments.id, { onDelete: "restrict" }),
  verifiedVersionId: integer("verified_version_id").notNull().references(() => regulatoryVersions.id, { onDelete: "restrict" }),
  evidenceId: integer("evidence_id").notNull().references(() => regulatoryEvidence.id, { onDelete: "restrict" }),
  taxType: text("tax_type").notNull(),
  ruleKind: text("rule_kind").notNull(),
  ruleLabel: text("rule_label").notNull(),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull(),
  applicableFrom: date("applicable_from").notNull(),
  applicableTo: date("applicable_to"),
  authority: text("authority").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  officialSourceUrl: text("official_source_url").notNull(),
  evidenceStatus: text("evidence_status").notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("regulatory_tax_rules_document_idx").on(table.regulatoryDocumentId),
  index("regulatory_tax_rules_tax_type_idx").on(table.taxType),
  check("regulatory_tax_rules_tax_type_valid", sql`${table.taxType} in ('corporate_tax', 'vat')`),
  check("regulatory_tax_rules_kind_valid", sql`${table.ruleKind} in ('progressive-rate-bands', 'net-output-minus-recoverable-input')`),
  check("regulatory_tax_rules_parameters_object", sql`jsonb_typeof(${table.parameters}) = 'object'`),
  check("regulatory_tax_rules_period_valid", sql`${table.applicableTo} is null or ${table.applicableTo} >= ${table.applicableFrom}`),
]);
