import Link from "next/link";

export default function SignInPage() {
  const loginUrl = process.env.MIZAN_AUTH_LOGIN_URL;
  return <main className="auth-screen">
    <header><Link className="brand" href="/">م <span>Mizan<small>UAE REGULATORY INTELLIGENCE</small></span></Link></header>
    <section className="auth-card">
      <p className="eyebrow">Secure workspace access</p>
      <h1>Sign in to Mizan</h1>
      <p>Mizan uses your organization’s signed identity session. Company data is only available to members of its workspace.</p>
      {loginUrl ? <a className="primary" href={loginUrl}>Continue to secure sign-in</a> : <p className="error" role="alert">Sign-in is not configured for this deployment.</p>}
      <p className="privacy">Search and Ask remain available without an account. Never paste secrets or tokens into this page.</p>
    </section>
  </main>;
}
