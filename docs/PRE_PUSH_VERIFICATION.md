# Jedel.Group ERP — pre-push verification

Audit date: 6 November 2026. Repository: `D:\BIS_project\jedel-group-database`.

**Conclusion: READY WITH WARNINGS.** Build and regression checks pass, with no detected committed credentials. Suitable for a reviewed development commit/PR after confirming the existing SQL contact records are approved educational data. This is not production deployment approval. A direct push to shared `main` is not recommended.

## 1. Git branch and remote

- Branch `main`; HEAD `b41e748` (`database is uploaded`).
- Fetch/push remote: `https://github.com/bekksr/jedel-group-database`.
- Fresh `git fetch origin` succeeded after allowing network access. The first sandboxed attempt failed to reach GitHub; the subsequent fetch passed.
- `git rev-list --left-right --count main...origin/main`: **0 ahead, 0 behind**. No unincorporated commits were found at audit time.
- Reachable history: `b41e748` database upload, `0877d60` gitignore, `640d1cc` initial README.
- Index is empty: no staged changes. Existing working changes: modified `.gitignore`/`README.md`, deleted old root dump path, untracked `backend/`, `frontend/`, `database/`, `docs/`. Individual candidate paths appear in the appendix.
- No merge, rebase, reset, staging, commit, push, force-push, history rewrite or second repository initialization was performed.
- Repository write permission, protected-branch rules, required reviews and remote CI were not queried or verified. Remote state can change after this fetch; fetch again before publication.

## 2. Files and preservation

The tracked diff was reviewed, including README edits, ignore additions and the root dump relocation. New application files were inventoried and scanned, with focused source review of configuration, routes, API adapter, authentication/permissions, validation, reports, unmanaged models, business transactions and isolated test setup. Passing tests provide additional coverage; this is not a formal proof that every possible application path is defect-free.

The old `jedel_group_db.sql` now resides at `database/dumps/jedel_group_db.sql`. Current working-copy SHA256: `80CADF870B4176072D681A4ACB438AF02FD52AC2CFA26FD1BAADCA3642641F09`. Git's committed blob is 9,264 bytes with LF, while the preserved Windows file is 9,599 bytes with 335 CRLF endings. Contents are exactly equal after CRLF normalization. No SQL statements or records were removed. Git may show deletion plus an untracked directory until explicitly staged; inspect rename detection afterward. No staging was done during this audit.

The repository contains the five team names and original database work. No team file was deleted by this audit. Generated dependencies, builds and local process logs remain on disk and are ignored. The default favicon and unused server-rendering scaffolding remain; they are ordinary source/scaffold files, not build output.

## 3. Checks actually executed

| Check | Result |
| --- | --- |
| Angular `npm run build` | PASS, production build; initial bundle 417.85 kB, within configured budgets |
| Angular `npm test -- --watch=false` | PASS: 41 tests, 6 test files |
| Strict TypeScript/templates | PASS through Angular production compilation; strict TypeScript and strictTemplates configured |
| All six feature routes, default and unknown-route fallback | PASS in Angular RouterTestingHarness tests |
| Django `manage.py check` with explicit development DEBUG | PASS, zero issues |
| Backend `scripts/test_postgres.py` | PASS: 78 tests, zero failures, real disposable PostgreSQL |
| `python -m pip check` | PASS, no broken requirements |
| `npm ls --depth=0` | PASS, installed direct dependency tree resolves |
| `npm audit --json` | WARNING, exit 1: 16 moderate affected package entries; zero high/critical |
| `npm audit --omit=dev --json` | PASS, zero reported production dependency vulnerabilities |
| Django `check --deploy` with temporary private secret and DEBUG=false | Exit 0 with security.W005/W021 warnings; not a warning-free result |
| `git diff --check` | PASS; Git emits an informational Windows LF/CRLF conversion warning for README |
| Ignore probes and tracked-ignored scan | PASS; required generated/private probes ignored; no already-tracked ignored files |
| Live PostgreSQL read-only SQL in this audit | NOT VERIFIED: no DB credentials in current process |
| Real-browser visual/responsive interaction checks | NOT TESTED: no browser automation tool available |

No missing runtime/build/test dependencies were found. Installed Node.js 24.13.1, npm 11.8.0, Python 3.13.1; Angular core 21.2.26, CLI/build 21.2.29, TypeScript 5.9.3. Backend requirements pin Django 6.0.10, DRF 3.17.1, django-cors-headers 4.9.0, psycopg2 2.9.10. No packages were installed or changed during this audit.

## 4. Frontend integration and UX review

Dashboard, Suppliers, Products, Purchase Orders, Analytics and Settings have lazy component routes and compile successfully. Route tests also exercise supplier forms/search/sort/deletion, product filtering/price validation/stock preservation, purchasing interactions and settings. These component/unit tests use the labelled demo service where appropriate; API adapter tests use controlled HTTP responses. They do not prove a live browser-to-PostgreSQL workflow.

HttpClient is registered. Development and production default to API mode with `/api`; the Angular dev proxy forwards `/api/**` to `http://127.0.0.1:8000`. Production hosting needs an explicit `/api/` reverse proxy and frontend route fallback; `npm run build` does not deploy that infrastructure.

API mode loads dashboard/resource/analytics endpoints and uses server-calculated monetary totals. Errors are surfaced for authentication, authorization, validation, network and server failures. Mutations wait for a server response and refresh data; uncertain outcomes warn against resubmission. Stock is not incremented in the frontend. Demo is lazy-loaded only after explicit selection, labelled throughout, and never used as a fallback after API errors. Tokens stay in memory and are never bundled in environments or persisted to local storage.

Static review found responsive breakpoints, mobile navigation, horizontal table containers, accessible labels, keyboard-focus styles, dialog focus restoration and loading/empty/error components. Actual mobile/tablet/desktop rendering and assistive-technology behavior remain unverified without a browser. Manually test 390px, 768px and 1440px widths, all routes, keyboard-only navigation, dialogs, invalid forms, disconnected/error states and explicit demo labelling before a visual sign-off.

## 5. Backend, database integrity and permissions

Canonical routes: `/api/health/`, `/api/access/`, `/api/dashboard/`, supplier/product CRUD, order GET/POST/PATCH, approve/deliver/cancel actions, `/api/analytics/supplier-spending/`, `/api/analytics/order-status/`. `/api/v1/` aliases the same business routes. Health is public process liveness and explicitly does not claim database readiness. All business endpoints require authenticated access.

Shared bearer credentials in environment variables enforce Viewer, Buyer, Approver and Admin capabilities on the server. Frontend visibility does not authorize requests. Missing/invalid credentials return 401, insufficient roles 403. There are no public writes or credentials sent to Angular. These are shared role credentials, not named-user accounts, JWT issuance, token expiry or individual audit accountability.

Cookie/session authentication is not enabled. Explicit bearer headers avoid ambient cookie credentials; CORS restricts Angular origins, permits Authorization preflight and does not allow credentialed cookies. HTTPS and secret provisioning remain deployment responsibilities. DEBUG defaults false and a private secret is required outside explicitly enabled local development. HSTS include-subdomains/preload remain opt-in pending domain ownership review; do not blindly enable them to hide warnings.

Reviewed all four unmanaged business models against the preserved dump: explicit identity PK mappings, FK columns, unique email and order/product pair, required/null columns, allowed statuses, nonnegative price/stock checks, positive item quantities and delivery-date check. Schema bootstrap/inspectdb assertions run only in the isolated test environment. The API additionally validates nonblank names, email syntax/case-insensitive duplicates, optional-address types/length/whitespace, Decimal price bounds, dates and references. PostgreSQL remains the final authority for its existing constraints. Input violations return safe 400 messages; protected deletion/status conflicts return 409; database outages are sanitized 503 responses.

Order creation is atomic and validates items/references before committing. The single delivery service locks the order and affected products, validates Approved status, uses F() stock increments and commits status with stock. Tests verify rollback, zero/negative quantities, FK errors, duplicate products, repeat delivery, simultaneous delivery, overlapping product receipts and cancellation races. Historical captured item prices and Decimal totals are tested. Existing Delivered orders are never replayed.

The 78-test run used a new random-port loopback PostgreSQL 17 cluster and `test_jedel_api`, guarded by explicit isolation checks. Test schema and temporary auth/contenttypes migrations were applied only there, followed by teardown. No migrations, stock updates or destructive tests ran against `jedel_group_db`.

Earlier authenticated live read-only inspection is documented in [Amir's report](amir-data-validation-and-stock-updates.md): 3 suppliers, 5 products, 3 orders, 6 items; 16 NOT NULL columns, four identities, 15 constraints and no non-internal business-table triggers. That is historical evidence, not fresh verification in this audit. Current live connectivity, schema drift, grants and live writes are not verified because credentials were unavailable. Configure secrets securely and run `manage.py inspect_data_quality` before live sign-off; never use live deliveries as disposable tests.

## 6. Security scan and .gitignore

All existing tracked and nonignored untracked publication candidates were scanned for private-key headers, common provider tokens, JWTs, credential-bearing URLs and literal password/secret/access-token assignments. All reachable commits/refs were traversed; three distinct historical blobs were scanned. Staged diff was empty. No actual credential matches were found. Candidate matches were synthetic `override_settings` credentials and rejection-test URLs in test modules. Their values are intentionally not reproduced here. No existing history rewrite or credential rotation was indicated by this scan.

This is a bounded heuristic scan plus source review, not a guarantee that arbitrary encoded/unknown-format secrets cannot exist. No dedicated Python vulnerability advisory scan or independent secret-scanner service was run. `pip check` checks dependency compatibility, not published vulnerabilities. Ignored local runtime files/venvs are excluded from publication and were not treated as releasable source.

Ignore verification covers `.env`/environment variants (while retaining secret-free `.env.example`), Python virtual environments/bytecode, node_modules, Angular cache/build output, coverage, pytest cache, IDE settings, logs/runtime files, private keys, pgpass, temporary editor files and local backup formats. Canonical `database/dumps/jedel_group_db.sql` remains included. Plain SQL exports should be kept under ignored `database/backups/`; an arbitrary new `.sql` file elsewhere still needs review. Ignore rules do not remove files already in Git history. No tracked ignored paths were found.

The retained team SQL dump contains supplier contact records. They already exist in Git history, but that does not establish consent or prove they are fictional. Confirm they are approved educational records before publication. If real sensitive data or a secret is later discovered, stop publication, restrict exposure, rotate affected credentials, prepare a sanitized replacement, and coordinate any history cleanup with all collaborators. Do not rewrite shared history automatically.

### Dependency warning

`npm audit` reported 16 moderate affected entries in the Angular CLI development chain, propagated from glob/minimatch advisories. These are affected package entries, not 16 independent root vulnerabilities. Production-only audit reported zero. npm proposed a major downgrade of CLI to 16.2.16; no `npm audit fix --force` or downgrade was applied because that is incompatible with this Angular 21 foundation. Review upstream fixes/compatible dependency changes in a separate tested dependency PR. Avoid untrusted tooling input and keep development servers local. Zero production audit findings is a point-in-time advisory result, not blanket security assurance.

## 7. Safe fixes performed during this audit

- Extended root `.gitignore` for local backups, private keys/pgpass and scratch/editor files; verified representative paths remain ignored and the reviewed dump/example remain included.
- Repaired corrupted table descriptions in root README while preserving their meaning and team credits; clarified prerequisites, environment loading, navigation and audit link.
- Updated `database/SCHEMA_REVIEW.md` to distinguish the previous successful live read-only inspection from this audit's unavailable credentials.
- Added this verification report and full publication-candidate inventory. No application-code compilation failures required changes, and no dependency/schema/data changes were made.

## 8. Unresolved issues and publication decision

Safe for a reviewed development commit: **yes, after confirming SQL contact-data approval and inspecting the staged inventory**. Tests/build pass and no credentials were detected. Safe to push directly to shared `main`: **not recommended**; use a feature branch and PR. Branch protections/CI/write permissions are unknown.

Warnings: moderate development dependency advisories; no fresh live PostgreSQL query; no real-browser visual/end-to-end verification; production HSTS ownership decisions; no individual user authentication/audit ledger; case-insensitive email uniqueness remains API-enforced over an unchanged case-sensitive DB UNIQUE; no server-side paging strategy for very large frontend datasets; no order-create idempotency key; no live grant verification. A clean build is not production readiness.

## 9. Commands to reproduce and publish

Build/test from repository root using existing dependencies:

```powershell
cd D:\BIS_project\jedel-group-database
npm --prefix frontend run build
npm --prefix frontend test -- --watch=false
$env:DJANGO_DEBUG = 'true'
& backend/.venv/Scripts/python.exe backend/manage.py check
& backend/.venv/Scripts/python.exe -m pip check
& backend/.venv/Scripts/python.exe backend/scripts/test_postgres.py
git diff --check
```

Fresh clone setup/start is documented in [root README](../README.md), [frontend README](../frontend/README.md), [backend README/API reference](../backend/README.md), [database policy](../database/README.md) and [secure launcher instructions](CONNECTION_SETUP.md). Use `npm ci` and a local Python venv only when dependencies need installing. Never restore the dump or run business migrations over the existing database. Environment examples intentionally have no secrets and are not automatically loaded.

The following Git commands are recommendations only; **they were not executed**. First confirm data approval and review the report/inventory. If a fresh fetch reports divergence, stop and coordinate incorporation of team work rather than resetting or automatically merging/rebasing.

```powershell
cd D:\BIS_project\jedel-group-database
git fetch origin
git status --short
git rev-list --left-right --count main...origin/main
# Proceed when the shared base is still current and the reviewed files are approved:
git switch -c chore/erp-pre-push-review
git add -A -- .gitignore README.md backend frontend database docs jedel_group_db.sql
git diff --cached --check
git diff --cached --stat
git diff --cached --name-status --find-renames
# Inspect the staged content locally for unexpected files/secrets before committing:
git diff --cached
git commit -m "Add ERP frontend, authenticated purchasing API and isolated tests"
git push -u origin chore/erp-pre-push-review
```

Open a GitHub pull request from `chore/erp-pre-push-review` into `main`, include verification results and warnings, and request team review. Do not force-push or automatically merge. Re-run relevant checks if code or lockfiles change after this audit.

## Appendix — all publication-candidate files

This inventory includes existing modified files and every nonignored new file, including this report. The tracked old root `jedel_group_db.sql` is separately recorded as deleted/relocated above. Staged paths: none. Generated/ignored local files are excluded.

119 existing files:

```text
.gitignore
README.md
backend/.env.example
backend/README.md
backend/apps/__init__.py
backend/apps/purchasing/__init__.py
backend/apps/purchasing/api/__init__.py
backend/apps/purchasing/api/authentication.py
backend/apps/purchasing/api/exceptions.py
backend/apps/purchasing/api/fields.py
backend/apps/purchasing/api/middleware.py
backend/apps/purchasing/api/parsers.py
backend/apps/purchasing/api/permissions.py
backend/apps/purchasing/api/reports.py
backend/apps/purchasing/api/serializers.py
backend/apps/purchasing/api/urls.py
backend/apps/purchasing/api/views.py
backend/apps/purchasing/apps.py
backend/apps/purchasing/management/__init__.py
backend/apps/purchasing/management/commands/__init__.py
backend/apps/purchasing/management/commands/inspect_data_quality.py
backend/apps/purchasing/management/commands/runserver.py
backend/apps/purchasing/management/commands/verify_connection.py
backend/apps/purchasing/models.py
backend/apps/purchasing/postgres_diagnostics.py
backend/apps/purchasing/services.py
backend/apps/purchasing/test_amir_assignment.py
backend/apps/purchasing/test_connection_diagnostics.py
backend/apps/purchasing/test_security.py
backend/apps/purchasing/tests.py
backend/config/__init__.py
backend/config/asgi.py
backend/config/settings.py
backend/config/test_runner.py
backend/config/urls.py
backend/config/wsgi.py
backend/manage.py
backend/requirements.txt
backend/scripts/check_authentication.py
backend/scripts/start-development.ps1
backend/scripts/test_postgres.py
database/MIGRATION_PLAN.md
database/README.md
database/SCHEMA_REVIEW.md
database/dumps/jedel_group_db.sql
docs/CONNECTION_SETUP.md
docs/POSTGRES_CONNECTION_FIX.md
docs/PRE_PUSH_VERIFICATION.md
docs/QA_REPORT.md
docs/amir-data-validation-and-stock-updates.md
frontend/.editorconfig
frontend/.gitignore
frontend/.prettierrc
frontend/README.md
frontend/angular.json
frontend/package-lock.json
frontend/package.json
frontend/proxy.conf.json
frontend/public/favicon.ico
frontend/src/app/app.config.server.ts
frontend/src/app/app.config.ts
frontend/src/app/app.html
frontend/src/app/app.routes.server.ts
frontend/src/app/app.routes.spec.ts
frontend/src/app/app.routes.ts
frontend/src/app/app.scss
frontend/src/app/app.spec.ts
frontend/src/app/app.ts
frontend/src/app/core/data/api-contracts.ts
frontend/src/app/core/data/api-data.service.spec.ts
frontend/src/app/core/data/api-data.service.ts
frontend/src/app/core/data/api-errors.ts
frontend/src/app/core/data/demo-data.service.spec.ts
frontend/src/app/core/data/demo-data.service.ts
frontend/src/app/core/data/demo-seed.ts
frontend/src/app/core/data/metrics.spec.ts
frontend/src/app/core/data/metrics.ts
frontend/src/app/core/data/models.ts
frontend/src/app/core/data/notifications.service.ts
frontend/src/app/core/data/workspace-data.service.ts
frontend/src/app/core/layout/_shell-chrome.scss
frontend/src/app/core/layout/app-shell.html
frontend/src/app/core/layout/app-shell.scss
frontend/src/app/core/layout/app-shell.ts
frontend/src/app/features/analytics/analytics.page.html
frontend/src/app/features/analytics/analytics.page.ts
frontend/src/app/features/dashboard/dashboard.page.html
frontend/src/app/features/dashboard/dashboard.page.ts
frontend/src/app/features/products/products.page.html
frontend/src/app/features/products/products.page.ts
frontend/src/app/features/purchase-orders/purchase-orders.page.html
frontend/src/app/features/purchase-orders/purchase-orders.page.ts
frontend/src/app/features/settings/settings.page.html
frontend/src/app/features/settings/settings.page.ts
frontend/src/app/features/suppliers/suppliers.page.html
frontend/src/app/features/suppliers/suppliers.page.ts
frontend/src/app/shared/components/page-intro.ts
frontend/src/app/shared/pipes/kzt.pipe.ts
frontend/src/app/shared/ui/confirm-dialog.ts
frontend/src/app/shared/ui/data-state.spec.ts
frontend/src/app/shared/ui/data-state.ts
frontend/src/app/shared/ui/field-accessibility.ts
frontend/src/app/shared/ui/field-error.ts
frontend/src/app/shared/ui/icon.ts
frontend/src/app/shared/ui/modal.ts
frontend/src/app/shared/ui/pagination.ts
frontend/src/app/shared/ui/spending-chart.ts
frontend/src/app/shared/ui/status-badge.ts
frontend/src/app/shared/ui/status-chart.ts
frontend/src/environments/environment.development.ts
frontend/src/environments/environment.ts
frontend/src/index.html
frontend/src/main.server.ts
frontend/src/main.ts
frontend/src/server.ts
frontend/src/styles.scss
frontend/tsconfig.app.json
frontend/tsconfig.json
frontend/tsconfig.spec.json
```
