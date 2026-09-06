import "server-only";

import { getDatabase } from "./db";
import { regulatoryDocuments } from "./regulatory-schema";
import { searchRegulations } from "./regulatory-search";
import type { RegulatoryRecord, RegulatorySearchFilters, RegulatorySearchResult } from "./regulatory-types";
import type { RegulatoryRepository } from "./regulatory-repository";

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined;
}

function toRecord(row: typeof regulatoryDocuments.$inferSelect): RegulatoryRecord {
  return {
    id: row.id,
    title: row.title,
    titleArabic: row.titleArabic ?? undefined,
    instrumentType: row.instrumentType,
    instrumentNumber: row.instrumentNumber ?? undefined,
    authority: row.authority,
    jurisdiction: row.jurisdiction,
    topics: row.topics,
    aliases: row.aliases,
    publicationDate: row.publicationDate ?? undefined,
    effectiveDate: row.effectiveDate ?? undefined,
    status: row.status as RegulatoryRecord["status"],
    officialSourceUrl: row.officialSourceUrl,
    sourceAuthority: row.authority,
    lastVerifiedAt: iso(row.lastVerifiedAt)!,
    summary: row.summary,
    applicability: row.applicability,
    obligations: row.obligations,
    relatedRecordIds: row.relatedRecordIds,
    evidenceStatus: row.evidenceStatus as RegulatoryRecord["evidenceStatus"],
    languages: row.languages,
  };
}

export class NeonRegulatoryRepository implements RegulatoryRepository {
  async all(): Promise<RegulatoryRecord[]> {
    const rows = await getDatabase().select().from(regulatoryDocuments);
    return rows.map(toRecord);
  }

  async search(query: string, filters: RegulatorySearchFilters = {}): Promise<RegulatorySearchResult[]> {
    // Keep ranking deterministic and shared between Search and Ask Mizan.
    // SQL-side indexing can replace this when corpus size warrants it without changing callers.
    return searchRegulations(await this.all(), query, filters);
  }
}
