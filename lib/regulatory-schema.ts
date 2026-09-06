import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const regulatorySources = pgTable("regulatory_sources", {
  id: text("id").primaryKey(),
  authority: text("authority").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
});

export const regulatoryDocuments = pgTable("regulatory_documents", {
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
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  applicability: jsonb("applicability").$type<string[]>().notNull().default([]),
  obligations: jsonb("obligations").$type<string[]>().notNull().default([]),
  relatedRecordIds: jsonb("related_record_ids").$type<string[]>().notNull().default([]),
  evidenceStatus: text("evidence_status").notNull(),
  languages: jsonb("languages").$type<Array<"en" | "ar">>().notNull().default([]),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull(),
});

export const regulatoryVersions = pgTable("regulatory_versions", {
  id: serial("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => regulatoryDocuments.id),
  version: integer("version").notNull(),
  contentHash: text("content_hash").notNull(),
  rawContent: text("raw_content").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("regulatory_version_unique").on(table.documentId, table.version)]);

export const regulatoryUpdateRuns = pgTable("regulatory_update_runs", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull(),
  checkedSources: integer("checked_sources").notNull().default(0),
  changedSources: integer("changed_sources").notNull().default(0),
  processedDocuments: integer("processed_documents").notNull().default(0),
  errorSummary: text("error_summary"),
});
