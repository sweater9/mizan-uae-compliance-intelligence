export type RegulatoryStatus = "in-force" | "amended" | "repealed" | "draft" | "unknown";
export type EvidenceStatus = "official-verified" | "official-source-pending-review";
export type RegulatoryLanguage = "en" | "ar";

export interface RegulatoryRecord {
  id: string;
  title: string;
  titleArabic?: string;
  instrumentType: string;
  instrumentNumber?: string;
  authority: string;
  jurisdiction: string;
  topics: string[];
  aliases: string[];
  publicationDate?: string;
  effectiveDate?: string;
  status: RegulatoryStatus;
  officialSourceUrl: string;
  sourceAuthority: string;
  lastVerifiedAt: string;
  summary: string;
  applicability: string[];
  obligations: string[];
  relatedRecordIds: string[];
  evidenceStatus: EvidenceStatus;
  languages: RegulatoryLanguage[];
}

export interface RegulatorySearchFilters {
  jurisdiction?: string;
  authority?: string;
  status?: RegulatoryStatus;
  topic?: string;
  evidenceStatus?: EvidenceStatus;
}

export interface RegulatorySearchResult {
  record: RegulatoryRecord;
  score: number;
  matchedTerms: string[];
}
