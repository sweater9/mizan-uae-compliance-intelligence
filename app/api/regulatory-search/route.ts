import { getRegulatoryRepository } from "../../../lib/regulatory-repository";
import type { RegulatoryStatus } from "../../../lib/regulatory-types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 500);
  const status = url.searchParams.get("status") as RegulatoryStatus | null;
  const repository = await getRegulatoryRepository();
  const results = (await repository.search(query, {
    jurisdiction: url.searchParams.get("jurisdiction") || undefined,
    authority: url.searchParams.get("authority") || undefined,
    topic: url.searchParams.get("topic") || undefined,
    status: status || undefined,
  })).slice(0, 50);

  return Response.json({
    query,
    count: results.length,
    results: results.map(({ record, matchedTerms }) => ({
      id: record.id,
      title: record.title,
      instrumentType: record.instrumentType,
      instrumentNumber: record.instrumentNumber,
      authority: record.authority,
      jurisdiction: record.jurisdiction,
      status: record.status,
      effectiveDate: record.effectiveDate,
      summary: record.summary,
      topics: record.topics,
      applicability: record.applicability,
      obligations: record.obligations,
      officialSourceUrl: record.officialSourceUrl,
      sourceAuthority: record.sourceAuthority,
      lastVerifiedAt: record.lastVerifiedAt,
      evidenceStatus: record.evidenceStatus,
      matchedTerms,
    })),
  }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300", "X-Content-Type-Options": "nosniff" } });
}
