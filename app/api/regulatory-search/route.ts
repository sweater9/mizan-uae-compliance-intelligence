import { apiHeaders, enterRequest, preflight } from "../../../lib/api-security";
import { getRegulatoryRepository, RegulatoryDatabaseUnavailableError } from "../../../lib/regulatory-repository";
import type { RegulatoryStatus } from "../../../lib/regulatory-types";

export async function GET(request: Request) {
  const { allowed, headers } = apiHeaders(request);
  if (!allowed) return Response.json({ error: "This origin is not allowed to access Mizan." }, { status: 403, headers });
  const guard = enterRequest(request, "regulatory-search", 120, 16);
  if (!guard.allowed) { headers.set("Retry-After", String(guard.retryAfter)); return Response.json({ error: "Mizan is busy. Please try again shortly." }, { status: 429, headers }); }
  try {
    const url = new URL(request.url);
    const rawQuery = (url.searchParams.get("q") ?? "").trim();
    if (!rawQuery || rawQuery.length > 500) return Response.json({ error: "Enter a search query of 1–500 characters." }, { status: 400, headers });
    const status = url.searchParams.get("status") as RegulatoryStatus | null;
    const repository = await getRegulatoryRepository();
    const results = (await repository.search(rawQuery, {
      jurisdiction: url.searchParams.get("jurisdiction") || undefined,
      authority: url.searchParams.get("authority") || undefined,
      topic: url.searchParams.get("topic") || undefined,
      status: status || undefined,
      evidenceStatus: "official-verified",
    })).filter(({ record }) => record.evidenceStatus === "official-verified").slice(0, 50);

    return Response.json({
      query: rawQuery,
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
    }, { headers });
  } catch (error) {
    if (!(error instanceof RegulatoryDatabaseUnavailableError)) console.error("Regulatory search failed");
    return Response.json({ error: "Regulatory search temporarily unavailable." }, { status: 503, headers });
  } finally { guard.release(); }
}

export function OPTIONS(request: Request) { return preflight(request, "GET, OPTIONS"); }
