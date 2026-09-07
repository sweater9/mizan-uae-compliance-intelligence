import { createHash } from "node:crypto";

export interface SourceSnapshot {
  sourceId: string;
  canonicalUrl: string;
  fetchedAt: string;
  content: string;
}

export interface StoredSnapshot {
  sourceId: string;
  contentHash: string;
  version: number;
}

export interface IngestionDecision {
  sourceId: string;
  contentHash: string;
  changed: boolean;
  nextVersion: number;
  requiresProcessing: boolean;
}

export function hashRegulatoryContent(content: string) {
  return createHash("sha256").update(content.replace(/\s+/g, " ").trim()).digest("hex");
}

export function decideIngestion(snapshot: SourceSnapshot, previous?: StoredSnapshot): IngestionDecision {
  const contentHash = hashRegulatoryContent(snapshot.content);
  const changed = !previous || previous.contentHash !== contentHash;
  return {
    sourceId: snapshot.sourceId,
    contentHash,
    changed,
    nextVersion: previous ? previous.version + (changed ? 1 : 0) : 1,
    requiresProcessing: changed,
  };
}

export const DAILY_UPDATE_TIMEZONE = "Asia/Dubai";
export const DAILY_UPDATE_LOCAL_HOUR = 1;
// UAE is UTC+4 year-round: 01:00 Asia/Dubai = 21:00 UTC on the prior date.
export const DAILY_UPDATE_CRON_UTC = "0 21 * * *";
