export type CalendarState = "overdue" | "due-today" | "next-7-days" | "next-30-days" | "next-60-days" | "next-90-days";

export type VerifiedCalendarItem = {
  id: string;
  obligationTitle: string;
  description: string;
  dueDate: string;
  effectiveDate?: string;
  recurrenceRule?: string;
  deadlineBasis: "explicit-official-date" | "explicit-official-recurrence";
  authority: string;
  jurisdiction: string;
  applicabilityBasis: string[];
  officialSourceUrl: string;
  evidenceStatus: "official-verified";
  verifiedVersionId: number;
  evidenceId: number;
  lastVerifiedAt: string;
  calendarStatus: string;
  completionState: string;
  state: CalendarState;
  daysUntilDue: number;
};

export type CalendarAssessment = {
  state: "verified" | "insufficient-verified-evidence";
  items: VerifiedCalendarItem[];
  summary: Record<CalendarState, number>;
};

export type CalendarEvidenceChain = {
  evidenceId?: number;
  evidenceStatus: string;
  verifiedVersionId?: number | null;
  documentVerifiedVersionId?: number | null;
  documentLastVerifiedAt?: Date | string | null;
  versionDocumentId: string;
  documentId: string;
  versionReviewStatus: string;
  evidenceDocumentId: string;
  evidenceVersionId: number;
  evidenceReviewStatus: string;
  evidenceUrl: string;
  officialSourceUrl: string;
  status: string;
  jurisdictionMatches: boolean;
};

export type DeadlineDefinition = {
  id: string;
  regulatoryDocumentId: string;
  verifiedVersionId: number;
  evidenceId: number;
  dueDate: string;
  recurrenceRule?: string;
  deadlineBasis: "explicit-official-date" | "explicit-official-recurrence";
  evidenceStatus: string;
};

export function isVerifiedDeadlineDefinition(definition: DeadlineDefinition, chain: CalendarEvidenceChain): boolean {
  return hasVerifiedCalendarEvidence({
    ...chain,
    verifiedVersionId: definition.verifiedVersionId,
    officialSourceUrl: chain.officialSourceUrl,
  })
    && definition.regulatoryDocumentId === chain.documentId
    && definition.evidenceId === chain.evidenceId
    && definition.evidenceStatus === "official-verified"
    && (!definition.recurrenceRule || definition.deadlineBasis === "explicit-official-recurrence");
}

export function materializeDeadline(
  calendar: { deadlineDefinitionId: string; dueDate?: string; recurrenceRule?: string },
  definition: DeadlineDefinition,
): { dueDate: string; recurrenceRule?: string } | null {
  if (calendar.deadlineDefinitionId !== definition.id) return null;
  return { dueDate: definition.dueDate, recurrenceRule: definition.recurrenceRule };
}

export function hasVerifiedCalendarEvidence(chain: CalendarEvidenceChain): boolean {
  return chain.evidenceStatus === "official-verified"
    && chain.verifiedVersionId !== null && chain.verifiedVersionId !== undefined
    && chain.documentVerifiedVersionId === chain.verifiedVersionId
    && Boolean(chain.documentLastVerifiedAt) && chain.versionDocumentId === chain.documentId
    && chain.versionReviewStatus === "verified" && chain.evidenceDocumentId === chain.documentId
    && chain.evidenceVersionId === chain.verifiedVersionId && chain.evidenceReviewStatus === "verified"
    && chain.evidenceUrl === chain.officialSourceUrl && (chain.status === "in-force" || chain.status === "amended")
    && chain.jurisdictionMatches;
}

function dayNumber(value: string): number {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error("Invalid calendar date.");
  return parsed;
}

export function classifyCalendarItems(items: VerifiedCalendarItem[], asOf = new Date()): CalendarAssessment {
  const today = Date.parse(`${asOf.toISOString().slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(today)) throw new Error("Invalid calendar reference date.");
  const classified = items
    .filter((item) => item.evidenceStatus === "official-verified" && item.calendarStatus === "active" && item.completionState !== "completed"
      && (!item.recurrenceRule || item.deadlineBasis === "explicit-official-recurrence"))
    .map((item) => {
      const daysUntilDue = Math.floor((dayNumber(item.dueDate) - today) / 86_400_000);
      const state: CalendarState = daysUntilDue < 0 ? "overdue"
        : daysUntilDue === 0 ? "due-today"
        : daysUntilDue <= 7 ? "next-7-days"
        : daysUntilDue <= 30 ? "next-30-days"
        : daysUntilDue <= 60 ? "next-60-days"
        : "next-90-days";
      return { ...item, state, daysUntilDue };
    })
    .filter((item) => item.daysUntilDue <= 90)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue || a.obligationTitle.localeCompare(b.obligationTitle));
  const summary = {
    overdue: classified.filter((item) => item.state === "overdue").length,
    "due-today": classified.filter((item) => item.state === "due-today").length,
    "next-7-days": classified.filter((item) => item.state === "next-7-days").length,
    "next-30-days": classified.filter((item) => item.state === "next-30-days").length,
    "next-60-days": classified.filter((item) => item.state === "next-60-days").length,
    "next-90-days": classified.filter((item) => item.state === "next-90-days").length,
  };
  return { state: classified.length ? "verified" : "insufficient-verified-evidence", items: classified, summary };
}
