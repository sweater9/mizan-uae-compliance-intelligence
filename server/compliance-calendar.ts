import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDatabase } from "../lib/db";
import { applicabilityAssessments, applicabilityResults } from "../lib/company-profile-schema";
import { complianceCalendarItems } from "../lib/compliance-calendar-schema";
import { regulatoryDocuments, regulatoryEvidence, regulatoryVersions } from "../lib/regulatory-schema";
import { classifyCalendarItems, hasVerifiedCalendarEvidence, type VerifiedCalendarItem } from "../lib/compliance-calendar";

export async function getComplianceCalendar(profileId: string, asOf = new Date()) {
  const db = getDatabase();
  const rows = await db.select({
    item: complianceCalendarItems,
    resultState: applicabilityResults.state,
    resultProfileId: applicabilityAssessments.profileId,
    documentEvidenceStatus: regulatoryDocuments.evidenceStatus,
    documentVerifiedVersionId: regulatoryDocuments.verifiedVersionId,
    documentLastVerifiedAt: regulatoryDocuments.lastVerifiedAt,
    documentStatus: regulatoryDocuments.status,
    documentJurisdiction: regulatoryDocuments.jurisdiction,
    versionDocumentId: regulatoryVersions.documentId,
    versionReviewStatus: regulatoryVersions.reviewStatus,
    evidenceDocumentId: regulatoryEvidence.documentId,
    evidenceVersionId: regulatoryEvidence.versionId,
    evidenceSourceId: regulatoryEvidence.sourceId,
    evidenceUrl: regulatoryEvidence.url,
    evidenceReviewStatus: regulatoryEvidence.reviewStatus,
  }).from(complianceCalendarItems)
    .innerJoin(applicabilityResults, eq(applicabilityResults.id, complianceCalendarItems.applicabilityResultId))
    .innerJoin(applicabilityAssessments, eq(applicabilityAssessments.id, applicabilityResults.assessmentId))
    .innerJoin(regulatoryDocuments, eq(regulatoryDocuments.id, complianceCalendarItems.regulatoryDocumentId))
    .innerJoin(regulatoryVersions, eq(regulatoryVersions.id, complianceCalendarItems.verifiedVersionId))
    .innerJoin(regulatoryEvidence, eq(regulatoryEvidence.id, complianceCalendarItems.evidenceId))
    .where(and(
      eq(complianceCalendarItems.profileId, profileId),
      eq(applicabilityAssessments.profileId, profileId),
      eq(applicabilityResults.state, "applies"),
      eq(complianceCalendarItems.evidenceStatus, "official-verified"),
      eq(regulatoryDocuments.evidenceStatus, "official-verified"),
      isNotNull(regulatoryDocuments.verifiedVersionId),
      isNotNull(regulatoryDocuments.lastVerifiedAt),
      inArray(regulatoryDocuments.status, ["in-force", "amended"]),
      eq(regulatoryDocuments.verifiedVersionId, complianceCalendarItems.verifiedVersionId),
      eq(regulatoryDocuments.lastVerifiedAt, complianceCalendarItems.lastVerifiedAt),
      eq(regulatoryVersions.documentId, complianceCalendarItems.regulatoryDocumentId),
      eq(regulatoryVersions.reviewStatus, "verified"),
      eq(regulatoryEvidence.documentId, complianceCalendarItems.regulatoryDocumentId),
      eq(regulatoryEvidence.versionId, complianceCalendarItems.verifiedVersionId),
      eq(regulatoryEvidence.sourceId, regulatoryDocuments.sourceId),
      eq(regulatoryEvidence.url, complianceCalendarItems.officialSourceUrl),
      eq(regulatoryEvidence.reviewStatus, "verified"),
    ));
  const items: VerifiedCalendarItem[] = rows.flatMap(({ item, resultState, resultProfileId, documentEvidenceStatus, documentVerifiedVersionId, documentLastVerifiedAt, documentStatus, documentJurisdiction, versionDocumentId, versionReviewStatus, evidenceDocumentId, evidenceVersionId, evidenceSourceId, evidenceUrl, evidenceReviewStatus }) => {
    if (resultState !== "applies" || resultProfileId !== profileId || evidenceSourceId === null
      || !hasVerifiedCalendarEvidence({
        evidenceStatus: documentEvidenceStatus, verifiedVersionId: item.verifiedVersionId,
        documentVerifiedVersionId, documentLastVerifiedAt, versionDocumentId,
        documentId: item.regulatoryDocumentId, versionReviewStatus, evidenceDocumentId,
        evidenceVersionId, evidenceReviewStatus, evidenceUrl: evidenceUrl ?? "",
        officialSourceUrl: item.officialSourceUrl, status: documentStatus,
        jurisdictionMatches: item.jurisdiction === documentJurisdiction,
      })) return [];
    return [{
      id: item.id, obligationTitle: item.obligationTitle, description: item.description,
      dueDate: item.dueDate, effectiveDate: item.effectiveDate ?? undefined,
      recurrenceRule: item.recurrenceRule ?? undefined, authority: item.authority, jurisdiction: item.jurisdiction,
      deadlineBasis: item.deadlineBasis as "explicit-official-date" | "explicit-official-recurrence",
      applicabilityBasis: item.applicabilityBasis, officialSourceUrl: item.officialSourceUrl,
      evidenceStatus: "official-verified", verifiedVersionId: item.verifiedVersionId, evidenceId: item.evidenceId,
      lastVerifiedAt: item.lastVerifiedAt.toISOString(), calendarStatus: item.calendarStatus,
      completionState: item.completionState, state: "next-90-days" as const, daysUntilDue: 0,
    }];
  });
  return classifyCalendarItems(items, asOf);
}
