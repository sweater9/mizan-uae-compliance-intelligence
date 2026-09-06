import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { safeFetch } from "../server/regulatory/safe-fetch.mjs";

const databaseUrl = process.env.MIZAN_DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Mizan regulatory update not started: missing MIZAN_DATABASE_URL.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const runId = crypto.randomUUID();
const result = { checkedSources: 0, changedSources: 0, processedDocuments: 0, failures: [] };

function hostOf(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Regulatory source must be credential-free HTTPS.");
  return url.hostname.toLowerCase();
}

function rawContent(body, contentType) {
  if (contentType === "application/pdf") return `base64:${body.toString("base64")}`;
  return body.toString("utf8");
}

async function finish(status) {
  const summary = result.failures.length ? result.failures.map(({ sourceId, error }) => `${sourceId}: ${error}`).join("; ").slice(0, 4000) : null;
  await sql`update regulatory_update_runs set finished_at = now(), status = ${status}, checked_sources = ${result.checkedSources}, changed_sources = ${result.changedSources}, processed_documents = ${result.processedDocuments}, error_summary = ${summary} where id = ${runId}`;
}

try {
  await sql`insert into regulatory_update_runs (id, started_at, status) values (${runId}, now(), 'running')`;
  const sources = await sql`select id, canonical_url from regulatory_sources where enabled = true order by id`;

  for (const source of sources) {
    const sourceId = String(source.id);
    try {
      const canonicalUrl = String(source.canonical_url);
      const allowedHosts = new Set([hostOf(canonicalUrl)]);
      const fetched = await safeFetch(canonicalUrl, {}, {
        allowedHosts,
        connectTimeoutMs: 10_000,
        requestTimeoutMs: 30_000,
        maxRedirects: 3,
        maxBytes: 10 * 1024 * 1024,
      });
      if (fetched.status !== 200 || !fetched.body?.length) throw new Error("Official source returned no usable content.");

      const content = rawContent(fetched.body, fetched.contentType);
      const contentHash = crypto.createHash("sha256").update(fetched.body).digest("hex");
      const documents = await sql`select id from regulatory_documents where source_id = ${sourceId} and official_source_url = ${canonicalUrl} order by id`;
      if (documents.length !== 1) throw new Error(`Expected exactly one registered document for source; found ${documents.length}.`);
      const documentId = String(documents[0].id);
      const previous = await sql`select version, content_hash from regulatory_versions where document_id = ${documentId} order by version desc limit 1`;

      result.checkedSources += 1;
      if (previous[0]?.content_hash === contentHash) {
        await sql`update regulatory_sources set last_checked_at = now() where id = ${sourceId}`;
        continue;
      }

      const nextVersion = Number(previous[0]?.version ?? 0) + 1;
      const inserted = await sql`insert into regulatory_versions (document_id, version, content_hash, raw_content, fetched_at, review_status) values (${documentId}, ${nextVersion}, ${contentHash}, ${content}, now(), 'pending') on conflict do nothing returning id`;
      if (!inserted.length) {
        const existing = await sql`select id from regulatory_versions where document_id = ${documentId} and content_hash = ${contentHash} limit 1`;
        if (!existing.length) throw new Error("Version insert conflicted without an idempotent matching version.");
      } else {
        result.processedDocuments += 1;
      }
      result.changedSources += 1;
      await sql`update regulatory_sources set last_checked_at = now(), last_changed_at = now() where id = ${sourceId}`;
    } catch (error) {
      result.failures.push({ sourceId, error: error instanceof Error ? error.message : "unknown update failure" });
    }
  }

  const status = result.failures.length === 0 ? "succeeded" : result.checkedSources > 0 ? "partial" : "failed";
  await finish(status);
  console.log(JSON.stringify({ runId, status, ...result }));
  if (status === "failed") process.exitCode = 1;
} catch (error) {
  try { await finish("failed"); } catch {}
  console.error("Mizan regulatory update failed before completion.");
  if (error instanceof Error) console.error(error.message);
  process.exitCode = 1;
}
