import { getRegulatoryRepository } from "./regulatory-repository";
import type { AskMizanAnswer } from "./ask-mizan";

export async function askMizanFromRepository(question: string): Promise<AskMizanAnswer> {
  const repository = await getRegulatoryRepository();
  const matches = (await repository.search(question)).slice(0, 5);
  if (!matches.length) {
    return {
      answer: "Mizan does not currently have sufficient verified regulatory information in its database to answer this question. Please check the relevant official authority source.",
      verified: false,
      sources: [],
      recordIds: [],
    };
  }

  const verifiedMatches = matches.filter(({ record }) => record.evidenceStatus === "official-verified");
  if (!verifiedMatches.length) {
    return {
      answer: "Mizan found potentially relevant material, but it has not yet been verified against an official source. Mizan will not present it as a regulatory answer.",
      verified: false,
      sources: matches.map(({ record }) => ({ title: record.title, url: record.officialSourceUrl, authority: record.sourceAuthority, lastVerifiedAt: record.lastVerifiedAt })),
      recordIds: matches.map(({ record }) => record.id),
    };
  }

  const primary = verifiedMatches[0].record;
  const obligations = primary.obligations.length ? ` Key obligations recorded by Mizan: ${primary.obligations.join("; ")}.` : "";
  const applicability = primary.applicability.length ? ` Applicability: ${primary.applicability.join("; ")}.` : "";
  return {
    answer: `${primary.summary}${applicability}${obligations}`,
    verified: true,
    sources: verifiedMatches.map(({ record }) => ({ title: record.title, url: record.officialSourceUrl, authority: record.sourceAuthority, lastVerifiedAt: record.lastVerifiedAt })),
    recordIds: verifiedMatches.map(({ record }) => record.id),
  };
}
