# Jedel.Group ERP verification report

Review date: 6 November 2026 (Asia/Qyzylorda). Scope: existing Angular/Django repository and preserved SQL dump; no business records or schema changes in the existing database.

## Outcome

All six Angular routes and their tested interactions work in component/HTTP contract tests. Django business operations and server-enforced credential roles work against a disposable PostgreSQL 17 database. This is not certification of live deployment or browser-rendered layout: actual database credentials and a browser automation tool were unavailable.

## Fixes

- DEBUG defaults false; production refuses to start without a secret. Local development explicitly opts into DEBUG.
- Django 6.0.3 upgraded to **6.0.10**, the supported security patch announced in the [official Django security release](https://www.djangoproject.com/weblog/2026/nov/03/security-releases/). No application migrations executed.
- Viewer/Buyer/Approver/Admin credential roles enforced on Django endpoints, with distinct credentials, constant-time comparison, and actual role/capability reporting. Angular uses server capabilities for affordances, not authorization.
- Bounded JSON parsing returns 413 for oversized bodies, including streams without a trusted Content-Length. Invalid status filters return 400; unsupported authenticated methods preserve 405; non-JSON inputs return 415.
- No-store/private API responses, Authorization cache variation, clickjacking protection, and same-origin referrer policy.
- Corrected very large currency display precision: Decimal strings must round-trip through the actual number formatter without losing cents; unsafe values are not displayed as valid amounts.
- Accessible field error associations, required/invalid attributes, modal focus return, Escape navigation, labelled keyboard-scrollable table regions, and pressed state for status filters.
- Pagination clamps to valid pages after result sets shrink.
- Improved muted/status text contrast, fixed corrupted currency/placeholders, wrapped narrow charts/headings, and made KPI cards single-column at <=420px. Overflow fixes are source-reviewed, not visually browser-verified.

## Server authorization

| Operation                                         | Viewer | Buyer | Approver | Admin |
| ------------------------------------------------- | ------ | ----- | -------- | ----- |
| Read records/reports                              | Yes    | Yes   | Yes      | Yes   |
| Create/update suppliers and products              | No     | Yes   | No       | Yes   |
| Create/amend Pending orders                       | No     | Yes   | No       | Yes   |
| Approve/deliver/cancel eligible orders            | No     | No    | Yes      | Yes   |
| Delete unreferenced suppliers/zero-stock products | No     | No    | No       | Yes   |

Credentials are shared, held only in browser memory, and provisioned in server environment variables. There are no named accounts, per-person auditability, password reset, automatic expiry, or self-service credential issuance. Multiple credentials could be held by one person. This is minimal role-based API access, not a complete identity system.

## Test execution

| Check                                                                                             | Result                                                                                                   |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Angular unit/component/HTTP tests (`npm test -- --watch=false`)                                   | 41 passed, 0 failed                                                                                      |
| Angular production build (`npm run build`)                                                        | Passed; strict TypeScript/templates and bundle budgets checked                                           |
| Django system checks with explicit development DEBUG                                              | No issues                                                                                                |
| Guarded PostgreSQL tests (`scripts/test_postgres.py`)                                             | 42 passed, 0 failed                                                                                      |
| Python dependency consistency (`python -m pip check`)                                             | Passed                                                                                                   |
| Production configuration check (`manage.py check --deploy`, in-memory random secret, DEBUG=false) | No errors; security.W005 and security.W021 warnings                                                      |
| npm production dependency audit (`npm audit --omit=dev --json`)                                   | 0 advisories                                                                                             |
| Full npm dependency audit (`npm audit --json`)                                                    | 16 moderate development-tool advisories; no high/critical advisories                                     |
| Git diff whitespace (`git diff --check`)                                                          | Passed                                                                                                   |
| Secret-pattern review                                                                             | No findings in 3 local history commits / 6 historical file versions and 88 backend/frontend source files |
| Browser/mobile/tablet/desktop rendering and browser E2E                                           | Not executed: no browser testing tool                                                                    |
| Existing jedel_group_db live schema/data                                                          | Not verified: credentials unavailable                                                                    |

Secret checks are pattern-based review, not a guarantee of absence. An initial scanner false positive on consecutive empty `.env.example` values was inspected and corrected; no credential values are included in this report. `.env`, virtual environments, generated builds, caches, and node_modules remain ignored.

The seven measured text/background contrast pairs (muted text and status/demo labels) range from **5.45:1 to 6.23:1** and exceed 4.5:1. This does not constitute a complete WCAG audit or verify rendered fonts, focus visibility at every zoom level, or assistive technology.

## Functional coverage

- Routes: Dashboard, Suppliers, Products, Purchase Orders, Analytics, Settings, default/fallback routing, and quick-action/detail links.
- Supplier/product validated CRUD, searches, category filtering, sorting, pagination, unique email handling, read-only stock, and protected deletion.
- Orders with multiple lines, positive quantities, valid references, distinct products, valid dates, Decimal prices/totals, captured historical prices, and final-state controls.
- Atomic order creation/amendment and delivery; rollback after partial item inserts, stock updates, and final status failures.
- Full API purchasing flow: create supplier ? create zero-stock product ? create order/items ? approve ? deliver ? verify stock ? reject repeat delivery.
- Real PostgreSQL concurrency: duplicate delivery, different orders sharing products, and cancellation racing delivery.
- Loading/empty/error states, retained form values on rejection, no optimistic success, refresh-after-commit failure warnings, no demo fallback, and stale responses after disconnect.
- Server role denial and privilege escalation rejection; CORS preflight, explicit bearer/CSRF boundaries, cache policy, body size limits, safe errors, and isolated-test guards.

The test helper starts a separate short-lived PostgreSQL cluster on a loopback ephemeral port, creates only its test schema from the committed DDL, and stops/removes it afterward. Any auth/contenttypes migrations in test logs affect only that disposable database. Existing application DB and dump contents remain unchanged.

## Remaining risks and follow-up

1. Verify live schema, triggers (especially inventory triggers), least-privilege grants, and identity sequences using securely configured credentials before live writes. No live purchasing workflow was attempted.
2. Manually review at **320px mobile, 768px tablet, and 1440px desktop**, plus 200% zoom and keyboard/screen-reader use. Check chart wrapping, table scroll, modal focus trap, long names/prices, and touch targets. jsdom tests do not compute rendered layout; no screenshots were generated.
3. Resolve the 16 moderate CLI dependency advisories through a reviewed compatible upstream release. The full audit traces to glob/minimatch dependency chains ([glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)). npm proposes an Angular CLI 17 downgrade; it was not forced onto this Angular 21 project. Runtime audit is clean, which does not eliminate development supply-chain risk.
4. Production HSTS includeSubDomains/preload must be reviewed against actual domain ownership and TLS support. Their explicit opt-in settings intentionally leave deployment-check warnings. Configure reverse-proxy TLS, body/rate/time limits, and trusted proxy headers for the deployment; none are guessed here.
5. Full named-user authentication, expiring/revocable per-user credentials, audit trail, client idempotency keys for creation, partial receipts, stock ledger, and large-dataset server-driven pagination remain unimplemented. No formal penetration test or full Python advisory scanner was run; `pip check` verifies consistency, not vulnerability absence.

## Local run

Follow the exact two-terminal PowerShell steps in [README](../README.md#local-run-powershell). Important: set DJANGO_DEBUG=true for local HTTP, configure real DB credentials without committing them, provision distinct role tokens, start Django with `--skip-migration-check`, start Angular with `npm start`, then connect in Settings. No migration or SQL restore is part of setup. See [backend API documentation](../backend/README.md) and [frontend guide](../frontend/README.md).
