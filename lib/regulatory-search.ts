import type { RegulatoryRecord, RegulatorySearchFilters, RegulatorySearchResult } from "./regulatory-types";

const synonymGroups = [
  ["ubo", "beneficial owner", "beneficial ownership", "ultimate beneficial owner"],
  ["aml", "anti money laundering", "anti-money laundering"],
  ["ct", "corporate tax", "corporation tax"],
  ["vat", "value added tax", "value-added tax"],
  ["esr", "economic substance", "economic substance regulations"],
  ["cma", "sca", "capital markets authority", "securities and commodities authority"],
  ["dfsa", "dubai financial services authority"],
  ["fsra", "financial services regulatory authority"],
];

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from", "how", "i", "in", "is", "it",
  "of", "on", "or", "the", "to", "what", "when", "where", "which", "who", "why", "with", "you", "your", "still", "need",
]);

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value: string) {
  return new Set(normalise(value).split(/\s+/).filter(Boolean));
}

function expandedTerms(query: string) {
  const q = normalise(query);
  const terms = new Set(q.split(/\s+/).filter((term) => term.length > 1 && !STOP_WORDS.has(term)));
  for (const group of synonymGroups) {
    if (group.some((term) => q.includes(normalise(term)))) {
      for (const term of group) {
        for (const token of normalise(term).split(/\s+/)) {
          if (token.length > 1 && !STOP_WORDS.has(token)) terms.add(token);
        }
      }
    }
  }
  return [...terms];
}

function matchesFilters(record: RegulatoryRecord, filters: RegulatorySearchFilters) {
  if (filters.jurisdiction && normalise(record.jurisdiction) !== normalise(filters.jurisdiction)) return false;
  if (filters.authority && normalise(record.authority) !== normalise(filters.authority)) return false;
  if (filters.status && record.status !== filters.status) return false;
  if (filters.evidenceStatus && record.evidenceStatus !== filters.evidenceStatus) return false;
  if (filters.topic && !record.topics.some((topic) => normalise(topic).includes(normalise(filters.topic!)))) return false;
  return true;
}

function scoreField(field: string, terms: string[], weight: number) {
  const fieldTokens = tokens(field);
  const matched = terms.filter((term) => fieldTokens.has(term));
  return { score: matched.length * weight, matched };
}

export function searchRegulations(records: RegulatoryRecord[], query: string, filters: RegulatorySearchFilters = {}): RegulatorySearchResult[] {
  const terms = expandedTerms(query);
  const normalisedQuery = normalise(query);

  return records
    .filter((record) => matchesFilters(record, filters))
    .map((record) => {
      const matchedTerms = new Set<string>();
      let score = 0;

      const fields: Array<[string, number]> = [
        [record.title, 8],
        [record.instrumentNumber ?? "", 10],
        [record.authority, 5],
        [record.jurisdiction, 4],
        [record.topics.join(" "), 5],
        [record.aliases.join(" "), 6],
        [record.summary, 2],
      ];

      for (const [field, weight] of fields) {
        const result = scoreField(field, terms, weight);
        score += result.score;
        result.matched.forEach((term) => matchedTerms.add(term));
      }

      const searchable = normalise([
        record.title,
        record.instrumentNumber ?? "",
        record.authority,
        record.jurisdiction,
        record.topics.join(" "),
        record.aliases.join(" "),
      ].join(" "));
      if (normalisedQuery.length >= 4 && searchable.includes(normalisedQuery)) score += 15;

      return { record, score, matchedTerms: [...matchedTerms] };
    })
    .filter((result) => !query.trim() || (terms.length > 0 && result.score >= 4))
    .sort((a, b) => b.score - a.score || b.record.lastVerifiedAt.localeCompare(a.record.lastVerifiedAt));
}
