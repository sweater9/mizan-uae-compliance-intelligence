import { getRegulatoryRepository } from "./regulatory-repository";
import type { AskMizanAnswer } from "./ask-mizan";

export async function askMizanFromRepository(question: string): Promise<AskMizanAnswer> {
  const repository = await getRegulatoryRepository();
  const verifiedMatches = (await repository.search(question, { evidenceStatus: "official-verified" })).slice(0, 5);

  if (!verifiedMatches.length) {
    return {
      answer: "Mizan does not currently have sufficient verified regulatory information in its database to answer this question. Please check the relevant official authority source.",
      verified: false,
      sources: [],
      recordIds: [],
    };
  }

  const primary = verifiedMatches[0].record;
  const obligations = primary.obligations.length ? ` Key obligations recorded by Mizan: ${primary.obligations.join("; ")}.` : "";
  const applicability = primary.applicability.length ? ` Applicability: ${primary.applicability.join("; ")}.` : "";
  return {
    answer: `${primary.summary}${applicability}${obligations}`,
    verified: true,
    sources: [{
      title: primary.title,
      url: primary.officialSourceUrl,
      authority: primary.sourceAuthority,
      lastVerifiedAt: primary.lastVerifiedAt,
    }],
    recordIds: [primary.id],
  };
}
