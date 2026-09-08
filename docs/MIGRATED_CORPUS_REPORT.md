# UAE regulatory corpus migration report

Date: 2026-09-08

Source repository: `sweater9/mizan-uae-legal-research`

Target repository: `sweater9/mizan-uae-compliance-intelligence`

## Outcome

- Legacy instruments assessed: 104
- Records added to the migration corpus: 90
- Records reviewed in the per-record audit ledger: 90
- Records independently promoted to `official-verified`: 0
- Records retained as `official-source-pending-review`: 90
- Records rejected before migration: 14
- Live production database deduplication: guarded in the seeder against normalized document identity and canonical official URL; not run because `MIZAN_DATABASE_URL` was unavailable in this environment

Legacy `last_verified` values are retained only as provenance claims. They never set `last_verified_at`, a verified version, a verified evidence review, or `official-verified` status in the target schema.

## Coverage

| Jurisdiction | Records |
| --- | ---: |
| UAE Mainland | 69 |
| ADGM | 9 |
| DIFC | 8 |
| Dubai / VARA | 4 |

The corpus covers corporate and commercial regulation, tax, employment, AML/CFT, beneficial ownership, data protection, consumer and digital commerce, intellectual property, electronic transactions, cybercrime, insolvency, financial services, virtual assets, immigration, health, media, competition, trusts, family business and related implementation instruments.

## Official sources identified

| Official source | Records |
| --- | ---: |
| UAE Federal Legislation | 66 |
| Abu Dhabi Global Market | 9 |
| Dubai International Financial Centre | 6 |
| Virtual Assets Regulatory Authority | 4 |
| Central Bank of the UAE Rulebook | 3 |
| Dubai Financial Services Authority Rulebook | 2 |

Every accepted record uses an HTTPS URL on the migration allowlist. On 2026-09-08, automated source checks received a successful official-page response for 15 records. Anti-automation controls returned HTTP 403 for 69 records and HTTP 429 for 6 records. A successful page response was not treated as sufficient substantive verification, so all accepted records remain pending official review.

## Duplicates and rejections

- 5 duplicates within the legacy repository were collapsed by normalized instrument identity.
- 6 instruments already represented by production seed records were rejected.
- 1 ADGM AML entry overlapping the existing production framework record was rejected.
- 1 Cabinet Resolution entry was rejected because it reused the parent AML Decree-Law URL and requires instrument-level citation review.
- 1 Ministry DNFBP guidance entry was rejected because the cited official PDF returned HTTP 404.

The machine-readable rejection audit is stored in `data/migrated-regulatory-corpus-rejections.json`.
The per-record verification ledger is stored in `data/migrated-regulatory-corpus-review.json`. It records the source response, every required verification dimension, and the precise reason each record remains pending.

## Evidence and version safeguards

The migration seeder:

- validates the complete corpus before connecting to the database;
- checks the live corpus again using normalized instrument identity and official URL;
- never updates an existing document;
- inserts documents only as `official-source-pending-review`;
- creates pending versions and pending official-source evidence;
- does not set `verified_version_id` or `last_verified_at`;
- relies on the existing database constraints and verification triggers unchanged.

## Remaining coverage gaps

- The 75 records blocked by official-site anti-automation controls need human or approved-browser instrument-level review.
- The 15 records that returned a successful official-page response are still not verified: page reachability did not reconfirm the instrument substantively.
- Instrument status, publication date and effective date remain pending where the legacy corpus did not provide independently reconfirmed dates.
- The rejected Cabinet Resolution citation and Ministry DNFBP guidance URL were not resolved in this pass; no independently confirmed replacement official instrument URLs were found.
- Federal emirate-level regulators and licensing authorities outside the current federal/Dubai/DIFC/ADGM set need a separate scoped coverage pass.
- Pending records will not be exposed by the verified-only production repository until existing evidence review safeguards are completed.
- The guarded migrated-corpus seeder was not executed because production database credentials were unavailable; no production-seeding result is claimed.
