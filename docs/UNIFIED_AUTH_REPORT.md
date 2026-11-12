> Historical pending-registration report. See [the current automatic registration report](AUTO_REGISTRATION_REPORT.md) for active Basic User registration, auto-login and the now-initialized existing database.

# Unified authentication and PostgreSQL readiness report

Date: 2026-11-12. Branch: feature/fullstack-integration-auth. Prior uncommitted integration work was preserved. No commit, push, merge, repository reset or migration of the existing database was performed.

## Readiness

**BLOCKED BY DATABASE APPROVAL** for real registration/login/Admin against jedel_group_db. Code/UI and isolated PostgreSQL workflows pass. A real infrastructure blocker remains; the UI does not fake success or fall back to mock authentication.

## A. Exact 503 root cause

The configured database was rechecked read-only and confirmed to be jedel_group_db. DB_USER, DB_PASSWORD, DB_HOST, DB_PORT and DB_NAME were configured; values and credentials were not displayed. PostgreSQL connections succeeded, and the configured role has CONNECT on the database and USAGE/CREATE on public. No permission/ownership failure was identified as the cause.

AUTH_USER_MODEL remains auth.User. Sessions use django.contrib.sessions.backends.db, and the session cookie is HttpOnly. The old backend was ModelBackend (username only); the new tested backend supports email and legacy usernames without a user-model/schema replacement. Existing authentication/session middleware and CSRF protections remain enabled.

Catalog inspection found no auth_*/django_* tables, including no auth_user, auth_group, django_session or django_migrations. showmigrations reports all 18 built-in migrations unapplied. migrate --plan reports only admin, auth, contenttypes and sessions.

Real diagnostic requests used enforced CSRF and a PostgreSQL read-only session. /me/ returned 401 (normal anonymous state), /csrf/ returned 200, and registration/login both returned 503 with code authentication_setup_required. That code is emitted by api/exceptions.py specifically when an account endpoint raises a Django DatabaseError whose PostgreSQL cause is 42P01 (undefined table). Registration reaches its auth_user duplicate lookup, and login reaches its account lookup; neither can persist/authenticate against absent tables. CSRF success does not query or establish account-table readiness.

The initial 503s therefore come from missing schema, not invalid frontend payloads, incorrect cookies, CORS, or wrong database passwords. The final read-only recheck still finds the tables absent: live registration/login are NOT claimed fixed.

## B. Migration impact and approval

All pending operations are the existing built-in migrations: contenttypes 0001/0002; auth 0001 through 0012; admin 0001 through 0003; sessions 0001. No fake migrations, history edits, destructive resets or SQLite substitutes were used.

New tables:

1. django_migrations
2. django_content_type
3. auth_permission
4. auth_group
5. auth_group_permissions
6. auth_user
7. auth_user_groups
8. auth_user_user_permissions
9. django_session
10. django_admin_log

Their auth/session/admin columns, PK/FK/unique/index constraints and permission/content-type rows are additive. setup_roles configures five application group rows and trusted administration permissions. No custom managed user model or business-table migration is introduced.

The four business tables remain unmanaged and unchanged: suppliers, products, purchase_orders, purchase_order_items. Source comparisons confirmed original mappings, stock services, source dump and PostgreSQL role/GRANT scripts unchanged. Existing stock, statuses and historical prices were not modified by diagnostics.

Review [the exact pending plan](AUTH_PENDING_MIGRATIONS.txt), [collected SQL including migration-recorder DDL](AUTH_PENDING_MIGRATIONS.sql), [table/column and rollback procedure](MIGRATION_APPROVAL.md), and [restored private-backup rehearsal](AUTH_MIGRATION_REHEARSAL.md). The earlier private read-only pg_dump backup was successfully restored/migrated in a marked disposable cluster with matching business data/schema fingerprints. This run also verifies fresh PostgreSQL initialization, the built-in migrations, role setup and repeated initialization preserving a sentinel supplier. Original owner/ACL deployment review remains separate because the rehearsal restore used --no-owner --no-acl.

Before an approved live change, refresh and verify a private full custom-format pg_dump backup if data changed since the rehearsal, confirm its restore, coordinate writers, verify the pending plan is still exactly these 18 migrations and use the intended configured role. Do not share passwords or commit backups. Reversing auth migrations destroys users/roles/sessions; prefer retaining additive tables when reverting code. A full backup restore may lose newer writes, so rollback must be coordinated.

**Precise command requiring explicit approval, from backend with the reviewed jedel_group_db target:**

```powershell
python manage.py migrate --noinput
```

This command was NOT executed on the existing database. After approved migration, `python manage.py setup_roles` provisions application groups, and interactive `python manage.py createsuperuser` bootstraps the first local administrator. No defaults/passwords are hardcoded.

## C. Backend changes

- EmailOrUsernameBackend performs case-insensitive email or exact legacy username lookup and Django password verification. Ambiguous duplicate legacy emails or email/username collisions fail closed; an administrator must resolve them. This prevents choosing another person's account arbitrarily.
- LoginSerializer accepts exactly one of identifier (preferred), username or email, plus password. Conflicting identifiers/non-object/invalid payloads are rejected safely.
- Tests prove email login where username differs from email, case-insensitive email lookup, old username login, ambiguity rejection, pending/disabled denial, session persistence and logout.
- Registration validates name/email/password/confirmation, hashes passwords and persists inactive users transactionally. Password/username validation errors are field-specific. Success explicitly states pending administrator approval; no role/staff/superuser is granted.
- Admin's registration-review filter surfaces inactive nonstaff accounts. Approval requires a known application group. Reject/suspend disables without deleting users or granting privileges. Existing trusted group/user administration remains available; pending/rejected/inactive are not falsely presented as distinct database statuses.
- Supplier/product validated administration and stock/order-transition protections are preserved. The custom runserver now inherits Django's staticfiles runserver so native Admin CSS/JavaScript work with the normal startup command.

## D. Unified Angular UI

Canonical routes are /auth?mode=login and /auth?mode=register, sharing one centered responsive AuthPage. /login and /register redirect safely and preserve local returnTo values. Mode switching retains valid email/name/input; requests are locked while submitting. The screen includes a visible active mode, semantic buttons/labels, password visibility, field-specific errors, concise infrastructure errors, loading state and Back to Home.

Login says "Email address or username" to reflect the verified compatibility behavior. Navigation and buttons consistently say Log in/Register. Registration shows exactly "Registration submitted. Your account is awaiting administrator approval." only after a confirmed 201. Successful registration clears password fields while retaining name/email; failures retain valid typed input and never show fake success.

Public Home and safe section previews remain anonymous. No supplier contacts, stock, internal order prices/details or confidential analytics are publicly disclosed. Protected actions route to the Log in mode with a local return destination; insufficient signed-in roles see Access Denied. APIs independently enforce roles. Initial anonymous /me/ does not redirect Home. No bearer entry, localStorage password/session credential, wildcard CORS, disabled CSRF or JWT infrastructure was added.

All API requests remain under relative /api through Angular's proxy to 127.0.0.1:8000. Cookie/CSRF behavior was verified in real Chromium. Do not mix browser hostnames within one session: use localhost:4200 consistently for Angular.

## E. Actual verification

| Check | Result |
|---|---|
| Full Django 6.0.3/PostgreSQL suite | 107 passed, 0 failed, 0 skipped; 105.481 seconds |
| Real Chromium scenarios within the backend wrapper | 3 passed in 22.5 seconds |
| Additional native startup/configuration suite after staticfiles fix | 4 passed, 0 failed, 0 skipped |
| Repository Django 6.0.10 focused account/admin suite | 25 passed, 0 failed, 0 skipped |
| Angular Vitest | 61 passed, 0 failed, 0 skipped; eight files |
| Angular production build | Passed; 385.90 kB initial, estimated transfer 99.66 kB |
| Fresh isolated PostgreSQL initialization/migrations | Passed |
| Repeated isolated initialization and five groups | Passed; sentinel retained |
| Native default-python startup/.env/Admin CSS | Passed; root and /static/admin/css/base.css return 200 without Angular |
| Live original-database Admin readiness | Expected 503 while schema approval is pending |
| git diff --check | Passed |
| macOS/Docker runtime execution | NOT VERIFIED in this Windows session |

The three browser scenarios are: registration ? Admin role assignment/approval ? login ? refresh ? logout; unified modes/bookmarks/validation/password visibility and no overflow at 1280/390/320px; public browsing ? protected-action login return ? catalog/order amendment/approval/delivery ? stock/report refresh ? forbidden viewer action. PostgreSQL persistence/hash/role/stock assertions run in the wrapper. Browser scenarios are included through one wrapper in the 107 backend count; do not add them again. The four focused startup tests overlap three tests from the full run and are reported separately, not summed as unique tests.

A first full run failed Windows temp-directory cleanup due to Angular/esbuild inheriting the log handle; the harness now terminates only its own created process tree before cleanup. An initial new Angular bookmark test created multiple harnesses and was corrected to reuse one. No test was disabled. Final results above are from passing runs.

Default `python` on this machine uses Django 6.0.3. The existing project .venv and unchanged requirements pin use Django 6.0.10; focused tests cover it separately. No dependency versions were changed or silently downgraded. Admin UI static assets were smoke-tested with the actual default 6.0.3 startup.

Ignored evidence: backend/.runtime/unified-auth-full-603.log, backend/.runtime/unified-auth-venv-6010.log, backend/.runtime/unified-auth-startup-smoke.log. Desktop/mobile screenshots are under frontend/test-results/unified-auth-unified-modes-3b72c-ation-and-responsive-layout/. Screenshots were visually inspected. Browser traces/logs/backups stay out of Git.

## F. Commands

Windows backend (from backend):

```powershell
python manage.py runserver
```

Windows frontend (from frontend, second terminal):

```powershell
npm.cmd start
```

Fresh isolated native development only, after creating an empty jedel_dev database and configuring DB_NAME=jedel_dev / JEDEL_ISOLATED_DEVELOPMENT=1 privately in backend/.env:

```powershell
python manage.py init_development
python manage.py createsuperuser
python manage.py runserver
```

Never point fresh initialization at jedel_group_db. Existing-database migrate is approval-gated as described above. Teammates register in /auth?mode=register, then a trusted administrator assigns a role and approves them in /admin/. The first administrator is created only by the explicit local operator command after provisioning. Use Admin's role assignment and review actions to activate/disable users; do not give ordinary applicants Staff/Superuser.

Tests from backend: `$env:JEDEL_BROWSER_TESTS='1'; $env:JEDEL_VERIFY_DEVELOPMENT='1'; python scripts/test_postgres.py`. From frontend: `npm.cmd test -- --watch=false`, `npm.cmd run build`. Playwright Chromium must already be installed. macOS startup remains `.venv/bin/python manage.py runserver` and `npm start` after setup; macOS execution is not claimed.

## G. Remaining blocker

Only approval can authorize adding Django account/session/admin tables to the current existing database. Until then the live account service remains blocked and real 503 infrastructure messages remain appropriate. The code must not mask this with mocks, fake migrations or automatic startup DDL. Fresh isolated environments are verified. Distributed production throttling, external deployment and macOS/Docker runtime remain separate environment/deployment checks.

## H. Files changed for this task

- [README.md](../README.md)
- [backend/README.md](../backend/README.md)
- [backend/apps/purchasing/account_backend.py](../backend/apps/purchasing/account_backend.py)
- [backend/apps/purchasing/account_serializers.py](../backend/apps/purchasing/account_serializers.py)
- [backend/apps/purchasing/admin.py](../backend/apps/purchasing/admin.py)
- [backend/apps/purchasing/auth_views.py](../backend/apps/purchasing/auth_views.py)
- [backend/apps/purchasing/management/commands/runserver.py](../backend/apps/purchasing/management/commands/runserver.py)
- [backend/apps/purchasing/schema.py](../backend/apps/purchasing/schema.py)
- [backend/apps/purchasing/test_accounts.py](../backend/apps/purchasing/test_accounts.py)
- [backend/apps/purchasing/test_browser.py](../backend/apps/purchasing/test_browser.py)
- [backend/config/settings.py](../backend/config/settings.py)
- [backend/config/test_local_environment.py](../backend/config/test_local_environment.py)
- [docs/API.md](../docs/API.md)
- [docs/AUTHENTICATION.md](../docs/AUTHENTICATION.md)
- [docs/AUTH_PUBLIC_ADMIN_FIX.md](../docs/AUTH_PUBLIC_ADMIN_FIX.md)
- [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)
- [docs/UNIFIED_AUTH_REPORT.md](../docs/UNIFIED_AUTH_REPORT.md)
- [frontend/README.md](../frontend/README.md)
- [frontend/e2e/account-flow.spec.ts](../frontend/e2e/account-flow.spec.ts)
- [frontend/e2e/unified-auth.spec.ts](../frontend/e2e/unified-auth.spec.ts)
- [frontend/e2e/workflow.spec.ts](../frontend/e2e/workflow.spec.ts)
- [frontend/src/app/app.ts](../frontend/src/app/app.ts)
- [frontend/src/app/auth.spec.ts](../frontend/src/app/auth.spec.ts)
- [frontend/src/app/auth.ts](../frontend/src/app/auth.ts)
- [frontend/src/app/core/data/api-data.service.ts](../frontend/src/app/core/data/api-data.service.ts)
- [frontend/src/app/core/data/api-errors.ts](../frontend/src/app/core/data/api-errors.ts)
- [frontend/src/app/pages/auth-page.html](../frontend/src/app/pages/auth-page.html)
- [frontend/src/app/pages/auth-page.scss](../frontend/src/app/pages/auth-page.scss)
- [frontend/src/app/pages/auth-page.spec.ts](../frontend/src/app/pages/auth-page.spec.ts)
- [frontend/src/app/pages/auth-page.ts](../frontend/src/app/pages/auth-page.ts)
- [frontend/src/app/pages/login.ts](../frontend/src/app/pages/login.ts)
- [frontend/src/app/pages/pages.spec.ts](../frontend/src/app/pages/pages.spec.ts)
- [frontend/src/app/pages/public-workspace.ts](../frontend/src/app/pages/public-workspace.ts)
- [frontend/src/app/pages/register.ts](../frontend/src/app/pages/register.ts)
- [frontend/src/app/routes.ts](../frontend/src/app/routes.ts)
