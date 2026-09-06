import type { RegulatoryRecord, RegulatorySearchFilters, RegulatorySearchResult } from "./regulatory-types";
import { regulatoryRecords } from "./regulatory-records";
import { searchRegulations } from "./regulatory-search";

/**
 * Single read boundary for all Mizan regulatory experiences.
 * The static implementation keeps builds/tests independent of a paid database.
 * A durable Drizzle adapter can replace this without changing Search or Ask Mizan.
 */
export interface RegulatoryRepository {
  all(): Promise<RegulatoryRecord[]>;
  search(query: string, filters?: RegulatorySearchFilters): Promise<RegulatorySearchResult[]>;
}

export class StaticRegulatoryRepository implements RegulatoryRepository {
  constructor(private readonly records: RegulatoryRecord[] = regulatoryRecords) {}

  async all() { return this.records; }

  async search(query: string, filters: RegulatorySearchFilters = {}) {
    return searchRegulations(this.records, query, filters);
  }
}

let repository: RegulatoryRepository = new StaticRegulatoryRepository();

export function getRegulatoryRepository() { return repository; }

export function setRegulatoryRepository(next: RegulatoryRepository) {
  repository = next;
}
