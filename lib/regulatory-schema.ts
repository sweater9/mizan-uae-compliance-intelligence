import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const regulatorySources = sqliteTable("regulatory_sources", {
  id: text("id").primaryKey(),
  authority: text("authority").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastCheckedAt: text("last_checked_at"),
  lastChangedAt: text("last_changed_at"),
});

export const regulatoryDocuments = sqliteTable("regulatory_documents", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => regulatorySources.id),
  title: text("title").notNull(),
  titleArabic: text("title_arabic"),
  instrumentType: text("instrument_type").notNull(),
  instrumentNumber: text("instrument_number"),
  authority: text("authority").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  status: text("status").notNull(),
  officialSourceUrl: text("official_source_url").notNull(),
  publicationDate: text("publication_date"),
  effectiveDate: text("effective_date"),
  summary: text("summary").notNull(),
  topicsJson: text("topics_json").notNull().default("[]"),
  aliasesJson: text("aliases_json").notNull().default("[]"),
  applicabilityJson: text("applicability_json").notNull().default("[]"),
  obligationsJson: text("obligations_json").notNull().default("[]"),
  relatedRecordIdsJson: text("related_record_ids_json").notNull().default("[]"),
  evidenceStatus: text("evidence_status").notNull(),
  languagesJson: text("languages_json").notNull().default("[]"),
  lastVerifiedAt: text("last_verified_at").notNull(),
});

export const regulatoryVersions = sqliteTable("regulatory_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentId: text("document_id").notNull().references(() => regulatoryDocuments.id),
  version: integer("version").notNull(),
  contentHash: text("content_hash").notNull(),
  rawContent: text("raw_content").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => ({ documentVersion: uniqueIndex("regulatory_version_unique").on(table.documentId, table.version) }));

export const regulatoryUpdateRuns = sqliteTable("regulatory_update_runs", {
  id: text("id").primaryKey(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
  checkedSources: integer("checked_sources").notNull().default(0),
  changedSources: integer("changed_sources").notNull().default(0),
  processedDocuments: integer("processed_documents").notNull().default(0),
  errorSummary: text("error_summary"),
});
