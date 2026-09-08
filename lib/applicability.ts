export const JURISDICTIONS = ["uae_mainland", "difc", "adgm"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];
export type EvidenceStatus = "official-verified" | "official-source-pending-review";
export type ReviewStatus = "pending" | "verified" | "rejected";
export type ApplicabilityState = "applies" | "likely-applies" | "does-not-apply" | "insufficient-information";

export type CompanyProfile = {
  legalName: string;
  jurisdiction: Jurisdiction;
  authorities: string[];
  legalForm?: string;
  sector?: string;
  regulated?: boolean;
  financialServices?: boolean;
  activities: string[];
  licenceCategory?: string;
  employeeBand?: string;
  vatStatus?: "registered" | "not-registered" | "unknown";
  corporateTaxStatus?: "registered" | "not-registered" | "unknown";
  amlReportingEntity?: boolean;
  dnfbpCategory?: string;
  freeZoneStatus?: "mainland" | "free-zone" | "financial-free-zone";
};

export type RegulatoryRecord = {
  id: string;
  title: string;
  jurisdiction: "federal" | "uae_mainland" | "difc" | "adgm";
  authorities: string[];
  appliesTo: Array<{ attribute: string; values?: string[]; required?: boolean }>;
  matchMode?: "all" | "any";
  excludes?: Array<{ attribute: string; values: string[] }>;
  sourceUrl: string;
  evidenceStatus: EvidenceStatus;
  reviewStatus: ReviewStatus;
  verifiedVersionId?: number;
  versionId?: number;
  versionDocumentId?: string;
  versionReviewStatus?: ReviewStatus;
  evidenceDocumentId?: string;
  evidenceVersionId?: number;
  evidenceReviewStatus?: ReviewStatus;
  lastVerifiedAt?: Date;
  effectiveDate?: string;
  summary: string;
  version?: string;
};

export type ApplicabilityResult = {
  regulatoryRecordId: string;
  title: string;
  state: ApplicabilityState;
  triggeredAttributes: string[];
  missingInformation: string[];
  reasoning: string;
  authority: string[];
  sourceUrl: string;
  evidenceStatus: EvidenceStatus;
  reviewStatus: ReviewStatus;
};

const get = (profile: CompanyProfile, attribute: string): unknown => profile[attribute as keyof CompanyProfile];

function matchesRule(profile: CompanyProfile, rule: RegulatoryRecord["appliesTo"][number]) {
  const value = get(profile, rule.attribute);
  if (value === undefined || value === null || value === "" || value === "unknown") return "missing";
  if (!rule.values?.length) return value === true || (typeof value === "string" && value.trim().length > 0) || (Array.isArray(value) && value.length > 0) ? "match" : "no-match";
  const values = Array.isArray(value) ? value : [String(value)];
  return values.some((item) => rule.values?.includes(String(item))) ? "match" : "no-match";
}

export function evaluateApplicability(profile: CompanyProfile, records: RegulatoryRecord[]): ApplicabilityResult[] {
  return records.map((record) => {
    const missingInformation: string[] = [];
    const triggeredAttributes: string[] = [];
    const definitiveEvidence = record.evidenceStatus === "official-verified"
      && record.reviewStatus === "verified"
      && record.verifiedVersionId !== undefined
      && record.versionId === record.verifiedVersionId
      && record.versionDocumentId === record.id
      && record.versionReviewStatus === "verified"
      && record.evidenceDocumentId === record.id
      && record.evidenceVersionId === record.verifiedVersionId
      && record.evidenceReviewStatus === "verified"
      && record.lastVerifiedAt instanceof Date
      && !Number.isNaN(record.lastVerifiedAt.getTime());
    if (record.jurisdiction !== "federal" && record.jurisdiction !== profile.jurisdiction) {
      return result(record, "does-not-apply", [], [], "The regulatory record is outside the company jurisdiction.");
    }
    if (record.appliesTo.length === 0) {
      return result(record, "insufficient-information", [], ["structured applicability rules"], "The regulatory record does not yet contain structured applicability rules.");
    }
    const ruleMatches = record.appliesTo.map((rule) => ({ rule, match: matchesRule(profile, rule) }));
    if (record.matchMode === "any") {
      const matching = ruleMatches.filter((entry) => entry.match === "match");
      if (matching.length) triggeredAttributes.push(...matching.map((entry) => entry.rule.attribute));
      else {
        const missing = ruleMatches.filter((entry) => entry.match === "missing" && entry.rule.required !== false);
        if (missing.length) missingInformation.push(...missing.map((entry) => entry.rule.attribute));
        else return result(record, "does-not-apply", [], [], "The profile does not match the record's stated scope.");
      }
    } else {
      for (const { rule, match } of ruleMatches) {
        if (match === "match") triggeredAttributes.push(rule.attribute);
        if (match === "missing" && rule.required !== false) missingInformation.push(rule.attribute);
        if (match === "no-match") return result(record, "does-not-apply", triggeredAttributes, [], "The profile does not match the record's stated scope.");
      }
    }
    for (const exclusion of record.excludes ?? []) {
      const value = get(profile, exclusion.attribute);
      if ((Array.isArray(value) ? value : [String(value)]).some((item) => exclusion.values.includes(String(item)))) {
        return result(record, "does-not-apply", triggeredAttributes, [], "The profile matches an explicit exclusion in the regulatory record.");
      }
    }
    if (missingInformation.length) return result(record, "insufficient-information", triggeredAttributes, missingInformation, "The record may be relevant, but required profile information is missing.");
    if (!definitiveEvidence) return result(record, "likely-applies", triggeredAttributes, [], "The profile matches the record, but the evidence has not passed Mizan's verification gate.");
    return result(record, "applies", triggeredAttributes, [], "The verified regulatory record matches the company's jurisdiction and profile attributes.");
  });
}

function result(record: RegulatoryRecord, state: ApplicabilityState, triggeredAttributes: string[], missingInformation: string[], reasoning: string): ApplicabilityResult {
  return { regulatoryRecordId: record.id, title: record.title, state, triggeredAttributes, missingInformation, reasoning, authority: record.authorities, sourceUrl: record.sourceUrl, evidenceStatus: record.evidenceStatus, reviewStatus: record.reviewStatus };
}
