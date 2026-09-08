import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return <main><header><Link className="brand" href="/">م <span>Mizan<small>UAE REGULATORY INTELLIGENCE</small></span></Link><Link className="profile-back" href="/">Back to Mizan</Link></header><section className="profile-intro"><p className="eyebrow">Account</p><h1>Your Mizan workspace</h1><p>Authentication is provided by your deployment identity provider. Use your provider session to access company profiles, assessments, calendars and change monitoring.</p><p className="privacy">Your account and workspace membership are checked server-side on every company-specific request.</p></section></main>;
}
