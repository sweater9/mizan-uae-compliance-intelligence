import { type AnyPgColumn, boolean, check, date, foreignKey, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const regulatoryStatus = pgEnum("regulatory_status", ["in-force", "amended", "repealed", "draft", "unknown"]);
export const evidenceStatus = pgEnum("evidence_status", ["official-verified", "official-source-pending-review"]);
export const reviewStatus = pgEnum("review_status", ["pending", "verified", "rejected"]);
export const evidenceType = pgEnum("evidence_type", ["official-source", "official-publication"]);
export const updateRunStatus = pgEnum("update_run_status", ["running", "succeeded", "partial", "failed"]);

export const regulatorySources = pgTable("regulatory_sources", {
  id: text("id").primaryKey(),
  authority: text("authority").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("regulatory_sources_canonical_url_unique").on(table.canonicalUrl),
  check("regulatory_sources_changed_after_checked", sql`${table.lastChangedAt} is null or ${table.lastCheckedAt} is null or ${table.lastChangedAt} <= ${table.lastCheckedAt}`),
]);

export const regulatoryDocuments = pgTable("regulatory_documents", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => regulatorySources.id, { onDelete: "restrict", onUpdate: "cascade" }),
  verifiedVersionId: integer("verified_version_id").references((): AnyPgColumn => regulatoryVersions.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  titleArabic: text("title_arabic"),
  instrumentType: text("instrument_type").notNull(),
  instrumentNumber: text("instrument_number"),
  authority: text("authority").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  status: regulatoryStatus("status").notNull(),
  officialSourceUrl: text("official_source_url").notNull(),
  publicationDate: date("publication_date"),
  effectiveDate: date("effective_date"),
  summary: text("summary").notNull(),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  applicability: jsonb("applicability").$type<string[]>().notNull().default([]),
  obligations: jsonb("obligations").$type<string[]>().notNull().default([]),
  relatedRecordIds: jsonb("related_record_ids").$type<string[]>().notNull().default([]),
  evidenceStatus: evidenceStatus("evidence_status").notNull().default("official-source-pending-review"),
  languages: jsonb("languages").$type<Array<"en" | "ar">>().notNull().default([]),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
}, (table) => [
  index("regulatory_documents_source_idx").on(table.sourceId),
  uniqueIndex("regulatory_documents_source_instrument_unique").on(table.sourceId, table.instrumentType, table.instrumentNumber),
  uniqueIndex("regulatory_documents_id_source_unique").on(table.id, table.sourceId),
  check("regulatory_documents_topics_array", sql`jsonb_typeof(${table.topics}) = 'array'`),
  check("regulatory_documents_aliases_array", sql`jsonb_typeof(${table.aliases}) = 'array'`),
  check("regulatory_documents_applicability_array", sql`jsonb_typeof(${table.applicability}) = 'array'`),
  check("regulatory_documents_obligations_array", sql`jsonb_typeof(${table.obligations}) = 'array'`),
  check("regulatory_documents_related_ids_array", sql`jsonb_typeof(${table.relatedRecordIds}) = 'array'`),
  check("regulatory_documents_languages_valid", sql`jsonb_typeof(${table.languages}) = 'array' and ${table.languages} <@ '["en", "ar"]'::jsonb`),
  check("regulatory_documents_verification_state", sql`(${table.evidenceStatus} = 'official-verified' and ${table.verifiedVersionId} is not null and ${table.lastVerifiedAt} is not null) or (${table.evidenceStatus} = 'official-source-pending-review' and ${table.verifiedVersionId} is null and ${table.lastVerifiedAt} is null)`),
]);

export const regulatoryVersions = pgTable("regulatory_versions", {
  id: serial("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => regulatoryDocuments.id, { onDelete: "cascade", onUpdate: "cascade" }),
  version: integer("version").notNull(),
  contentHash: text("content_hash").notNull(),
  rawContent: text("raw_content").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  reviewStatus: reviewStatus("review_status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("regulatory_versions_document_version_unique").on(table.documentId, table.version),
  uniqueIndex("regulatory_versions_document_hash_unique").on(table.documentId, table.contentHash),
  uniqueIndex("regulatory_versions_id_document_unique").on(table.id, table.documentId),
  check("regulatory_versions_version_positive", sql`${table.version} > 0`),
  check("regulatory_versions_hash_sha256", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
  check("regulatory_versions_review_complete", sql`(${table.reviewStatus} = 'pending' and ${table.reviewedAt} is null and ${table.reviewedBy} is null) or (${table.reviewStatus} in ('verified', 'rejected') and ${table.reviewedAt} is not null and nullif(btrim(${table.reviewedBy}), '') is not null)`),
]);

export const regulatoryEvidence = pgTable("regulatory_evidence", {
  id: serial("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => regulatoryDocuments.id, { onDelete: "cascade", onUpdate: "cascade" }),
  versionId: integer("version_id").notNull(),
  sourceId: text("source_id").notNull().references(() => regulatorySources.id, { onDelete: "restrict", onUpdate: "cascade" }),
  type: evidenceType("type").notNull(),
  url: text("url").notNull(),
  excerpt: text("excerpt"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  reviewStatus: reviewStatus("review_status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("regulatory_evidence_version_url_unique").on(table.versionId, table.url),
  foreignKey({
    columns: [table.versionId, table.documentId],
    foreignColumns: [regulatoryVersions.id, regulatoryVersions.documentId],
    name: "regulatory_evidence_version_document_fk",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.documentId, table.sourceId],
    foreignColumns: [regulatoryDocuments.id, regulatoryDocuments.sourceId],
    name: "regulatory_evidence_document_source_fk",
  }).onDelete("cascade").onUpdate("cascade"),
  index("regulatory_evidence_document_idx").on(table.documentId),
  index("regulatory_evidence_source_idx").on(table.sourceId),
  check("regulatory_evidence_review_complete", sql`(${table.reviewStatus} = 'pending' and ${table.reviewedAt} is null and ${table.reviewedBy} is null) or (${table.reviewStatus} in ('verified', 'rejected') and ${table.reviewedAt} is not null and nullif(btrim(${table.reviewedBy}), '') is not null)`),
]);

export const regulatoryUpdateRuns = pgTable("regulatory_update_runs", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: updateRunStatus("status").notNull(),
  checkedSources: integer("checked_sources").notNull().default(0),
  changedSources: integer("changed_sources").notNull().default(0),
  processedDocuments: integer("processed_documents").notNull().default(0),
  errorSummary: text("error_summary"),
}, (table) => [
  index("regulatory_update_runs_started_at_idx").on(table.startedAt),
  check("regulatory_update_runs_counts_nonnegative", sql`${table.checkedSources} >= 0 and ${table.changedSources} >= 0 and ${table.processedDocuments} >= 0`),
  check("regulatory_update_runs_changed_lte_checked", sql`${table.changedSources} <= ${table.checkedSources}`),
  check("regulatory_update_runs_finished_state", sql`(${table.status} = 'running' and ${table.finishedAt} is null) or (${table.status} <> 'running' and ${table.finishedAt} is not null and ${table.finishedAt} >= ${table.startedAt})`),
]);
