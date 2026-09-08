"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { VerifiedCalendarItem } from "../../lib/compliance-calendar";
import type { ScenarioKind, TaxReserveAssessment, TaxRuleEvidence } from "../../lib/tax-reserve";

type PlannerResponse = {
  profile: { id: string; legalName: string; jurisdiction: string; vatStatus?: string | null; corporateTaxStatus?: string | null };
  assessment: TaxReserveAssessment;
  upcomingTaxActions: VerifiedCalendarItem[];
  deadlineEvidenceState: string;
};

const moneyFields = ["revenue", "accountingProfit", "taxAdjustments", "taxableProfit", "corporateTaxPaid", "vatTaxableSales", "vatCollected", "recoverableInputVat", "vatPaid", "amountAlreadyReserved"] as const;
const labels: Record<(typeof moneyFields)[number], string> = {
  revenue: "Revenue", accountingProfit: "Accounting profit", taxAdjustments: "Known tax adjustments",
  taxableProfit: "Taxable profit (if already known)", corporateTaxPaid: "Corporate Tax already paid",
  vatTaxableSales: "VAT taxable sales", vatCollected: "VAT collected / output tax",
  recoverableInputVat: "Recoverable input VAT", vatPaid: "VAT already paid", amountAlreadyReserved: "Cash already reserved for tax",
};
const corporateFields = moneyFields.slice(0, 5);
const vatFields = moneyFields.slice(5, 9);
const currentYear = new Date().getFullYear();
const initialValues: Record<string, string> = { reportingPeriodStart: `${currentYear}-01-01`, reportingPeriodEnd: `${currentYear}-12-31`, ...Object.fromEntries(moneyFields.map((field) => [field, ""])) };

function aed(value?: number | null) {
  return value === null || value === undefined ? "Insufficient evidence" : new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 }).format(value);
}

export default function TaxReservePlannerPage() {
  const [profileId] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("mizan.profileId") ?? "");
  const [scenario, setScenario] = useState<ScenarioKind>("current");
  const [values, setValues] = useState(initialValues);
  const [result, setResult] = useState<PlannerResponse>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setResult(undefined);
    const body: Record<string, unknown> = { profileId, reportingPeriodStart: values.reportingPeriodStart, reportingPeriodEnd: values.reportingPeriodEnd, scenario };
    for (const field of moneyFields) if (values[field] !== "") body[field] = Number(values[field]);
    if (scenario === "custom") for (const field of ["profitChangePercent", "revenueChangePercent", "vatChangePercent"]) body[field] = Number(values[field] || 0);
    try {
      const response = await fetch("/api/tax-reserve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as PlannerResponse & { error?: string; details?: string[] };
      if (!response.ok || !payload.assessment) throw new Error(payload.details?.join(" ") || payload.error || "The estimate could not be completed.");
      setResult(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The estimate could not be completed."); }
    finally { setLoading(false); }
  }
  return <main className="tax-planner"><header><Link className="brand" href="/">م <span>Mizan<small>UAE REGULATORY INTELLIGENCE</small></span></Link><nav><Link className="profile-nav" href="/company-profile">Company Profile</Link><Link className="profile-nav" href="/compliance-calendar">Compliance Calendar</Link><Link className="profile-back" href="/">Back to Mizan</Link></nav></header>
    <section className="tax-hero"><div><p className="eyebrow">Tax Reserve Planner</p><h1>Plan the cash.<br/><em>Inspect the basis.</em></h1><p>Estimate upcoming Corporate Tax and VAT cash needs using your figures and only tax rules that have passed Mizan’s official evidence checks.</p></div><div className="tax-boundary"><b>How Mizan separates the result</b><ol><li><span>1</span>User-entered financial information</li><li><span>2</span>Verified UAE tax rules</li><li><span>3</span>Deterministic calculations</li><li><span>4</span>Clearly labelled estimates</li></ol></div></section>
    {!profileId ? <section className="tax-shell"><div className="calendar-empty"><h2>Start with your Company Profile</h2><p>The planner needs your saved jurisdiction and tax status to check whether each verified rule applies.</p><Link className="primary calendar-link" href="/company-profile">Complete Company Profile</Link></div></section> : <section className="tax-workspace"><form className="tax-inputs" onSubmit={submit}><div className="step-title"><span>1</span><div><small>Business</small><h2>Reporting period</h2></div></div><div className="tax-two"><label>Period start<input type="date" required value={values.reportingPeriodStart} onChange={(event) => set("reportingPeriodStart", event.target.value)}/></label><label>Period end<input type="date" required value={values.reportingPeriodEnd} onChange={(event) => set("reportingPeriodEnd", event.target.value)}/></label></div>
      <div className="step-title"><span>2</span><div><small>Financial inputs</small><h2>Corporate Tax</h2></div></div><p className="form-help">Enter taxable profit only if you know it. Otherwise Mizan uses accounting profit plus your known adjustments.</p><div className="tax-two">{corporateFields.map((field) => <MoneyField key={field} field={field} value={values[field]} set={set}/>)}</div>
      <div className="step-title"><span>3</span><div><small>Financial inputs</small><h2>VAT</h2></div></div><p className="form-help">Use figures from your records. Mizan does not infer VAT collected from sales unless a verified rate rule supports that calculation.</p><div className="tax-two">{vatFields.map((field) => <MoneyField key={field} field={field} value={values[field]} set={set}/>)}</div>
      <div className="step-title"><span>4</span><div><small>Reserve position</small><h2>Cash already set aside</h2></div></div><MoneyField field="amountAlreadyReserved" value={values.amountAlreadyReserved} set={set}/>
      <fieldset className="scenario-picker"><legend>Scenario</legend><div>{(["current", "conservative", "custom"] as const).map((choice) => <button type="button" className={scenario === choice ? "selected" : ""} onClick={() => setScenario(choice)} key={choice}>{choice[0].toUpperCase() + choice.slice(1)}</button>)}</div><p>{scenario === "current" ? "Uses the figures entered above." : scenario === "conservative" ? "Applies a 10% arithmetic uplift to profit, revenue and VAT collected. Tax rates do not change." : "Choose arithmetic changes below. Tax rates remain fixed to verified rules."}</p>{scenario === "custom" && <div className="tax-three">{[["profitChangePercent", "Profit change %"], ["revenueChangePercent", "Revenue change %"], ["vatChangePercent", "VAT collected change %"]].map(([field, label]) => <label key={field}>{label}<input type="number" min="-100" max="1000" step="0.01" value={values[field] ?? ""} onChange={(event) => set(field, event.target.value)}/></label>)}</div>}</fieldset>
      {error && <p className="error" role="alert">{error}</p>}<button className="primary tax-submit" disabled={loading}>{loading ? "Checking verified evidence…" : "Estimate tax reserve →"}</button><p className="form-help">Estimates are planning information, not formal tax advice or a prepared or filed tax return.</p></form>
      <section className="tax-results" aria-live="polite">{result ? <Results data={result}/> : <div className="tax-waiting"><p className="eyebrow">Estimate</p><h2>Your reserve dashboard will appear here.</h2><p>Nothing is calculated until you submit. If verified, applicable evidence is missing, Mizan will show an explicit insufficient-evidence state.</p></div>}</section></section>}
    <footer className="sitefoot"><div><b>Mizan</b><span>UAE Regulatory Intelligence</span></div><p>Tax reserve figures are estimates for planning. Confirm filing positions with the cited authority or a qualified adviser.</p></footer></main>;
}

function MoneyField({ field, value, set }: { field: (typeof moneyFields)[number]; value: string; set: (key: string, value: string) => void }) {
  return <label>{labels[field]}<span className="money-input"><b>AED</b><input aria-label={`${labels[field]} in AED`} type="number" min={field === "accountingProfit" || field === "taxAdjustments" ? undefined : "0"} max="1000000000000000" step="0.01" value={value} onChange={(event) => set(field, event.target.value)}/></span></label>;
}

function Results({ data }: { data: PlannerResponse }) {
  const a = data.assessment;
  const cards = [
    ["Estimated Corporate Tax", a.corporateTax.amount], ["Recommended Corporate Tax Reserve", a.corporateTax.recommendedReserve],
    ["Estimated Net VAT Position", a.vat.amount], ["Recommended VAT Reserve", a.vat.recommendedReserve],
    ["Total Suggested Tax Reserve", a.totalSuggestedTaxReserve], ["Amount Already Reserved", a.amountAlreadyReserved],
    [a.reserveSurplus ? "Reserve Surplus" : "Reserve Gap", a.reserveSurplus || a.reserveGap],
  ] as const;
  const evidence = [...a.corporateTax.evidence, ...a.vat.evidence].filter((rule, index, all) => all.findIndex((item) => item.ruleId === rule.ruleId) === index);
  return <><div className="result-head"><div><p className="eyebrow">Estimate complete · {a.scenario} scenario</p><h2>{data.profile.legalName}</h2><p>{data.profile.jurisdiction.replaceAll("_", " ")} · figures are estimates, not tax advice</p></div><span className={`result-state ${a.state}`}>{a.state.replaceAll("-", " ")}</span></div><div className="reserve-grid">{cards.map(([label, value]) => <article key={label}><small>{label}</small><b>{aed(value)}</b></article>)}</div>
    {(a.corporateTax.message || a.vat.message) && <div className="insufficient-panel">{a.corporateTax.message && <p><b>Corporate Tax:</b> {a.corporateTax.message}</p>}{a.vat.message && <p><b>VAT:</b> {a.vat.message}</p>}</div>}
    <section className="calculation-basis"><p className="eyebrow">Calculation basis</p><h3>How the estimate was calculated</h3><Basis title="Corporate Tax" lines={a.corporateTax.basis}/><Basis title="VAT" lines={a.vat.basis}/>{a.corporateTax.effectiveReservePercentage !== undefined && <p><b>Effective Corporate Tax reserve percentage:</b> {a.corporateTax.effectiveReservePercentage}% of adjusted taxable profit</p>}</section>
    <section className="why"><p className="eyebrow">Evidence</p><h3>Why this calculation?</h3>{evidence.length ? evidence.map((rule) => <Evidence key={rule.ruleId} rule={rule}/>) : <p className="form-help">No regulatory assumption passed the full verified evidence and applicability gate for this calculation.</p>}</section>
    <section className="tax-actions"><p className="eyebrow">Upcoming verified tax actions</p><h3>From your Compliance Calendar</h3>{data.upcomingTaxActions.length ? data.upcomingTaxActions.map((item) => <article key={item.id}><div><b>{item.obligationTitle}</b><p>{item.description}</p><small>Due {item.dueDate} · {item.authority}</small></div><a href={item.officialSourceUrl} target="_blank" rel="noreferrer">Official source ↗</a></article>) : <p className="form-help">No applicable tax action with verified Calendar provenance is currently available. Mizan has not inferred a deadline.</p>}</section></>;
}

function Basis({ title, lines }: { title: string; lines?: string[] }) { return lines?.length ? <div><b>{title}</b>{lines.map((line) => <code key={line}>{line}</code>)}</div> : null; }
function Evidence({ rule }: { rule: TaxRuleEvidence }) { return <details><summary>{rule.ruleLabel}<span>Official evidence verified</span></summary><dl><div><dt>Applicable rule</dt><dd>{rule.ruleLabel}</dd></div><div><dt>Authority</dt><dd>{rule.authority}</dd></div><div><dt>Jurisdiction</dt><dd>{rule.jurisdiction}</dd></div><div><dt>Rule period</dt><dd>{rule.applicableFrom} → {rule.applicableTo ?? "open-ended"}</dd></div><div><dt>Verified version</dt><dd>{rule.verifiedVersionLabel} · ID {rule.verifiedVersionId}</dd></div><div><dt>Verification date</dt><dd>{new Date(rule.verificationDate).toLocaleDateString("en-AE")}</dd></div></dl><a href={rule.officialSourceUrl} target="_blank" rel="noreferrer">View official source ↗</a></details>; }
