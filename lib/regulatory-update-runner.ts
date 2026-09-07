import { decideIngestion, type SourceSnapshot, type StoredSnapshot } from "./regulatory-ingestion";

export interface RegulatoryUpdateSource {
  id: string;
  canonicalUrl: string;
  enabled: boolean;
}

export interface RegulatoryUpdateStore {
  latestSnapshot(sourceId: string): Promise<StoredSnapshot | undefined>;
  saveVersion(snapshot: SourceSnapshot, decision: ReturnType<typeof decideIngestion>): Promise<void>;
  markChecked(sourceId: string, checkedAt: string, changed: boolean): Promise<void>;
}

export interface RegulatoryUpdateProcessor {
  process(snapshot: SourceSnapshot): Promise<void>;
}

export interface RegulatorySourceFetchResult {
  content: string;
  finalUrl?: string;
}

export type RegulatorySourceFetcher = (source: RegulatoryUpdateSource) => Promise<RegulatorySourceFetchResult>;

export interface RegulatoryUpdateResult {
  checkedSources: number;
  changedSources: number;
  processedSources: number;
  failures: Array<{ sourceId: string; error: string }>;
}

async function defaultFetcher(source: RegulatoryUpdateSource): Promise<RegulatorySourceFetchResult> {
  const response = await fetch(source.canonicalUrl, {
    headers: { "User-Agent": "Mizan-Regulatory-Update/1.0", Accept: "text/html,application/xhtml+xml,application/json,text/plain" },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`official source returned HTTP ${response.status}`);
  const content = await response.text();
  if (!content.trim()) throw new Error("official source returned empty content");
  return { content, finalUrl: response.url };
}

export async function runRegulatoryUpdate(
  sources: RegulatoryUpdateSource[],
  store: RegulatoryUpdateStore,
  processor: RegulatoryUpdateProcessor,
  fetcher: RegulatorySourceFetcher = defaultFetcher,
): Promise<RegulatoryUpdateResult> {
  const result: RegulatoryUpdateResult = { checkedSources: 0, changedSources: 0, processedSources: 0, failures: [] };

  for (const source of sources.filter((item) => item.enabled)) {
    const fetchedAt = new Date().toISOString();
    try {
      const fetched = await fetcher(source);
      if (!fetched.content.trim()) throw new Error("official source returned empty content");

      result.checkedSources++;
      const snapshot: SourceSnapshot = { sourceId: source.id, canonicalUrl: source.canonicalUrl, fetchedAt, content: fetched.content };
      const previous = await store.latestSnapshot(source.id);
      const decision = decideIngestion(snapshot, previous);
      await store.markChecked(source.id, fetchedAt, decision.changed);
      if (!decision.requiresProcessing) continue;

      result.changedSources++;
      await processor.process(snapshot);
      await store.saveVersion(snapshot, decision);
      result.processedSources++;
    } catch (error) {
      result.failures.push({ sourceId: source.id, error: error instanceof Error ? error.message : "unknown update failure" });
    }
  }

  return result;
}
