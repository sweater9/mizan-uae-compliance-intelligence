import { JURISDICTIONS, type CompanyProfile } from "./applicability";

const MAX_BODY_NAME = 240;
const allowedStatuses = new Set(["registered", "not-registered", "unknown"]);

export function validateCompanyProfile(input: unknown): { profile?: CompanyProfile; errors: string[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { errors: ["Profile must be a JSON object."] };
  const value = input as Record<string, unknown>;
  const errors: string[] = [];
  const legalName = typeof value.legalName === "string" ? value.legalName.trim() : "";
  const authorities = Array.isArray(value.authorities) ? value.authorities.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  const activities = Array.isArray(value.activities) ? value.activities.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  if (!legalName || legalName.length > MAX_BODY_NAME) errors.push("legalName is required and must be 1–240 characters.");
  if (!JURISDICTIONS.includes(value.jurisdiction as (typeof JURISDICTIONS)[number])) errors.push("jurisdiction must be uae_mainland, difc, or adgm.");
  if (!authorities.length || authorities.length > 20) errors.push("authorities must contain 1–20 entries.");
  if (!activities.length || activities.length > 30) errors.push("activities must contain 1–30 entries.");
  for (const key of ["vatStatus", "corporateTaxStatus"]) if (value[key] !== undefined && !allowedStatuses.has(String(value[key]))) errors.push(`${key} is invalid.`);
  for (const key of ["regulated", "financialServices", "amlReportingEntity"]) if (value[key] !== undefined && typeof value[key] !== "boolean") errors.push(`${key} must be boolean.`);
  if (errors.length) return { errors };
  return { profile: { ...value, legalName, authorities, activities } as CompanyProfile, errors: [] };
}
