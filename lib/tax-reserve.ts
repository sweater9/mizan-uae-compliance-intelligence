export const INSUFFICIENT_TAX_EVIDENCE = "Mizan does not currently have sufficient verified regulatory information to calculate this confidently.";
const MAX_MONEY = 1_000_000_000_000_000;
const MAX_PERCENT = 1_000;

export type TaxType = "corporate_tax" | "vat";
export type TaxRuleKind = "progressive-rate-bands" | "net-output-minus-recoverable-input";
export type ScenarioKind = "current" | "conservative" | "custom";

export type TaxRuleEvidence = {
  ruleId: string;
  regulatoryDocumentId: string;
  taxType: TaxType;
  ruleKind: TaxRuleKind;
  ruleLabel: string;
  parameters: Record<string, unknown>;
  applicableFrom: string;
  applicableTo: string | null;
  authority: string;
  jurisdiction: string;
  officialSourceUrl: string;
  evidenceStatus: string;
  verifiedVersionId: number;
  evidenceId: number;
  verifiedVersionLabel: string;
  verificationDate: string;
  documentVerifiedVersionId: number | null;
  documentLastVerifiedAt: string | null;
  documentStatus: string;
  documentJurisdiction: string;
  documentAuthority: string;
  versionId: number;
  versionDocumentId: string;
  versionReviewStatus: string;
  evidenceDocumentId: string;
  evidenceVersionId: number;
  evidenceReviewStatus: string;
  evidenceUrl: string;
  applicabilityState: string;
};

export type TaxReserveInput = {
  profileId: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  scenario: ScenarioKind;
  revenue?: number;
  accountingProfit?: number;
  taxAdjustments?: number;
  taxableProfit?: number;
  corporateTaxPaid?: number;
  vatTaxableSales?: number;
  vatCollected?: number;
  recoverableInputVat?: number;
  vatPaid?: number;
  amountAlreadyReserved?: number;
  profitChangePercent?: number;
  revenueChangePercent?: number;
  vatChangePercent?: number;
};

export type TaxResult = {
  state: "estimated" | "insufficient-verified-evidence" | "not-requested";
  amount?: number;
  recommendedReserve?: number;
  basis?: string[];
  effectiveReservePercentage?: number;
  evidence: TaxRuleEvidence[];
  message?: string;
};

export type TaxReserveAssessment = {
  state: "estimated" | "partial" | "insufficient-verified-evidence";
  estimateLabel: "estimate-not-tax-advice";
  scenario: ScenarioKind;
  userInputs: TaxReserveInput;
  adjustedInputs: Record<string, number>;
  corporateTax: TaxResult;
  vat: TaxResult;
  totalSuggestedTaxReserve: number | null;
  amountAlreadyReserved: number;
  reserveGap: number | null;
  reserveSurplus: number | null;
};

type Band = { fromInclusive: number; toExclusive: number | null; rate: number };

function money(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
function percent(value: number): number { return Math.round((value + Number.EPSILON) * 10_000) / 10_000; }

export function validateTaxReserveInput(value: unknown): { input?: TaxReserveInput; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: ["Request must be a JSON object."] };
  const source = value as Record<string, unknown>;
  const allowed = new Set(["profileId", "reportingPeriodStart", "reportingPeriodEnd", "scenario", "revenue", "accountingProfit", "taxAdjustments", "taxableProfit", "corporateTaxPaid", "vatTaxableSales", "vatCollected", "recoverableInputVat", "vatPaid", "amountAlreadyReserved", "profitChangePercent", "revenueChangePercent", "vatChangePercent"]);
  for (const key of Object.keys(source)) if (!allowed.has(key)) errors.push(`Unknown field: ${key}.`);
  const profileId = typeof source.profileId === "string" ? source.profileId.trim() : "";
  if (!profileId || profileId.length > 100) errors.push("profileId is required and must be at most 100 characters.");
  const date = (key: string) => {
    const raw = source[key];
    if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) { errors.push(`${key} must be a valid YYYY-MM-DD date.`); return ""; }
    return raw;
  };
  const reportingPeriodStart = date("reportingPeriodStart");
  const reportingPeriodEnd = date("reportingPeriodEnd");
  if (reportingPeriodStart && reportingPeriodEnd && reportingPeriodStart > reportingPeriodEnd) errors.push("reportingPeriodEnd must not be before reportingPeriodStart.");
  const scenario = source.scenario;
  if (scenario !== "current" && scenario !== "conservative" && scenario !== "custom") errors.push("scenario must be current, conservative, or custom.");
  const optionalNumber = (key: string, allowNegative = false, max = MAX_MONEY) => {
    const raw = source[key];
    if (raw === undefined) return undefined;
    if (typeof raw !== "number" || !Number.isFinite(raw) || (!allowNegative && raw < 0) || Math.abs(raw) > max) { errors.push(`${key} must be a finite ${allowNegative ? "number" : "non-negative number"} within the supported range.`); return undefined; }
    return raw;
  };
  const input: TaxReserveInput = {
    profileId, reportingPeriodStart, reportingPeriodEnd, scenario: scenario as ScenarioKind,
    revenue: optionalNumber("revenue"), accountingProfit: optionalNumber("accountingProfit", true),
    taxAdjustments: optionalNumber("taxAdjustments", true), taxableProfit: optionalNumber("taxableProfit"),
    corporateTaxPaid: optionalNumber("corporateTaxPaid"), vatTaxableSales: optionalNumber("vatTaxableSales"),
    vatCollected: optionalNumber("vatCollected"), recoverableInputVat: optionalNumber("recoverableInputVat"),
    vatPaid: optionalNumber("vatPaid"), amountAlreadyReserved: optionalNumber("amountAlreadyReserved"),
    profitChangePercent: optionalNumber("profitChangePercent", true, MAX_PERCENT),
    revenueChangePercent: optionalNumber("revenueChangePercent", true, MAX_PERCENT),
    vatChangePercent: optionalNumber("vatChangePercent", true, MAX_PERCENT),
  };
  for (const key of ["profitChangePercent", "revenueChangePercent", "vatChangePercent"] as const) if ((input[key] ?? 0) < -100) errors.push(`${key} cannot reduce an amount below zero.`);
  return errors.length ? { errors } : { input, errors };
}

function isOfficialUrl(value: string): boolean { try { return new URL(value).protocol === "https:"; } catch { return false; } }

export function isVerifiedTaxRule(rule: TaxRuleEvidence, profileJurisdiction: string): boolean {
  return rule.evidenceStatus === "official-verified"
    && rule.verifiedVersionId === rule.documentVerifiedVersionId
    && rule.verifiedVersionId === rule.versionId
    && rule.versionDocumentId === rule.regulatoryDocumentId
    && rule.versionReviewStatus === "verified"
    && rule.evidenceDocumentId === rule.regulatoryDocumentId
    && rule.evidenceVersionId === rule.verifiedVersionId
    && rule.evidenceReviewStatus === "verified"
    && rule.evidenceUrl === rule.officialSourceUrl
    && isOfficialUrl(rule.officialSourceUrl)
    && Boolean(rule.verificationDate) && rule.documentLastVerifiedAt === rule.verificationDate
    && (rule.documentStatus === "in-force" || rule.documentStatus === "amended")
    && rule.applicabilityState === "applies"
    && (rule.jurisdiction === "federal" || rule.jurisdiction === profileJurisdiction)
    && rule.documentJurisdiction === rule.jurisdiction
    && rule.documentAuthority === rule.authority
    && /^\d{4}-\d{2}-\d{2}$/.test(rule.applicableFrom)
    && (!rule.applicableTo || (/^\d{4}-\d{2}-\d{2}$/.test(rule.applicableTo) && rule.applicableTo >= rule.applicableFrom));
}

function coversReportingPeriod(rule: TaxRuleEvidence, input: TaxReserveInput): boolean {
  return rule.applicableFrom <= input.reportingPeriodStart && (!rule.applicableTo || rule.applicableTo >= input.reportingPeriodEnd);
}

function parseBands(rule: TaxRuleEvidence): Band[] | null {
  const raw = rule.parameters.bands;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const bands: Band[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const band = entry as Record<string, unknown>;
    if (typeof band.fromInclusive !== "number" || !Number.isFinite(band.fromInclusive) || band.fromInclusive < 0) return null;
    if (band.toExclusive !== null && (typeof band.toExclusive !== "number" || !Number.isFinite(band.toExclusive) || band.toExclusive <= band.fromInclusive)) return null;
    if (typeof band.rate !== "number" || !Number.isFinite(band.rate) || band.rate < 0 || band.rate > 1) return null;
    bands.push({ fromInclusive: band.fromInclusive, toExclusive: band.toExclusive as number | null, rate: band.rate });
  }
  bands.sort((a, b) => a.fromInclusive - b.fromInclusive);
  if (bands[0].fromInclusive !== 0 || bands.some((band, index) => index > 0 && bands[index - 1].toExclusive !== band.fromInclusive) || bands.slice(0, -1).some((band) => band.toExclusive === null)) return null;
  return bands;
}

function progressiveTax(amount: number, bands: Band[]): { tax: number; basis: string[] } {
  let total = 0;
  const basis: string[] = [];
  for (const band of bands) {
    const upper = band.toExclusive ?? amount;
    const taxable = Math.max(0, Math.min(amount, upper) - band.fromInclusive);
    if (taxable > 0 || amount === 0 && band.fromInclusive === 0) {
      const tax = money(taxable * band.rate); total += tax;
      basis.push(`AED ${money(taxable).toLocaleString("en-AE")} × ${percent(band.rate * 100)}% = AED ${tax.toLocaleString("en-AE")}`);
    }
    if (band.toExclusive === null || amount <= upper) break;
  }
  return { tax: money(total), basis };
}

function change(value: number, rate: number): number { return money(value * (1 + rate / 100)); }

export function calculateTaxReserve(input: TaxReserveInput, rules: TaxRuleEvidence[], profileJurisdiction: string): TaxReserveAssessment {
  const scenarioPercent = input.scenario === "conservative" ? 10 : 0;
  const profitChange = input.scenario === "current" ? 0 : input.profitChangePercent ?? scenarioPercent;
  const revenueChange = input.scenario === "current" ? 0 : input.revenueChangePercent ?? scenarioPercent;
  const vatChange = input.scenario === "current" ? 0 : input.vatChangePercent ?? scenarioPercent;
  const adjustedAccountingProfit = change(input.accountingProfit ?? 0, profitChange);
  const baseTaxableProfit = input.taxableProfit === undefined ? Math.max(0, adjustedAccountingProfit + (input.taxAdjustments ?? 0)) : change(input.taxableProfit, profitChange);
  const adjusted = {
    revenue: change(input.revenue ?? 0, revenueChange), accountingProfit: adjustedAccountingProfit,
    taxableProfit: money(baseTaxableProfit), vatTaxableSales: change(input.vatTaxableSales ?? 0, revenueChange),
    vatCollected: change(input.vatCollected ?? 0, vatChange), recoverableInputVat: input.recoverableInputVat ?? 0,
  };
  const verified = rules.filter((rule) => isVerifiedTaxRule(rule, profileJurisdiction) && coversReportingPeriod(rule, input));
  const corporateRules = verified.filter((rule) => rule.taxType === "corporate_tax" && rule.ruleKind === "progressive-rate-bands");
  const vatRules = verified.filter((rule) => rule.taxType === "vat" && rule.ruleKind === "net-output-minus-recoverable-input");
  const corporateRule = corporateRules.length === 1 ? corporateRules[0] : undefined;
  const vatRule = vatRules.length === 1 ? vatRules[0] : undefined;
  let corporateTax: TaxResult;
  if (input.taxableProfit === undefined && input.accountingProfit === undefined) corporateTax = { state: "not-requested", evidence: [], message: "Enter accounting profit or taxable profit to estimate Corporate Tax." };
  else {
    const bands = corporateRule && parseBands(corporateRule);
    if (!corporateRule || !bands) corporateTax = { state: "insufficient-verified-evidence", evidence: [], message: INSUFFICIENT_TAX_EVIDENCE };
    else {
      const calculated = progressiveTax(adjusted.taxableProfit, bands);
      const reserve = Math.max(0, money(calculated.tax - (input.corporateTaxPaid ?? 0)));
      corporateTax = { state: "estimated", amount: calculated.tax, recommendedReserve: reserve, basis: calculated.basis, effectiveReservePercentage: adjusted.taxableProfit > 0 ? percent(reserve / adjusted.taxableProfit * 100) : 0, evidence: [corporateRule] };
    }
  }
  let vat: TaxResult;
  if (input.vatCollected === undefined && input.recoverableInputVat === undefined) vat = { state: "not-requested", evidence: [], message: "Enter VAT collected or recoverable input VAT to estimate the net VAT position." };
  else if (!vatRule) vat = { state: "insufficient-verified-evidence", evidence: [], message: INSUFFICIENT_TAX_EVIDENCE };
  else {
    const net = money(adjusted.vatCollected - adjusted.recoverableInputVat);
    const reserve = Math.max(0, money(net - (input.vatPaid ?? 0)));
    vat = { state: "estimated", amount: net, recommendedReserve: reserve, basis: [`AED ${adjusted.vatCollected.toLocaleString("en-AE")} output VAT − AED ${adjusted.recoverableInputVat.toLocaleString("en-AE")} recoverable input VAT = AED ${net.toLocaleString("en-AE")}`], evidence: [vatRule] };
  }
  const estimated = [corporateTax, vat].filter((result) => result.state === "estimated");
  const requested = [corporateTax, vat].filter((result) => result.state !== "not-requested");
  const total = estimated.length ? money(estimated.reduce((sum, result) => sum + (result.recommendedReserve ?? 0), 0)) : null;
  const already = input.amountAlreadyReserved ?? 0;
  const gap = total === null ? null : money(Math.max(0, total - already));
  const surplus = total === null ? null : money(Math.max(0, already - total));
  return {
    state: requested.length > 0 && estimated.length === requested.length ? "estimated" : estimated.length ? "partial" : "insufficient-verified-evidence",
    estimateLabel: "estimate-not-tax-advice", scenario: input.scenario, userInputs: input, adjustedInputs: adjusted,
    corporateTax, vat, totalSuggestedTaxReserve: total, amountAlreadyReserved: already, reserveGap: gap, reserveSurplus: surplus,
  };
}
