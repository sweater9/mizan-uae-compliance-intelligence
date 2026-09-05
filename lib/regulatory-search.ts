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

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function expandedTerms(query: string) {
  const q = normalise(query);
  const terms = new Set(q.split(/\s+/).filter(Boolean));
  for (const group of synonymGroups) {
    if (group.some((term) => q.includes(normalise(term)))) {
      group.forEach((term) => normalise(term).split(/\s+/).forEach((token) => terms.add(token)));
    }
  }
  return [...terms];
}

function matchesFilters(record: RegulatoryRecord, filters: RegulatorySearchFilters) {
  if (filters.jurisdiction && normalise(record.jurisdiction) !== normalise(filters.jurisdiction)) return false;
  if (filters.authority && normalise(record.authority) !== normalise(filters.authority)) return false;
  if (filters.status && record.status !== filters.status) return false;
  if (filters.topic && !record.topics.some((topic) => normalise(topic).includes(normalise(filters.topic!)))) return false;
  return true;
}

export function searchRegulations(records: RegulatoryRecord[], query: string, filters: RegulatorySearchFilters = {}): RegulatorySearchResult[] {
  const terms = expandedTerms(query);
  return records
    .filter((record) => matchesFilters(record, filters))
    .map((record) => {
      const title = normalise(record.title);
      const number = normalise(record.instrumentNumber ?? "");
      const authority = normalise(record.authority);
      const jurisdiction = normalise(record.jurisdiction);
      const topics = normalise(record.topics.join(" "));
      const aliases = normalise(record.aliases.join(" "));
      const summary = normalise(record.summary);
      const matchedTerms: string[] = [];
      let score = 0;
      for (const term of terms) {
        if (!term) continue;
        let matched = false;
        if (title.includes(term)) { score += 8; matched = true; }
        if (number.includes(term)) { score += 10; matched = true; }
        if (authority.includes(term)) { score += 5; matched = true; }
        if (jurisdiction.includes(term)) { score += 4; matched = true; }
        if (topics.includes(term)) { score += 5; matched = true; }
        if (aliases.includes(term)) { score += 6; matched = true; }
        if (summary.includes(term)) { score += 2; matched = true; }
        if (matched) matchedTerms.push(term);
      }
      return { record, score, matchedTerms };
    })
    .filter((result) => !query.trim() || result.score > 0)
    .sort((a, b) => b.score - a.score || b.record.lastVerifiedAt.localeCompare(a.record.lastVerifiedAt));
}
