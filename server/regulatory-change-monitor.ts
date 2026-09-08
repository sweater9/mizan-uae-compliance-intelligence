import { alias } from "drizzle-orm/pg-core";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDatabase } from "../lib/db";
import { applicabilityAssessments, applicabilityResults, companyProfiles } from "../lib/company-profile-schema";
import { regulatoryDocuments, regulatoryEvidence, regulatoryVersions } from "../lib/regulatory-schema";
import { regulatoryChangeAlerts } from "../lib/regulatory-change-schema";
import { filterAndSortChanges, isDefinitiveChange, type ChangeItem } from "../lib/regulatory-change-monitor";

const previousVersions = alias(regulatoryVersions, "previous_versions");

export async function getRegulatoryChanges(profileId?: string, filters: { jurisdiction?: string; authority?: string; changeType?: string; appliesToCompany?: boolean } = {}) {
  const db = getDatabase();
  const profile = profileId ? (await db.select().from(companyProfiles).where(eq(companyProfiles.id, profileId)).limit(1))[0] : undefined;
  if (profileId && !profile) return { state: "insufficient-verified-evidence" as const, items: [] as ChangeItem[] };
  const rows = await db.select({
    alert: regulatoryChangeAlerts,
    document: regulatoryDocuments,
    currentVersion: regulatoryVersions,
    currentEvidence: regulatoryEvidence,
    previousVersion: previousVersions,
    applicabilityState: applicabilityResults.state,
    applicabilityProfileId: applicabilityAssessments.profileId,
  }).from(regulatoryChangeAlerts)
    .innerJoin(regulatoryDocuments, eq(regulatoryDocuments.id, regulatoryChangeAlerts.regulatoryDocumentId))
    .innerJoin(regulatoryVersions, eq(regulatoryVersions.id, regulatoryChangeAlerts.currentVersionId))
    .leftJoin(previousVersions, eq(previousVersions.id, regulatoryChangeAlerts.previousVersionId))
    .innerJoin(regulatoryEvidence, eq(regulatoryEvidence.id, regulatoryChangeAlerts.currentEvidenceId))
    .leftJoin(applicabilityResults, eq(applicabilityResults.id, regulatoryChangeAlerts.applicabilityResultId))
    .leftJoin(applicabilityAssessments, eq(applicabilityAssessments.id, applicabilityResults.assessmentId))
    .where(and(
      eq(regulatoryChangeAlerts.evidenceStatus, "official-verified"),
      eq(regulatoryDocuments.evidenceStatus, "official-verified"),
      isNotNull(regulatoryDocuments.verifiedVersionId),
      isNotNull(regulatoryDocuments.lastVerifiedAt),
      eq(regulatoryDocuments.verifiedVersionId, regulatoryChangeAlerts.currentVersionId),
      eq(regulatoryVersions.documentId, regulatoryChangeAlerts.regulatoryDocumentId),
      eq(regulatoryVersions.reviewStatus, "verified"),
      eq(regulatoryEvidence.documentId, regulatoryChangeAlerts.regulatoryDocumentId),
      eq(regulatoryEvidence.id, regulatoryChangeAlerts.currentEvidenceId),
      eq(regulatoryEvidence.versionId, regulatoryChangeAlerts.currentVersionId),
      eq(regulatoryEvidence.sourceId, regulatoryDocuments.sourceId),
      eq(regulatoryEvidence.reviewStatus, "verified"),
    ));
  const items = rows.flatMap((row) => {
    const { alert, document, currentVersion, currentEvidence, previousVersion, applicabilityState, applicabilityProfileId } = row;
    if (!isDefinitiveChange({
      documentId: document.id, documentEvidenceStatus: document.evidenceStatus,
      documentVerifiedVersionId: document.verifiedVersionId, documentLastVerifiedAt: document.lastVerifiedAt,
      documentStatus: document.status, currentVersionId: currentVersion.id, currentVersionDocumentId: currentVersion.documentId,
      currentVersionReviewStatus: currentVersion.reviewStatus, previousVersionId: alert.previousVersionId,
      previousVersionDocumentId: previousVersion?.documentId, previousVersionReviewStatus: previousVersion?.reviewStatus,
      evidenceId: currentEvidence.id, evidenceDocumentId: currentEvidence.documentId, evidenceVersionId: currentEvidence.versionId,
      evidenceReviewStatus: currentEvidence.reviewStatus, evidenceUrl: currentEvidence.url, officialSourceUrl: alert.officialSourceUrl,
    })) return [];
    const applicability: ChangeItem["applicability"] = profile && applicabilityProfileId === profile.id
      ? applicabilityState === "applies" ? "applies" : applicabilityState === "does-not-apply" ? "not-applicable" : "insufficient-information"
      : "not-assessed";
    return [{
      id: alert.id, authority: alert.authority, jurisdiction: alert.jurisdiction, changeType: alert.changeType as ChangeItem["changeType"],
      issuedDate: alert.issuedDate ?? undefined, effectiveDate: alert.effectiveDate ?? undefined, summary: alert.summary,
      affectedObligations: alert.affectedObligations, officialSourceUrl: alert.officialSourceUrl,
      currentVersionId: alert.currentVersionId, previousVersionId: alert.previousVersionId ?? undefined,
      currentEvidenceId: alert.currentEvidenceId, lastVerifiedAt: alert.lastVerifiedAt.toISOString(), applicability,
    }];
  });
  const filtered = filterAndSortChanges(items, filters);
  return { state: filtered.length ? "verified" as const : "insufficient-verified-evidence" as const, items: filtered };
}
