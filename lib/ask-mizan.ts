import type { RegulatoryRecord } from "./regulatory-types";
import { searchRegulations } from "./regulatory-search";

export interface AskMizanAnswer {
  answer: string;
  verified: boolean;
  sources: Array<{ title: string; url: string; authority: string; lastVerifiedAt: string }>;
  recordIds: string[];
}

export function askMizan(records: RegulatoryRecord[], question: string): AskMizanAnswer {
  const matches = searchRegulations(records, question).slice(0, 5);
  if (!matches.length) {
    return {
      answer: "Mizan does not currently have sufficient verified regulatory information in its database to answer this question. Please check the relevant official authority source.",
      verified: false,
      sources: [],
      recordIds: [],
    };
  }

  const primary = matches[0].record;
  const obligations = primary.obligations.length ? ` Key obligations recorded by Mizan: ${primary.obligations.join("; ")}.` : "";
  const applicability = primary.applicability.length ? ` Applicability: ${primary.applicability.join("; ")}.` : "";
  return {
    answer: `${primary.summary}${applicability}${obligations}`,
    verified: primary.evidenceStatus === "official-verified",
    sources: matches.map(({ record }) => ({
      title: record.title,
      url: record.officialSourceUrl,
      authority: record.sourceAuthority,
      lastVerifiedAt: record.lastVerifiedAt,
    })),
    recordIds: matches.map(({ record }) => record.id),
  };
}
