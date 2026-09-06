import type { RegulatoryRecord, RegulatorySearchFilters, RegulatorySearchResult } from "./regulatory-types";
import { regulatoryRecords } from "./regulatory-records";
import { searchRegulations } from "./regulatory-search";

export interface RegulatoryRepository {
  all(): Promise<RegulatoryRecord[]>;
  search(query: string, filters?: RegulatorySearchFilters): Promise<RegulatorySearchResult[]>;
}

export class RegulatoryDatabaseUnavailableError extends Error {
  constructor(message = "Regulatory database is unavailable.") {
    super(message);
    this.name = "RegulatoryDatabaseUnavailableError";
  }
}

export class StaticRegulatoryRepository implements RegulatoryRepository {
  constructor(private readonly records: RegulatoryRecord[] = regulatoryRecords) {}
  async all() { return this.records; }
  async search(query: string, filters: RegulatorySearchFilters = {}) {
    return searchRegulations(this.records, query, filters);
  }
}

let testRepository: RegulatoryRepository | undefined;

export async function getRegulatoryRepository(): Promise<RegulatoryRepository> {
  if (testRepository) return testRepository;
  const databaseUrl = process.env.MIZAN_DATABASE_URL?.trim();
  if (!databaseUrl) {
    if (process.env.NODE_ENV === "production") throw new RegulatoryDatabaseUnavailableError("MIZAN_DATABASE_URL is not configured.");
    return new StaticRegulatoryRepository();
  }
  const { NeonRegulatoryRepository } = await import("./neon-regulatory-repository");
  return new NeonRegulatoryRepository();
}

/** Test-only injection boundary. Production selects Neon whenever MIZAN_DATABASE_URL exists. */
export function setRegulatoryRepository(next?: RegulatoryRepository) {
  testRepository = next;
}
