import { alias } from "drizzle-orm/pg-core";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDatabase } from "../lib/db";
import { applicabilityAssessments, applicabilityResults, companyProfiles } from "../lib/company-profile-schema";
import { regulatoryDocuments, regulatoryEvidence, regulatoryVersions } from "../lib/regulatory-schema";
import { regulatoryChangeAlerts, regulatoryChangeDefinitions } from "../lib/regulatory-change-schema";
import { filterAndSortChanges, isDefinitiveChange, type ChangeItem } from "../lib/regulatory-change-monitor";

const previousVersions = alias(regulatoryVersions, "previous_versions");

export async function getRegulatoryChanges(profileId?: string, filters: { jurisdiction?: string; authority?: string; changeType?: string; appliesToCompany?: boolean } = {}) {
  const db = getDatabase();
  const profile = profileId ? (await db.select().from(companyProfiles).where(eq(companyProfiles.id, profileId)).limit(1))[0] : undefined;
  if (profileId && !profile) return { state: "insufficient-verified-evidence" as const, items: [] as ChangeItem[] };
  const rows = await db.select({
    alert: regulatoryChangeAlerts,
    definition: regulatoryChangeDefinitions,
    document: regulatoryDocuments,
    currentVersion: regulatoryVersions,
    currentEvidence: regulatoryEvidence,
    previousVersion: previousVersions,
    applicabilityState: applicabilityResults.state,
    applicabilityProfileId: applicabilityAssessments.profileId,
  }).from(regulatoryChangeAlerts)
    .innerJoin(regulatoryChangeDefinitions, eq(regulatoryChangeDefinitions.id, regulatoryChangeAlerts.changeDefinitionId))
    .innerJoin(regulatoryDocuments, eq(regulatoryDocuments.id, regulatoryChangeDefinitions.regulatoryDocumentId))
    .innerJoin(regulatoryVersions, eq(regulatoryVersions.id, regulatoryChangeDefinitions.currentVersionId))
    .leftJoin(previousVersions, eq(previousVersions.id, regulatoryChangeDefinitions.previousVersionId))
    .innerJoin(regulatoryEvidence, eq(regulatoryEvidence.id, regulatoryChangeDefinitions.currentEvidenceId))
    .leftJoin(applicabilityResults, eq(applicabilityResults.id, regulatoryChangeAlerts.applicabilityResultId))
    .leftJoin(applicabilityAssessments, eq(applicabilityAssessments.id, applicabilityResults.assessmentId))
    .where(and(
      eq(regulatoryChangeAlerts.evidenceStatus, "official-verified"),
      eq(regulatoryDocuments.evidenceStatus, "official-verified"),
      isNotNull(regulatoryDocuments.verifiedVersionId),
      isNotNull(regulatoryDocuments.lastVerifiedAt),
      eq(regulatoryDocuments.verifiedVersionId, regulatoryChangeDefinitions.currentVersionId),
      eq(regulatoryVersions.documentId, regulatoryChangeDefinitions.regulatoryDocumentId),
      eq(regulatoryVersions.reviewStatus, "verified"),
      eq(regulatoryEvidence.documentId, regulatoryChangeDefinitions.regulatoryDocumentId),
      eq(regulatoryEvidence.id, regulatoryChangeDefinitions.currentEvidenceId),
      eq(regulatoryEvidence.versionId, regulatoryChangeDefinitions.currentVersionId),
      eq(regulatoryEvidence.sourceId, regulatoryDocuments.sourceId),
      eq(regulatoryEvidence.reviewStatus, "verified"),
    ));
  const items = rows.flatMap((row) => {
    const { alert, definition, document, currentVersion, currentEvidence, previousVersion, applicabilityState, applicabilityProfileId } = row;
    if (!isDefinitiveChange({
      documentId: document.id, documentEvidenceStatus: document.evidenceStatus,
      documentVerifiedVersionId: document.verifiedVersionId, documentLastVerifiedAt: document.lastVerifiedAt,
      documentStatus: document.status, currentVersionId: currentVersion.id, currentVersionDocumentId: currentVersion.documentId,
      currentVersionReviewStatus: currentVersion.reviewStatus, previousVersionId: definition.previousVersionId,
      previousVersionDocumentId: previousVersion?.documentId, previousVersionReviewStatus: previousVersion?.reviewStatus,
      evidenceId: currentEvidence.id, evidenceDocumentId: currentEvidence.documentId, evidenceVersionId: currentEvidence.versionId,
      evidenceReviewStatus: currentEvidence.reviewStatus, evidenceUrl: currentEvidence.url, officialSourceUrl: definition.officialSourceUrl,
      definitionChangeType: definition.changeType, definitionPreviousVersionId: definition.previousVersionId,
      definitionDocumentId: definition.regulatoryDocumentId,
      definitionCurrentVersionId: definition.currentVersionId, definitionCurrentEvidenceId: definition.currentEvidenceId,
      definitionSummary: definition.summary, definitionAffectedObligations: definition.affectedObligations,
      definitionIssuedDate: definition.issuedDate, definitionEffectiveDate: definition.effectiveDate,
      definitionOfficialSourceUrl: definition.officialSourceUrl, definitionEvidenceStatus: definition.evidenceStatus,
      definitionLastVerifiedAt: definition.lastVerifiedAt,
    })) return [];
    const applicability: ChangeItem["applicability"] = profile && applicabilityProfileId === profile.id
      ? applicabilityState === "applies" ? "applies" : applicabilityState === "does-not-apply" ? "not-applicable" : "insufficient-information"
      : "not-assessed";
    return [{
      id: alert.id, definitionId: definition.id, authority: document.authority, jurisdiction: document.jurisdiction,
      changeType: definition.changeType as ChangeItem["changeType"],
      issuedDate: definition.issuedDate ?? undefined, effectiveDate: definition.effectiveDate ?? undefined,
      summary: definition.summary, affectedObligations: definition.affectedObligations,
      officialSourceUrl: definition.officialSourceUrl, currentVersionId: definition.currentVersionId,
      previousVersionId: definition.previousVersionId ?? undefined, currentEvidenceId: definition.currentEvidenceId,
      lastVerifiedAt: definition.lastVerifiedAt.toISOString(), applicability,
    }];
  });
  const filtered = filterAndSortChanges(items, filters);
  return { state: filtered.length ? "verified" as const : "insufficient-verified-evidence" as const, items: filtered };
}
