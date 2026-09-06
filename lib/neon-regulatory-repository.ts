import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { getDatabase } from "./db";
import { regulatoryDocuments } from "./regulatory-schema";
import { searchRegulations } from "./regulatory-search";
import type { RegulatoryRecord, RegulatorySearchFilters, RegulatorySearchResult } from "./regulatory-types";
import type { RegulatoryRepository } from "./regulatory-repository";

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toVerifiedRecord(row: typeof regulatoryDocuments.$inferSelect): RegulatoryRecord | null {
  const lastVerifiedAt = iso(row.lastVerifiedAt);
  if (row.evidenceStatus !== "official-verified" || !row.verifiedVersionId || !lastVerifiedAt) return null;

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
    lastVerifiedAt,
    summary: row.summary,
    applicability: row.applicability,
    obligations: row.obligations,
    relatedRecordIds: row.relatedRecordIds,
    evidenceStatus: "official-verified",
    languages: row.languages,
  };
}

export class NeonRegulatoryRepository implements RegulatoryRepository {
  async all(): Promise<RegulatoryRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(regulatoryDocuments)
      .where(and(
        eq(regulatoryDocuments.evidenceStatus, "official-verified"),
        isNotNull(regulatoryDocuments.verifiedVersionId),
        isNotNull(regulatoryDocuments.lastVerifiedAt),
      ));

    return rows.flatMap((row) => {
      const record = toVerifiedRecord(row);
      return record ? [record] : [];
    });
  }

  async search(query: string, filters: RegulatorySearchFilters = {}): Promise<RegulatorySearchResult[]> {
    // Keep ranking deterministic and shared between Search and Ask Mizan.
    // SQL-side indexing can replace this when corpus size warrants it without changing callers.
    return searchRegulations(await this.all(), query, filters);
  }
}
