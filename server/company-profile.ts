import { desc, eq } from "drizzle-orm";
import { getDatabase } from "../lib/db";
import { applicabilityAssessments, applicabilityResults, companyProfiles } from "../lib/company-profile-schema";
import { regulatoryDocuments } from "../lib/regulatory-schema";
import { evaluateApplicability, type CompanyProfile, type RegulatoryRecord } from "../lib/applicability";
import { validateCompanyProfile } from "../lib/profile-validation";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const MAX_BODY = 32_000;

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY) throw new RangeError("body");
  const text = await request.text();
  if (text.length > MAX_BODY) throw new RangeError("body");
  return JSON.parse(text) as unknown;
}

function asProfile(row: typeof companyProfiles.$inferSelect): CompanyProfile & { id: string } {
  return {
    id: row.id, legalName: row.legalName, jurisdiction: row.jurisdiction as CompanyProfile["jurisdiction"],
    authorities: row.authorities, legalForm: row.legalForm ?? undefined, sector: row.sector ?? undefined,
    regulated: row.regulated ?? undefined,
    financialServices: row.financialServices ?? undefined,
    activities: row.activities, licenceCategory: row.licenceCategory ?? undefined,
    employeeBand: row.employeeBand ?? undefined, vatStatus: row.vatStatus as CompanyProfile["vatStatus"],
    corporateTaxStatus: row.corporateTaxStatus as CompanyProfile["corporateTaxStatus"],
    amlReportingEntity: row.amlReportingEntity ?? undefined,
    dnfbpCategory: row.dnfbpCategory ?? undefined, freeZoneStatus: row.freeZoneStatus as CompanyProfile["freeZoneStatus"],
  };
}

function asRecord(row: typeof regulatoryDocuments.$inferSelect): RegulatoryRecord {
  return {
    id: row.id, title: row.title, jurisdiction: row.jurisdiction as RegulatoryRecord["jurisdiction"],
    authorities: [row.authority], appliesTo: row.applicabilityRules, matchMode: row.applicabilityMatchMode as "all" | "any",
    sourceUrl: row.officialSourceUrl, evidenceStatus: row.evidenceStatus, reviewStatus: row.verifiedVersionId && row.lastVerifiedAt ? "verified" : "pending",
    effectiveDate: row.effectiveDate ?? undefined, summary: row.summary, version: row.verifiedVersionId ? String(row.verifiedVersionId) : undefined,
  };
}

function database() {
  try { return getDatabase(); } catch { return null; }
}

export async function handleCompanyProfile(request: Request) {
  if (!["GET", "POST", "PUT", "OPTIONS"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, Allow: "GET, POST, PUT, OPTIONS" } });
  const db = database();
  if (!db) return json({ error: "Profile storage is temporarily unavailable." }, 503);
  try {
    if (request.method === "GET") {
      const id = new URL(request.url).searchParams.get("id");
      if (!id || id.length > 100) return json({ error: "A valid profile id is required." }, 400);
      const rows = await db.select().from(companyProfiles).where(eq(companyProfiles.id, id)).limit(1);
      return rows[0] ? json({ profile: asProfile(rows[0]) }) : json({ error: "Company profile not found." }, 404);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ error: "Send a JSON profile." }, 415);
    let body: unknown;
    try { body = await readBody(request); } catch (error) { return json({ error: error instanceof RangeError ? "The profile request is too large." : "Send a valid JSON profile." }, 400); }
    const profileId = request.method === "PUT" && body && typeof body === "object" && "id" in body && typeof body.id === "string" ? body.id : crypto.randomUUID();
    const input = body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : body;
    if (input && typeof input === "object" && !Array.isArray(input)) delete (input as Record<string, unknown>).id;
    const validated = validateCompanyProfile(input);
    if (!validated.profile) return json({ error: "Invalid company profile.", details: validated.errors }, 400);
    const p = validated.profile;
    const values = {
      id: profileId, ownerKey: null, legalName: p.legalName, jurisdiction: p.jurisdiction, authorities: p.authorities,
      legalForm: p.legalForm ?? null, sector: p.sector ?? null, regulated: p.regulated ?? null,
      financialServices: p.financialServices ?? null, activities: p.activities,
      licenceCategory: p.licenceCategory ?? null, employeeBand: p.employeeBand ?? null, vatStatus: p.vatStatus ?? null,
      corporateTaxStatus: p.corporateTaxStatus ?? null, amlReportingEntity: p.amlReportingEntity ?? null,
      dnfbpCategory: p.dnfbpCategory ?? null, freeZoneStatus: p.freeZoneStatus ?? null, updatedAt: new Date(),
    };
    if (request.method === "PUT") {
      const { id: _id, ownerKey: _ownerKey, ...updateValues } = values;
      const updated = await db.update(companyProfiles).set(updateValues).where(eq(companyProfiles.id, profileId)).returning();
      return updated[0] ? json({ profile: asProfile(updated[0]) }) : json({ error: "Company profile not found." }, 404);
    }
    const inserted = await db.insert(companyProfiles).values(values).returning();
    return json({ profile: asProfile(inserted[0]) }, 201);
  } catch { return json({ error: "The company profile could not be saved." }, 500); }
}

export async function handleApplicability(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ error: "Send a JSON assessment request." }, 415);
  const db = database();
  if (!db) return json({ error: "Applicability storage is temporarily unavailable." }, 503);
  try {
    const body = await readBody(request) as { profileId?: unknown };
    if (typeof body?.profileId !== "string" || body.profileId.length > 100) return json({ error: "profileId is required." }, 400);
    const profileRows = await db.select().from(companyProfiles).where(eq(companyProfiles.id, body.profileId)).limit(1);
    if (!profileRows[0]) return json({ error: "Company profile not found." }, 404);
    const records = await db.select().from(regulatoryDocuments);
    const results = evaluateApplicability(asProfile(profileRows[0]), records.map(asRecord));
    const assessmentId = crypto.randomUUID();
    await db.insert(applicabilityAssessments).values({ id: assessmentId, profileId: body.profileId });
    if (results.length) await db.insert(applicabilityResults).values(results.map((result) => ({
      id: crypto.randomUUID(), assessmentId, regulatoryDocumentId: result.regulatoryRecordId, state: result.state,
      triggeredAttributes: result.triggeredAttributes, missingInformation: result.missingInformation, reasoning: result.reasoning,
    })));
    return json({ assessmentId, profile: asProfile(profileRows[0]), results });
  } catch { return json({ error: "Applicability evaluation failed safely. Please try again." }, 500); }
}

export async function handleAssessment(request: Request) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.length > 100) return json({ error: "A valid assessment id is required." }, 400);
  const db = database();
  if (!db) return json({ error: "Assessment storage is temporarily unavailable." }, 503);
  try {
    const assessment = await db.select().from(applicabilityAssessments).where(eq(applicabilityAssessments.id, id)).limit(1);
    if (!assessment[0]) return json({ error: "Applicability assessment not found." }, 404);
    const rows = await db.select().from(applicabilityResults).where(eq(applicabilityResults.assessmentId, id)).orderBy(desc(applicabilityResults.createdAt));
    const records = await db.select().from(regulatoryDocuments);
    const byId = new Map(records.map((record) => [record.id, asRecord(record)]));
    return json({ assessmentId: id, profileId: assessment[0].profileId, results: rows.map((row) => {
      const record = byId.get(row.regulatoryDocumentId);
      return { regulatoryRecordId: row.regulatoryDocumentId, title: record?.title ?? "Regulatory record unavailable", state: row.state, triggeredAttributes: row.triggeredAttributes, missingInformation: row.missingInformation, reasoning: row.reasoning, authority: record?.authorities ?? [], sourceUrl: record?.sourceUrl ?? "", evidenceStatus: record?.evidenceStatus ?? "official-source-pending-review", reviewStatus: record?.reviewStatus ?? "pending" };
    }) });
  } catch { return json({ error: "Assessment storage is temporarily unavailable." }, 503); }
}
