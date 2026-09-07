import { getRegulatoryRepository } from "./regulatory-repository";
import type { AskMizanAnswer } from "./ask-mizan";
import type { RegulatoryRecord, RegulatorySearchResult } from "./regulatory-types";

const INTENT_GROUPS: Array<{ signals: string[]; terms: string[] }> = [
  { signals: ["aml", "money laundering", "anti money laundering", "risk based", "risk-based", "financial crime"], terms: ["aml", "anti money laundering", "risk based approach"] },
  { signals: ["ctf", "terrorist financing", "counter terrorism financing"], terms: ["ctf", "terrorist financing", "aml"] },
  { signals: ["sanction", "sanctions"], terms: ["sanctions", "aml"] },
  { signals: ["dfsa", "difc", "dubai financial services authority"], terms: ["dfsa", "difc"] },
  { signals: ["central bank", "cbuae", "financial institution", "financial institutions"], terms: ["cbuae", "financial institutions", "aml"] },
];

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqueMatches(matches: RegulatorySearchResult[]) {
  const seen = new Set<string>();
  return matches.filter(({ record }) => !seen.has(record.id) && !!seen.add(record.id));
}

async function retrieveVerified(question: string): Promise<RegulatorySearchResult[]> {
  const repository = await getRegulatoryRepository();
  const direct = await repository.search(question, { evidenceStatus: "official-verified" });
  if (direct.length) return direct.slice(0, 5);

  // Ask Mizan accepts natural-language questions, so retry only with deterministic
  // regulatory intent expansions. This never creates evidence or bypasses verification.
  const q = normalise(question);
  const expansions = INTENT_GROUPS
    .filter((group) => group.signals.some((signal) => q.includes(normalise(signal))))
    .flatMap((group) => group.terms);

  const expanded: RegulatorySearchResult[] = [];
  for (const term of [...new Set(expansions)]) {
    expanded.push(...await repository.search(term, { evidenceStatus: "official-verified" }));
  }
  return uniqueMatches(expanded).slice(0, 5);
}

function answerFromRecords(matches: RegulatorySearchResult[]): AskMizanAnswer {
  if (!matches.length) {
    return {
      answer: "Mizan does not currently have sufficient verified regulatory information to answer this confidently.",
      verified: false,
      sources: [],
      recordIds: [],
    };
  }

  const records = matches.map(({ record }) => record);
  const primary = records[0];
  const obligations = primary.obligations.length ? ` Key obligations recorded by Mizan: ${primary.obligations.join("; ")}.` : "";
  const applicability = primary.applicability.length ? ` Applicability: ${primary.applicability.join("; ")}.` : "";
  return {
    answer: `${primary.summary}${applicability}${obligations}`,
    verified: true,
    sources: records.map((record: RegulatoryRecord) => ({
      title: record.title,
      url: record.officialSourceUrl,
      authority: record.sourceAuthority,
      lastVerifiedAt: record.lastVerifiedAt,
    })),
    recordIds: records.map((record) => record.id),
  };
}

export async function askMizanFromRepository(question: string): Promise<AskMizanAnswer> {
  return answerFromRecords(await retrieveVerified(question));
}
