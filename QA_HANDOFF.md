# Production QA handoff

Audit date: 5 September 2026

Branch: `agent-b-production-qa`

Base: `fb227a603732b81aefa5f629f29f85631bc26655`

## Release assessment

The demonstrated features and deployment path are materially safer and more
reliable on this branch. Mizan should not yet be described as production-ready:
the assistant has no authenticated distributed quota, the regulatory rules are
fictional samples rather than a reviewed production corpus, and the changes
must still be deployed and smoke-tested on Render.

## Root cause of the Render failure

Vinext builds `worker/index.ts` as `dist/server/index.js`. Its Node production
server invokes the Worker's `fetch` method with `env` set to `undefined`.
The Worker intercepted `/api/assistant` before the app route and read
`env.NVIDIA_API_KEY`, causing the observed TypeError even when Render had the
secret. `/api/health` read Node `process.env`, so it returned 200 and incorrectly
suggested the configuration was usable.

The fix shares one server-only handler between the Worker and app route.
Explicit Worker bindings are authoritative on Workers; when no bindings object
exists on Node, configuration is read at request time from `process.env`.
No secret-prefixed environment variable is used or emitted in client builds.

## Issues by severity

### P0 — launch blockers

- Fixed: Render assistant crashed because Vinext supplied no Worker `env` object.
- Remaining: regulatory obligations, dates, fees, status labels, and citations
  are demonstration fixtures. A reviewed, versioned production regulatory data
  process is required before this can make customer-specific compliance claims.
- Remaining: public assistant access needs authenticated, distributed rate
  limiting and usage quotas before paid or high-volume launch. Current
  per-isolate concurrency shedding only protects a single process.

### P1 — serious

- Fixed: health checks could pass while the assistant runtime was broken.
- Fixed: arbitrary-origin CORS defaulted to `*`.
- Fixed: assistant calls had no upstream timeout or response-size bound.
- Fixed: malformed and oversized request/response bodies were weakly handled.
- Fixed: upstream and configuration errors disclosed infrastructure branding.
- Fixed: customer UI exposed provider and model branding.
- Fixed: static GitHub Pages builds silently accepted a missing backend origin.
- Fixed: CI did not exercise type checks, API failure modes, readiness, both
  client builds, or secret leakage.
- Remaining: no user authentication, account isolation, durable audit history,
  or distributed abuse prevention exists in this demonstration.

### P2 — should fix

- Fixed: mobile CSS hid primary navigation items.
- Fixed: negative revenue, negative staff, fractional staff, and extreme values
  could enter applicability logic.
- Fixed: obligation dialog lacked native focus management and Escape behavior.
- Fixed: overlapping assistant requests could race and show stale answers.
- Fixed: client expected JSON even for HTML/non-JSON infrastructure errors.
- Fixed: fixed-date countdowns looked current; UI now labels the scenario date.
- Fixed: an inconsistent reserve figure was corrected from AED 18,750 to the
  displayed AED 4,500 target less AED 2,000 current reserve.
- Fixed: platform content labelled fictional records as verified.
- Fixed: stale starter metadata, README framing, lint error, type errors, and
  macOS-incompatible build assumptions.
- Remaining: authoritative-source links and sample rule wording need formal
  legal/compliance review and ongoing change governance.

### P3 — polish

- Fixed: current Compliance navigation state was always active.
- Fixed: empty platform search had no explicit empty state.
- Fixed: non-actionable client table rows were rendered as buttons.
- Fixed: missing focus-visible treatment and unclear form labels.

## QA matrix

| Feature | Test | Expected result | Actual result | Result | Notes |
|---|---|---|---|---|---|
| Home/navigation | Open every primary navigation item at 390px | Every feature remains reachable; no horizontal page overflow | All six destinations opened; document width stayed within viewport | PASS | In-app browser |
| Setup calculator | Change jurisdiction, workspace, and visas | Range recalculates from selected assumptions | AED 8,550–10,925 for other free zone, no office, zero visas | PASS | In-app browser |
| Company profile | Enter negative revenue and fractional employees | Progression blocked with accessible error | Buttons disabled and alert rendered | PASS | In-app browser |
| Applicability | Select sole establishment, low revenue, no VAT, zero staff, no cross-border activity | Non-applicable sample duties disappear | Two sample items remained | PASS | In-app browser |
| Dashboard | Open results and dashboard | Counts and profile reflect answers | Counts/profile updated | PASS | In-app browser |
| Calendar | Inspect empty months and fixed countdown | Empty state and sample-date caveat are visible | Both visible | PASS | In-app browser |
| Obligation details | Open dialog and press Escape | Modal is labelled, keyboard-contained, and closes | Native dialog opened and closed with Escape | PASS | In-app browser and source review |
| Change monitor | Open regulatory changes | Sample monitoring content renders | Content rendered | PASS | In-app browser |
| Assistant UI | Submit while backend is unconfigured | Safe branded failure, structured fallback, no console error | Safe Mizan error shown; no browser warnings/errors | PASS | In-app browser |
| Assistant API | Malformed JSON, wrong type, missing/long question, wrong media type, oversized body | 400/413/415 without crash or data leak | Expected status for each case | PASS | Automated |
| Assistant upstream | HTTP error, exception, malformed/empty/large/provider-branded response | Safe 502; no upstream detail | Expected status and redaction | PASS | Automated |
| Assistant timeout | Upstream exceeds deadline | 504 and concurrency slot released | Expected behavior | PASS | Automated |
| Abuse guard | More than eight concurrent requests per isolate | Excess request receives 429 and Retry-After | Expected behavior | PASS | Automated; not distributed |
| CORS | Allowed, same-origin, and arbitrary origins | Exact allowed origin only; arbitrary origin rejected | 204/403 and correct headers | PASS | Automated |
| Liveness/readiness | Missing and present server configuration | Liveness 200; readiness 503/200; no secret in body | Expected behavior | PASS | Automated |
| Node/Worker runtime | Undefined env, explicit empty bindings, explicit populated bindings | Node fallback works; Worker bindings stay isolated | Expected behavior | PASS | Automated regression for production crash |
| Adviser workspace | Filter Monitoring | Only matching fictional clients remain | Two clients shown | PASS | In-app browser |
| Pricing actions | Open each demonstration destination | Button navigates to intended demo | Business action opened dashboard | PASS | Representative browser check; source reviewed for others |
| Platform | Search, empty state, review queue, integrations | Correct filter/state/tab content | All rendered correctly | PASS | In-app browser |
| Desktop responsive | Exercise main flows at 1440px | Layout and actions usable | Main flows passed | PASS | In-app browser |
| Mobile responsive | Exercise all destinations at 390×844 | No hidden route or horizontal page overflow | All routes passed; width 375 within 390 viewport | PASS | In-app browser |
| Client secret scan | Scan full-stack and Pages HTML/JS for server keys, endpoint, provider branding, sentinel | No match | No match | PASS | Automated |
| Production build | `npm run build` | Worker artifact and manifest valid | Build and artifact validation passed | PASS | Local |
| Static build | Build with valid HTTPS API origin | Pages artifact succeeds | Build passed | PASS | Local |
| Static misconfiguration | Build without API origin | Build fails early | Configuration error thrown | PASS | Local |
| Live Render baseline | Inspect active service and logs | Determine deployed failure mode | Repeated undefined-env crash confirmed | PASS | Read-only Render inspection |
| Live Render fixed branch | Deploy branch and smoke-test `/api/ready` and assistant | Ready 200 and assistant returns safe response | Not run | FAIL | Branch is intentionally not merged/deployed |

## Tests and validation

- `npm ci`: passed (509 packages from the final lockfile).
- `npm run lint`: passed with no warnings or errors.
- `npm run typecheck`: passed.
- `NVIDIA_API_KEY=qa-build-secret-sentinel npm test`: 13/13 passed.
- `VITE_API_BASE_URL=https://example.invalid npm run build:pages`: passed.
- `node scripts/check-client.mjs`: both client bundles passed.
- In-app browser checks: desktop and 390×844 mobile flows passed with no
  captured console warnings or errors.
- A local Playwright/Chrome subprocess was blocked by the macOS sandbox before
  page launch. It did not execute any test and is not counted as a product
  failure; browser checks were completed through the in-app browser.

## Deployment concerns

- Render's live service is configured in the Dashboard with
  `npm install; npm run build`, while `render.yaml` specifies deterministic
  `npm ci && npm run build`. Align the live service after merge.
- Change the live health check from `/api/health` to `/api/ready`; the Blueprint
  now declares this.
- Set `CORS_ORIGIN` to each exact allowed frontend origin as a comma-separated
  list. For GitHub Pages, the origin excludes the repository path.
- GitHub Pages must define the non-secret `VITE_API_BASE_URL` as the exact HTTPS
  Render origin. Its build now fails rather than shipping a broken relative API.
- Render auto-deploys `main`; pushing this QA branch does not deploy it.

## Security concerns

- Server secrets remain server-side and client artifacts are scanned in CI.
- API errors do not include upstream bodies, tokens, configured URLs, or model
  names. Health returns configuration state and a shortened revision only.
- CORS is an exact browser-origin policy, not authentication. Requests without
  an Origin header remain possible for non-browser clients.
- The assistant accepts no company records and the UI instructs users to enter
  fictional data. Real data handling needs authentication, authorization,
  tenancy controls, retention policy, audit logging, and a privacy review.

## Recommended merge order

Merge Agent B first because it changes shared runtime configuration, the Worker
entry, assistant route, health endpoints, `app/page.tsx`, and CI. Agent A should
then rebase the Regulatory Search branch onto the updated main branch and retain
the shared server-side environment, Mizan branding, disclosure, validation, and
CORS patterns. Resolve `app/page.tsx` carefully; do not overwrite the hardening
changes with an older whole-file version.
