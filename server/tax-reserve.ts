import { and, desc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "../lib/db";
import { applicabilityAssessments, applicabilityResults, companyProfiles } from "../lib/company-profile-schema";
import { regulatoryDocuments, regulatoryEvidence, regulatoryVersions } from "../lib/regulatory-schema";
import { regulatoryTaxRules } from "../lib/tax-reserve-schema";
import { calculateTaxReserve, type TaxRuleEvidence, type TaxRuleKind, type TaxType, type TaxReserveInput } from "../lib/tax-reserve";
import { getComplianceCalendar } from "./compliance-calendar";

export async function createTaxReserveAssessment(input: TaxReserveInput) {
  const db = getDatabase();
  const profiles = await db.select().from(companyProfiles).where(eq(companyProfiles.id, input.profileId)).limit(1);
  const profile = profiles[0];
  if (!profile) return null;
  const assessments = await db.select().from(applicabilityAssessments)
    .where(eq(applicabilityAssessments.profileId, input.profileId)).orderBy(desc(applicabilityAssessments.createdAt)).limit(1);
  const latestAssessment = assessments[0];
  const rows = latestAssessment ? await db.select({
    ruleId: regulatoryTaxRules.id, regulatoryDocumentId: regulatoryTaxRules.regulatoryDocumentId,
    taxType: regulatoryTaxRules.taxType, ruleKind: regulatoryTaxRules.ruleKind, ruleLabel: regulatoryTaxRules.ruleLabel,
    parameters: regulatoryTaxRules.parameters, applicableFrom: regulatoryTaxRules.applicableFrom, applicableTo: regulatoryTaxRules.applicableTo,
    authority: regulatoryTaxRules.authority, jurisdiction: regulatoryTaxRules.jurisdiction,
    ruleOfficialSourceUrl: regulatoryTaxRules.officialSourceUrl, ruleEvidenceStatus: regulatoryTaxRules.evidenceStatus,
    ruleVerifiedVersionId: regulatoryTaxRules.verifiedVersionId, ruleEvidenceId: regulatoryTaxRules.evidenceId,
    ruleLastVerifiedAt: regulatoryTaxRules.lastVerifiedAt,
    documentVerifiedVersionId: regulatoryDocuments.verifiedVersionId, documentLastVerifiedAt: regulatoryDocuments.lastVerifiedAt,
    documentStatus: regulatoryDocuments.status, documentJurisdiction: regulatoryDocuments.jurisdiction, documentAuthority: regulatoryDocuments.authority,
    versionId: regulatoryVersions.id, versionNumber: regulatoryVersions.version, versionDocumentId: regulatoryVersions.documentId,
    versionReviewStatus: regulatoryVersions.reviewStatus, evidenceDocumentId: regulatoryEvidence.documentId,
    evidenceVersionId: regulatoryEvidence.versionId, evidenceReviewStatus: regulatoryEvidence.reviewStatus,
    evidenceUrl: regulatoryEvidence.url, applicabilityState: applicabilityResults.state,
  }).from(regulatoryTaxRules)
    .innerJoin(regulatoryDocuments, eq(regulatoryDocuments.id, regulatoryTaxRules.regulatoryDocumentId))
    .innerJoin(regulatoryVersions, eq(regulatoryVersions.id, regulatoryTaxRules.verifiedVersionId))
    .innerJoin(regulatoryEvidence, eq(regulatoryEvidence.id, regulatoryTaxRules.evidenceId))
    .innerJoin(applicabilityResults, and(
      eq(applicabilityResults.assessmentId, latestAssessment.id),
      eq(applicabilityResults.regulatoryDocumentId, regulatoryTaxRules.regulatoryDocumentId),
    ))
    .where(and(
      eq(regulatoryTaxRules.evidenceStatus, "official-verified"),
      eq(regulatoryDocuments.evidenceStatus, "official-verified"),
      inArray(regulatoryDocuments.status, ["in-force", "amended"]),
      eq(regulatoryDocuments.verifiedVersionId, regulatoryTaxRules.verifiedVersionId),
      eq(regulatoryDocuments.lastVerifiedAt, regulatoryTaxRules.lastVerifiedAt),
      eq(regulatoryVersions.documentId, regulatoryTaxRules.regulatoryDocumentId),
      eq(regulatoryVersions.reviewStatus, "verified"),
      eq(regulatoryEvidence.documentId, regulatoryTaxRules.regulatoryDocumentId),
      eq(regulatoryEvidence.versionId, regulatoryTaxRules.verifiedVersionId),
      eq(regulatoryEvidence.sourceId, regulatoryDocuments.sourceId),
      eq(regulatoryEvidence.reviewStatus, "verified"),
      eq(regulatoryEvidence.url, regulatoryTaxRules.officialSourceUrl),
      eq(regulatoryDocuments.officialSourceUrl, regulatoryTaxRules.officialSourceUrl),
      eq(applicabilityResults.state, "applies"),
    )) : [];
  const rules: TaxRuleEvidence[] = rows.map((row) => ({
    ruleId: row.ruleId, regulatoryDocumentId: row.regulatoryDocumentId, taxType: row.taxType as TaxType,
    ruleKind: row.ruleKind as TaxRuleKind, ruleLabel: row.ruleLabel, parameters: row.parameters, applicableFrom: row.applicableFrom, applicableTo: row.applicableTo,
    authority: row.authority, jurisdiction: row.jurisdiction, officialSourceUrl: row.ruleOfficialSourceUrl,
    evidenceStatus: row.ruleEvidenceStatus, verifiedVersionId: row.ruleVerifiedVersionId, evidenceId: row.ruleEvidenceId,
    verifiedVersionLabel: String(row.versionNumber), verificationDate: row.ruleLastVerifiedAt.toISOString(),
    documentVerifiedVersionId: row.documentVerifiedVersionId, documentLastVerifiedAt: row.documentLastVerifiedAt?.toISOString() ?? null,
    documentStatus: row.documentStatus, documentJurisdiction: row.documentJurisdiction, documentAuthority: row.documentAuthority, versionId: row.versionId,
    versionDocumentId: row.versionDocumentId, versionReviewStatus: row.versionReviewStatus,
    evidenceDocumentId: row.evidenceDocumentId, evidenceVersionId: row.evidenceVersionId,
    evidenceReviewStatus: row.evidenceReviewStatus, evidenceUrl: row.evidenceUrl,
    applicabilityState: row.applicabilityState,
  }));
  const assessment = calculateTaxReserve(input, rules, profile.jurisdiction);
  const taxDocumentIds = new Set(rules.map((rule) => rule.regulatoryDocumentId));
  const calendar = await getComplianceCalendar(input.profileId);
  return {
    profile: { id: profile.id, legalName: profile.legalName, jurisdiction: profile.jurisdiction, vatStatus: profile.vatStatus, corporateTaxStatus: profile.corporateTaxStatus },
    assessment,
    upcomingTaxActions: calendar.items.filter((item) => taxDocumentIds.has(item.regulatoryDocumentId)),
    deadlineEvidenceState: calendar.state,
  };
}
