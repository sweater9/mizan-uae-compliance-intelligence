import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "./db";
import { regulatoryDocuments, regulatorySources, regulatoryUpdateRuns, regulatoryVersions } from "./regulatory-schema";
import type { SourceSnapshot, StoredSnapshot } from "./regulatory-ingestion";
import type { RegulatoryUpdateStore } from "./regulatory-update-runner";

export class NeonRegulatoryUpdateStore implements RegulatoryUpdateStore {
  async latestSnapshot(sourceId: string): Promise<StoredSnapshot | undefined> {
    const db = getDatabase();
    const rows = await db
      .select({ sourceId: regulatoryDocuments.sourceId, contentHash: regulatoryVersions.contentHash, version: regulatoryVersions.version })
      .from(regulatoryVersions)
      .innerJoin(regulatoryDocuments, eq(regulatoryVersions.documentId, regulatoryDocuments.id))
      .where(eq(regulatoryDocuments.sourceId, sourceId))
      .orderBy(desc(regulatoryVersions.version))
      .limit(1);
    return rows[0];
  }

  async markChecked(sourceId: string, checkedAt: string, changed: boolean): Promise<void> {
    const checked = new Date(checkedAt);
    const values = changed ? { lastCheckedAt: checked, lastChangedAt: checked } : { lastCheckedAt: checked };
    await getDatabase().update(regulatorySources).set(values).where(eq(regulatorySources.id, sourceId));
  }

  async saveVersion(snapshot: SourceSnapshot, decision: { contentHash: string; nextVersion: number }): Promise<void> {
    const db = getDatabase();
    const documents = await db
      .select({ id: regulatoryDocuments.id })
      .from(regulatoryDocuments)
      .where(and(eq(regulatoryDocuments.sourceId, snapshot.sourceId), eq(regulatoryDocuments.officialSourceUrl, snapshot.canonicalUrl)))
      .limit(1);
    const document = documents[0];
    if (!document) {
      throw new Error(`No regulatory document is registered for source ${snapshot.sourceId}; ingestion will not auto-publish an unknown instrument.`);
    }

    await db.insert(regulatoryVersions).values({
      documentId: document.id,
      version: decision.nextVersion,
      contentHash: decision.contentHash,
      rawContent: snapshot.content,
      fetchedAt: new Date(snapshot.fetchedAt),
      reviewStatus: "pending",
    }).onConflictDoNothing();
  }
}

export async function beginRegulatoryUpdateRun(runId: string, startedAt = new Date()) {
  await getDatabase().insert(regulatoryUpdateRuns).values({ id: runId, startedAt, status: "running" });
}

export async function finishRegulatoryUpdateRun(runId: string, result: { checkedSources: number; changedSources: number; processedSources: number; failures: Array<{ sourceId: string; error: string }> }) {
  const status = result.failures.length === 0 ? "succeeded" : result.checkedSources > 0 ? "partial" : "failed";
  await getDatabase().update(regulatoryUpdateRuns).set({
    finishedAt: new Date(),
    status,
    checkedSources: result.checkedSources,
    changedSources: result.changedSources,
    processedDocuments: result.processedSources,
    errorSummary: result.failures.length ? result.failures.map((failure) => `${failure.sourceId}: ${failure.error}`).join("; ").slice(0, 4000) : null,
  }).where(eq(regulatoryUpdateRuns.id, runId));
}

export async function acquireRegulatoryUpdateLock() {
  const db = getDatabase();
  const result = await db.execute(sql`select pg_try_advisory_lock(hashtext('mizan-regulatory-update')) as acquired`);
  return Boolean((result.rows?.[0] as { acquired?: boolean } | undefined)?.acquired);
}

export async function releaseRegulatoryUpdateLock() {
  await getDatabase().execute(sql`select pg_advisory_unlock(hashtext('mizan-regulatory-update'))`);
}
