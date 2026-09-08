"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CalendarAssessment, VerifiedCalendarItem } from "../../lib/compliance-calendar";

const emptySummary = { overdue: 0, "due-today": 0, "next-7-days": 0, "next-30-days": 0, "next-60-days": 0, "next-90-days": 0 };

export default function ComplianceCalendarPage() {
  const [profileId] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("mizan.profileId") ?? "");
  const [calendar, setCalendar] = useState<CalendarAssessment>({ state: "insufficient-verified-evidence", items: [], summary: emptySummary });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!profileId) return;
    fetch(`/api/compliance-calendar?profileId=${encodeURIComponent(profileId)}`).then(async (response) => {
      const payload = await response.json() as CalendarAssessment & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The compliance calendar is unavailable.");
      setCalendar(payload);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "The compliance calendar is unavailable."));
  }, [profileId]);
  return <main><header><Link className="brand" href="/">م <span>Mizan<small>UAE REGULATORY INTELLIGENCE</small></span></Link><Link className="profile-back" href="/">Back to Mizan</Link></header><section className="calendar-page"><p className="eyebrow">Verified obligations only</p><h1>Compliance Calendar</h1><p className="calendar-lead">Applicable deadlines are shown only when an official requirement, company applicability, due date and verified evidence chain are all present.</p>{!profileId && <div className="calendar-empty"><h2>Complete your Company Profile first</h2><p>Mizan needs a company profile to identify applicable obligations. No deadline is inferred without it.</p><Link className="primary calendar-link" href="/company-profile">Open Company Profile</Link></div>}{error && <div className="calendar-empty"><h2>Calendar unavailable</h2><p>{error}</p></div>}{profileId && !error && <><div className="calendar-stats">{[["overdue", "Overdue"], ["next-7-days", "Next 7 days"], ["next-30-days", "Next 30 days"], ["next-90-days", "Next 90 days"]].map(([key, label]) => <article key={key}><span>{label}</span><b>{calendar.summary[key as keyof typeof calendar.summary]}</b></article>)}</div>{calendar.state === "insufficient-verified-evidence" ? <div className="calendar-empty"><h2>No verified deadlines available</h2><p>Mizan does not currently have sufficient verified regulatory evidence with a deterministic due date for this profile. Pending or incomplete records are not displayed as deadlines.</p></div> : <div className="calendar-items">{calendar.items.map((item: VerifiedCalendarItem) => <article className="calendar-card" key={item.id}><div><p className="calendar-date">{item.dueDate} · {item.state.replaceAll("-", " ")}</p><h2>{item.obligationTitle}</h2><p>{item.description}</p><small>{item.authority} · {item.jurisdiction}</small></div><div><span className="tag">Official evidence verified</span><a href={item.officialSourceUrl} target="_blank" rel="noreferrer">Official source ↗</a><small>Applies because: {item.applicabilityBasis.join(", ")}</small></div></article>)}</div>}</>}</section></main>;
}
