# Final source-publication verification ? 13 November 2026

This is source publication verification, not production deployment or proof of live Groq connectivity.

## Baseline and attribution

Integration branch: feature/fullstack-integration-auth; tested integration baseline fd50863.
Latest origin/main at audit: d290bd6. No unresolved merge/rebase; latest remote main is an ancestor of the integration branch. Earlier Aslan frontend, Amir backend/integration, Bekarys business documentation and Yerbolat role/testing commits are preserved through normal ancestry. No separate Kamshat-authored commit was identified in the reviewed history; no authorship is invented or changed. The older unmerged docs/business-concept branch is not silently merged as a customer-sales feature.

## Mandatory checks performed

| Gate | Result |
| --- | --- |
| Full Django/PostgreSQL suite | 166 discovered: 165 passed, 0 failed, 1 opt-in browser skipped; 53.978s |
| Separate full Chromium suite | 10 passed, 0 failed, 0 skipped; 40.5s |
| Django browser wrapper | 1 passed, 0 failed, 0 skipped |
| Angular full suite | 104 passed, 0 failed, 0 skipped; 13 files |
| TypeScript noEmit | Passed |
| Production Angular build | Passed; initial bundle 462.68 kB |
| Django system/readiness checks | Passed |
| Live schema/data preservation | 14 public-table row counts and deterministic UTC hashes unchanged; constraints/indexes/sequences/grants unchanged |
| Six live role permission sets | Exact match with approved intended_permissions; no role writes |
| History secret scan | 333 historical blobs checked; no recognizable provider/private-key patterns or known long local-secret matches |
| Current source/template guard | Passed; private env ignored and untracked |
| Whitespace/diff checks | Passed before commit |

All write tests ran on isolated disposable PostgreSQL clusters. Live business counts remained suppliers=3, products=5, purchase_orders=5, purchase_order_items=8. Live authentication tables, user memberships, password hashes, session data and managed migration history are included in preservation comparisons; no values are exported to this report. No live migration, role assignment, account change, receipt replay or stock write was performed.

The fingerprint comparison explicitly sets UTC and uses stable row ordering and canonical field ordering. Private comparison digests remain ignored under backend/.runtime, not in Git. The public report contains only pass/fail and safe aggregate business counts.

Browser scenarios cover public sections, registration/session restoration, all six roles plus anonymous, protected data isolation, catalog/order persistence, Pending amendment, delivery, inventory, local Copilot quotation/draft tools and backend-unavailable behavior. The visual scenario verifies separate KPI values/labels/units and responsive Home/Analytics grid columns at 1440, 1280, 768, 390 and 375px; values come from isolated PostgreSQL fixtures, not hardcoded screenshot numbers.

## Configuration and README

README has explicit first-time/everyday commands for Windows and macOS, optional one-command native launch, Docker setup, account/admin bootstrap, persistence and troubleshooting. Its Groq example is a placeholder only. Actual keys belong in ignored backend/.env (native) or root .env (Docker), never README/GitHub. A key exposed in chat should be rotated privately; it was not copied into source.

Groq is the sole cloud endpoint (https://api.groq.com/openai/v1/responses), using the reviewed openai/gpt-oss-20b model and compatible Python SDK. No OpenAI API key/fallback exists. Local tools operate without cloud configuration. Current local provider configuration/SDK diagnostics pass, but no live Groq inference was authorized or performed. Provider timeouts, limits, English/Russian replies and authorization are tested with mocks; private tool results stay in Django.

## Disclosed environment/security limitations

- Native Windows, clean-dependency source snapshot, real isolated PostgreSQL restart/session restoration and foreground launcher were verified in the preceding portability checks; see PORTABILITY_REPORT.md.
- Native macOS Intel/Apple Silicon and actual Docker config/build/container startup are NOT VERIFIED here: no Mac or Docker engine is available. The user explicitly permits preserving/publishing otherwise verified source with these limitations, provided the Quick Start is not demonstrably broken. No known Docker Quick Start defect was found by source review.
- GitHub Actions matrix/Compose smoke workflows are provided but were not executed before this publication. Hosted Windows PostgreSQL tool availability may require runner maintenance.
- npm audit previously reported 16 moderate Angular CLI/transitive tooling advisories, zero high/critical. Its proposed major downgrade was not applied. The CI audit gate rejects high/critical findings. No production-readiness or complete security-audit claim is made.
- Existing dated audit documents describe historical stages. This report and the current README supersede their old pending-approval/unpublished-state descriptions.

No secrets, private environment files, dependency directories, build outputs, runtime traces, source snapshots or database backups are intended for the commit. The authoritative team SQL dump already exists upstream; it is not reimported, rewritten or replaced. Only schema DDL is used for new isolated initialization.

Push success and final commit hashes are verified separately by Git after committing; this document records the pre-publication gates and does not pre-claim a successful push.

## Full source delta from origin/main (including preserved local integration commits)

- .dockerignore
- .env.example
- .gitattributes
- .github/workflows/verify.yml
- .gitignore
- .nvmrc
- README.md
- backend/.env.example
- backend/Dockerfile
- backend/README.md
- backend/apps/purchasing/account_backend.py
- backend/apps/purchasing/account_serializers.py
- backend/apps/purchasing/accounts.py
- backend/apps/purchasing/admin.py
- backend/apps/purchasing/admin_availability.py
- backend/apps/purchasing/api/authentication.py
- backend/apps/purchasing/api/catalog.py
- backend/apps/purchasing/api/exceptions.py
- backend/apps/purchasing/api/permissions.py
- backend/apps/purchasing/api/serializers.py
- backend/apps/purchasing/api/urls.py
- backend/apps/purchasing/api/views.py
- backend/apps/purchasing/auth_views.py
- backend/apps/purchasing/copilot/__init__.py
- backend/apps/purchasing/copilot/offers.py
- backend/apps/purchasing/copilot/orchestration.py
- backend/apps/purchasing/copilot/provider.py
- backend/apps/purchasing/copilot/tools.py
- backend/apps/purchasing/copilot/validation.py
- backend/apps/purchasing/copilot/views.py
- backend/apps/purchasing/management/commands/check_environment.py
- backend/apps/purchasing/management/commands/copilot_sample_csv.py
- backend/apps/purchasing/management/commands/copilot_smoke.py
- backend/apps/purchasing/management/commands/copilot_status.py
- backend/apps/purchasing/management/commands/init_development.py
- backend/apps/purchasing/management/commands/runserver.py
- backend/apps/purchasing/management/commands/seed_demo.py
- backend/apps/purchasing/management/commands/setup_roles.py
- backend/apps/purchasing/schema.py
- backend/apps/purchasing/security_views.py
- backend/apps/purchasing/templates/purchasing/backend_home.html
- backend/apps/purchasing/test_accounts.py
- backend/apps/purchasing/test_admin_workflows.py
- backend/apps/purchasing/test_amir_assignment.py
- backend/apps/purchasing/test_browser.py
- backend/apps/purchasing/test_copilot.py
- backend/apps/purchasing/test_copilot_setup.py
- backend/apps/purchasing/test_portability.py
- backend/apps/purchasing/test_public_catalog.py
- backend/apps/purchasing/test_rbac.py
- backend/apps/purchasing/test_section_access.py
- backend/apps/purchasing/test_security.py
- backend/apps/purchasing/tests.py
- backend/config/local_environment.py
- backend/config/settings.py
- backend/config/test_local_environment.py
- backend/config/urls.py
- backend/constraints.txt
- backend/requirements.txt
- backend/scripts/rehearse_auth_migrations.py
- backend/scripts/start-development.ps1
- backend/scripts/start-development.sh
- backend/scripts/test_postgres.py
- backend/scripts/verify_development.py
- compose.yaml
- database/README.md
- docs/AI_COPILOT.md
- docs/AI_COPILOT_TESTABILITY_RESULTS.md
- docs/AI_COPILOT_TESTING.md
- docs/AI_COPILOT_VERIFICATION.md
- docs/ALL_SECTIONS_AUDIT.md
- docs/ALL_SECTIONS_REPORT.md
- docs/API.md
- docs/AUTHENTICATION.md
- docs/AUTH_MIGRATION_REHEARSAL.md
- docs/AUTH_PENDING_MIGRATIONS.sql
- docs/AUTH_PENDING_MIGRATIONS.txt
- docs/AUTH_PUBLIC_ADMIN_FIX.md
- docs/AUTO_REGISTRATION_REPORT.md
- docs/BACKUP_FINGERPRINT_INVESTIGATION.md
- docs/CATALOG_ACCESS_REPORT.md
- docs/DEVELOPMENT.md
- docs/FINAL_PUBLICATION_VERIFICATION.md
- docs/FULLSTACK_AUDIT.md
- docs/GROQ_CONVERSION_RESULTS.md
- docs/INTEGRATION_COMMIT_CANDIDATES.txt
- docs/LIVE_RBAC_PROVISIONING.md
- docs/MACOS_SETUP.md
- docs/MIGRATION_APPROVAL.md
- docs/PORTABILITY_REPORT.md
- docs/RBAC_REPORT.md
- docs/TEAM_FRONTEND_INTEGRATION_AUDIT.md
- docs/TEAM_FRONTEND_INTEGRATION_REPORT.md
- docs/UI_VISUAL_REGRESSION.md
- docs/UNIFIED_AUTH_REPORT.md
- docs/VERIFICATION.md
- docs/WINDOWS_SETUP.md
- docs/examples/copilot-fictional-quotes.csv
- frontend/Dockerfile
- frontend/README.md
- frontend/e2e/account-flow.spec.ts
- frontend/e2e/all-sections.spec.ts
- frontend/e2e/copilot.spec.ts
- frontend/e2e/theme-integration.spec.ts
- frontend/e2e/unified-auth.spec.ts
- frontend/e2e/visual-regression.spec.ts
- frontend/e2e/workflow.spec.ts
- frontend/package-lock.json
- frontend/package.json
- frontend/playwright.config.ts
- frontend/proxy.docker.json
- frontend/src/app/account-navigation.spec.ts
- frontend/src/app/all-sections.spec.ts
- frontend/src/app/app.ts
- frontend/src/app/auth.spec.ts
- frontend/src/app/auth.ts
- frontend/src/app/components/stat-card.scss
- frontend/src/app/components/stat-card.spec.ts
- frontend/src/app/components/stat-card.ts
- frontend/src/app/core/data/api-data.service.spec.ts
- frontend/src/app/core/data/api-data.service.ts
- frontend/src/app/core/data/api-errors.ts
- frontend/src/app/core/data/copilot.service.ts
- frontend/src/app/core/data/public-catalog.service.ts
- frontend/src/app/core/data/workspace-data.service.ts
- frontend/src/app/pages/access-prompt.ts
- frontend/src/app/pages/analytics.scss
- frontend/src/app/pages/analytics.ts
- frontend/src/app/pages/auth-page.html
- frontend/src/app/pages/auth-page.scss
- frontend/src/app/pages/auth-page.spec.ts
- frontend/src/app/pages/auth-page.ts
- frontend/src/app/pages/connection.ts
- frontend/src/app/pages/copilot.html
- frontend/src/app/pages/copilot.scss
- frontend/src/app/pages/copilot.spec.ts
- frontend/src/app/pages/copilot.ts
- frontend/src/app/pages/home.ts
- frontend/src/app/pages/login.ts
- frontend/src/app/pages/orders.html
- frontend/src/app/pages/orders.ts
- frontend/src/app/pages/pages.spec.ts
- frontend/src/app/pages/products.ts
- frontend/src/app/pages/public-catalog.spec.ts
- frontend/src/app/pages/public-catalog.ts
- frontend/src/app/pages/public-workspace.ts
- frontend/src/app/pages/register.ts
- frontend/src/app/pages/section-preview.ts
- frontend/src/app/pages/suppliers.ts
- frontend/src/app/pages/workspace-status.ts
- frontend/src/app/public-navigation.spec.ts
- frontend/src/app/routes.ts
- frontend/src/main.ts
- frontend/src/styles.scss
- scripts/check_configuration_safety.py
- scripts/setup-docker.ps1
- scripts/setup-docker.sh
- scripts/setup-macos.sh
- scripts/setup-windows.ps1
- scripts/setup.py
- scripts/smoke_compose.py
- scripts/start-macos.sh
- scripts/start-windows.ps1
- scripts/start.py
