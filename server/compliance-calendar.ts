import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDatabase } from "../lib/db";
import { applicabilityAssessments, applicabilityResults } from "../lib/company-profile-schema";
import { complianceCalendarItems, regulatoryDeadlineDefinitions } from "../lib/compliance-calendar-schema";
import { regulatoryDocuments, regulatoryEvidence, regulatoryVersions } from "../lib/regulatory-schema";
import { classifyCalendarItems, isVerifiedDeadlineDefinition, type VerifiedCalendarItem } from "../lib/compliance-calendar";

export async function getComplianceCalendar(profileId: string, asOf = new Date()) {
  const db = getDatabase();
  const rows = await db.select({
    item: complianceCalendarItems,
    resultState: applicabilityResults.state,
    resultProfileId: applicabilityAssessments.profileId,
    definition: regulatoryDeadlineDefinitions,
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
    .innerJoin(regulatoryDeadlineDefinitions, eq(regulatoryDeadlineDefinitions.id, complianceCalendarItems.deadlineDefinitionId))
    .innerJoin(regulatoryVersions, eq(regulatoryVersions.id, regulatoryDeadlineDefinitions.verifiedVersionId))
    .innerJoin(regulatoryEvidence, eq(regulatoryEvidence.id, regulatoryDeadlineDefinitions.evidenceId))
    .where(and(
      eq(complianceCalendarItems.profileId, profileId),
      eq(regulatoryDeadlineDefinitions.regulatoryDocumentId, complianceCalendarItems.regulatoryDocumentId),
      eq(applicabilityAssessments.profileId, profileId),
      eq(applicabilityResults.state, "applies"),
      eq(regulatoryDeadlineDefinitions.evidenceStatus, "official-verified"),
      eq(regulatoryDocuments.evidenceStatus, "official-verified"),
      isNotNull(regulatoryDocuments.verifiedVersionId),
      isNotNull(regulatoryDocuments.lastVerifiedAt),
      inArray(regulatoryDocuments.status, ["in-force", "amended"]),
      eq(regulatoryDocuments.verifiedVersionId, regulatoryDeadlineDefinitions.verifiedVersionId),
      eq(regulatoryDocuments.lastVerifiedAt, regulatoryDeadlineDefinitions.lastVerifiedAt),
      eq(regulatoryVersions.id, regulatoryDeadlineDefinitions.verifiedVersionId),
      eq(regulatoryVersions.reviewStatus, "verified"),
      eq(regulatoryEvidence.documentId, complianceCalendarItems.regulatoryDocumentId),
      eq(regulatoryEvidence.id, regulatoryDeadlineDefinitions.evidenceId),
      eq(regulatoryEvidence.versionId, regulatoryDeadlineDefinitions.verifiedVersionId),
      eq(regulatoryEvidence.sourceId, regulatoryDocuments.sourceId),
      eq(regulatoryEvidence.url, regulatoryDeadlineDefinitions.officialSourceUrl),
      eq(regulatoryEvidence.reviewStatus, "verified"),
    ));
  const items: VerifiedCalendarItem[] = rows.flatMap(({ item, definition, resultState, resultProfileId, documentEvidenceStatus, documentVerifiedVersionId, documentLastVerifiedAt, documentStatus, documentJurisdiction, versionDocumentId, versionReviewStatus, evidenceDocumentId, evidenceVersionId, evidenceSourceId, evidenceUrl, evidenceReviewStatus }) => {
    if (resultState !== "applies" || resultProfileId !== profileId || evidenceSourceId === null
      || !isVerifiedDeadlineDefinition({
        id: definition.id, regulatoryDocumentId: definition.regulatoryDocumentId,
        verifiedVersionId: definition.verifiedVersionId, evidenceId: definition.evidenceId,
        dueDate: definition.dueDate, recurrenceRule: definition.recurrenceRule ?? undefined,
        deadlineBasis: definition.deadlineBasis as "explicit-official-date" | "explicit-official-recurrence",
        evidenceStatus: definition.evidenceStatus,
      }, {
        evidenceId: definition.evidenceId,
        evidenceStatus: documentEvidenceStatus, verifiedVersionId: definition.verifiedVersionId,
        documentVerifiedVersionId, documentLastVerifiedAt, versionDocumentId,
        documentId: item.regulatoryDocumentId, versionReviewStatus, evidenceDocumentId,
        evidenceVersionId, evidenceReviewStatus, evidenceUrl: evidenceUrl ?? "",
        officialSourceUrl: definition.officialSourceUrl, status: documentStatus,
        jurisdictionMatches: item.jurisdiction === documentJurisdiction,
      })) return [];
    return [{
      id: item.id, regulatoryDocumentId: item.regulatoryDocumentId, obligationTitle: definition.obligationTitle, description: definition.description,
      dueDate: definition.dueDate, effectiveDate: definition.effectiveDate ?? undefined,
      recurrenceRule: definition.recurrenceRule ?? undefined, authority: definition.authority, jurisdiction: definition.jurisdiction,
      deadlineBasis: definition.deadlineBasis as "explicit-official-date" | "explicit-official-recurrence",
      applicabilityBasis: item.applicabilityBasis, officialSourceUrl: definition.officialSourceUrl,
      evidenceStatus: "official-verified", verifiedVersionId: definition.verifiedVersionId, evidenceId: definition.evidenceId,
      lastVerifiedAt: definition.lastVerifiedAt.toISOString(), calendarStatus: item.calendarStatus,
      completionState: item.completionState, state: "next-90-days" as const, daysUntilDue: 0,
    }];
  });
  return classifyCalendarItems(items, asOf);
}
