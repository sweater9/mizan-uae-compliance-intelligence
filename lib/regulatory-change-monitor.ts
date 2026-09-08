export const CHANGE_TYPES = [
  "new-regulation", "amendment", "repeal-replacement", "effective-date-change",
  "obligation-change", "reporting-deadline-change", "scope-applicability-change",
] as const;
export type ChangeType = typeof CHANGE_TYPES[number];

export type ChangeEvidenceChain = {
  documentId: string;
  documentEvidenceStatus: string;
  documentVerifiedVersionId?: number | null;
  documentLastVerifiedAt?: Date | string | null;
  documentStatus: string;
  currentVersionId: number;
  currentVersionDocumentId: string;
  currentVersionReviewStatus: string;
  previousVersionId?: number | null;
  previousVersionDocumentId?: string | null;
  previousVersionReviewStatus?: string | null;
  evidenceId: number;
  evidenceDocumentId: string;
  evidenceVersionId: number;
  evidenceReviewStatus: string;
  evidenceUrl: string;
  officialSourceUrl: string;
  definitionChangeType: string;
  definitionDocumentId: string;
  definitionPreviousVersionId?: number | null;
  definitionCurrentVersionId: number;
  definitionCurrentEvidenceId: number;
  definitionSummary: string;
  definitionAffectedObligations: string[];
  definitionIssuedDate?: string | null;
  definitionEffectiveDate?: string | null;
  definitionOfficialSourceUrl: string;
  definitionEvidenceStatus: string;
  definitionLastVerifiedAt?: Date | string | null;
};

export function isDefinitiveChange(chain: ChangeEvidenceChain): boolean {
  const previousId = chain.definitionPreviousVersionId;
  if (chain.definitionCurrentVersionId !== chain.currentVersionId
    || chain.definitionCurrentEvidenceId !== chain.evidenceId
    || chain.definitionChangeType === "new-regulation" && previousId !== null && previousId !== undefined
    || chain.definitionChangeType !== "new-regulation" && (previousId === null || previousId === undefined)
    || previousId !== null && previousId !== undefined && previousId === chain.definitionCurrentVersionId) return false;
  const previousOk = previousId === null || previousId === undefined
    ? true
    : chain.previousVersionId === previousId
      && chain.previousVersionDocumentId === chain.documentId && chain.previousVersionReviewStatus === "verified";
  return chain.documentId === chain.definitionDocumentId
    && chain.documentId === chain.currentVersionDocumentId
    && CHANGE_TYPES.includes(chain.definitionChangeType as ChangeType)
    && chain.definitionSummary.trim().length > 0
    && chain.definitionOfficialSourceUrl === chain.officialSourceUrl
    && chain.definitionEvidenceStatus === "official-verified"
    && Boolean(chain.definitionLastVerifiedAt)
    && chain.documentEvidenceStatus === "official-verified"
    && chain.documentVerifiedVersionId === chain.currentVersionId
    && Boolean(chain.documentLastVerifiedAt)
    && (chain.documentStatus === "in-force" || chain.documentStatus === "amended" || chain.documentStatus === "repealed")
    && chain.currentVersionReviewStatus === "verified"
    && previousOk
    && chain.evidenceDocumentId === chain.documentId
    && chain.evidenceVersionId === chain.currentVersionId
    && chain.evidenceReviewStatus === "verified"
    && chain.evidenceUrl === chain.officialSourceUrl;
}

export type ChangeItem = {
  id: string;
  authority: string;
  jurisdiction: string;
  changeType: ChangeType;
  issuedDate?: string;
  effectiveDate?: string;
  summary: string;
  affectedObligations: string[];
  officialSourceUrl: string;
  currentVersionId: number;
  previousVersionId?: number;
  currentEvidenceId: number;
  lastVerifiedAt: string;
  definitionId?: string;
  applicability: "applies" | "not-applicable" | "insufficient-information" | "not-assessed";
};

export function filterAndSortChanges(items: ChangeItem[], filters: {
  jurisdiction?: string; authority?: string; changeType?: string; appliesToCompany?: boolean;
} = {}): ChangeItem[] {
  return items.filter((item) =>
    (!filters.jurisdiction || item.jurisdiction === filters.jurisdiction)
    && (!filters.authority || item.authority === filters.authority)
    && (!filters.changeType || item.changeType === filters.changeType)
    && (!filters.appliesToCompany || item.applicability === "applies"),
  ).sort((a, b) => (a.effectiveDate ?? "9999-12-31").localeCompare(b.effectiveDate ?? "9999-12-31")
    || b.lastVerifiedAt.localeCompare(a.lastVerifiedAt) || a.id.localeCompare(b.id));
}
