> Superseded authentication UI: see [the unified authentication report](UNIFIED_AUTH_REPORT.md) for the latest screen, email-login implementation and tests.

# Authentication, public Home and Django Admin follow-up

Date: 2026-11-12. Branch: feature/fullstack-integration-auth. Existing uncommitted integration work was preserved. No commit, push, merge, reset or business-table migration was performed.

## Current status

- PASS: public Home, safe anonymous navigation, protected action routes and local return-to-login behavior.
- PASS: session authentication, administrator-approved registration, strict server validation and safe setup errors in isolated PostgreSQL.
- PASS: professional backend landing, safe unavailable-admin page, validated catalog administration and service-backed order transitions.
- PASS: exact pending migration plan/SQL captured read-only; current backup restored and migrations rehearsed in a marked disposable cluster with unchanged business fingerprints.
- BLOCKED BY DATABASE APPROVAL: registration, login and Django Admin against existing jedel_group_db until additive Django tables are approved and applied.
- NOT VERIFIED: native macOS and Docker runtime execution; Windows verification does not imply those platforms were tested.

## Reproduced causes

All five backend connection settings were configured in private backend/.env. A read-only PostgreSQL query found none of the Django authentication/session/admin tables and no django_migrations table. This was a real schema gap, not a guessed credential problem.

A valid registration request was sent through Django's API test client with enforced CSRF and a PostgreSQL session configured default_transaction_read_only=on. The request returned HTTP 503 at the auth_user duplicate-account lookup; no applicant or business record was inserted. Before the fix the response was the generic database-unavailable message. It now returns code authentication_setup_required and a safe account-setup explanation, shown clearly by Angular. Registration cannot work on the existing database until the approved schema extension is applied.

The immediate Login screen had a separate routing cause: Home, Products, Suppliers, Orders and Analytics all had account/business guards, and the application hid all anonymous navigation except Login/Register. The /me/ interceptor also navigated to Login on anonymous restoration. Those were corrected without relaxing backend business permissions.

Existing frontend error strings still instructed users to reconnect with bearer credentials. These now describe sessions, role denial and CSRF expiry. The normal account flow accepts only Django sessions.

## Public and protected behavior

| Route | Anonymous behavior | Authorized behavior |
|---|---|---|
| / | Public ERP introduction; no internal counts, stock or spending | Real dashboard metrics for accounts with business read access |
| /products | Product-workflow introduction and sign-in/create action | Authorized catalog display/search/filter/CRUD |
| /suppliers | Safe supplier-workflow introduction | Private contacts and authorized catalog CRUD |
| /orders | Safe purchasing-workflow introduction | Orders, captured totals and permitted workflow actions |
| /analytics | Safe report introduction | Restricted real reports |
| /products/new, /suppliers/new, /orders/new | Login with a local returnTo URL | Required capability checked; insufficient role sees Access Denied |
| /settings | Login required | Own profile/password/logout and permitted security controls |

No business API was made public. The tests assert anonymous navigation issues no business requests and does not render even pre-cached mock/private records. Header navigation remains visible, with Login/Register for visitors and name/role/Logout for signed-in users. Reload restores /me/; initial anonymous restoration does not redirect public Home.

## Django changes

RegistrationSerializer validates strict fields, email, username, name, Django password rules and optional password_confirm. Passwords are hashed via create_user. The duplicate check remains serialized in a PostgreSQL transaction, and integrity failures cannot report success. Registrations are inactive and unprivileged until a trusted administrator assigns a group and activates them. Profile editing cannot change roles/staff flags.

Existing CSRF/session/cookie settings and proxy architecture are preserved. Anonymous registration/login explicitly enforce CSRF; cookie-authenticated unsafe requests use SessionAuthentication. No localStorage password or session secret was introduced.

The backend root now renders a professional static template with Admin/API/docs/health links and no configuration disclosure. /admin/ returns a safe 503 setup page when its required tables/database are unavailable. Readiness reports 503 for the current unmigrated database. runserver loads backend/.env and warns about approval-required migrations rather than recommending an unreviewed live migrate command. Missing connection settings are named without displaying values. The server starts independently of Angular.

## Administration and roles

Trusted staff System Administrators can manage users/groups through Django Admin. Application roles remain System Administrator, Purchasing Manager, Purchasing Employee, Security Administrator and Analyst / Tester; the detailed role matrix is in AUTHENTICATION.md. Staff is explicitly assigned by a trusted operator, never by public registration. Security Administrators retain narrowly delegated activation/suspension of assigned employees/analysts and no automatic business-data access. PostgreSQL deployment roles are separate; original GRANT scripts remain unchanged.

Supplier/product administration now has readable lists, search, pagination and category filtering. Catalog add/edit uses the same DRF serializers as the API. Product stock/IDs are read-only, and row-locked updates never save a stale stock quantity. Business deletion remains disabled in Admin. Orders/items are read-only forms with readable lists/inline items. Explicit approve/deliver/cancel actions invoke transition_order; each order and its admin-log entry are atomic. Repeated delivery cannot increment stock twice. Pending creation/amendment remains in the existing Angular/API workflow.

## Migration approval package

The existing DB has exactly 18 pending built-in migrations. Review:

- [Exact pending plan](AUTH_PENDING_MIGRATIONS.txt)
- [Collected SQL including django_migrations recorder DDL](AUTH_PENDING_MIGRATIONS.sql)
- [Restored current-backup rehearsal and fingerprints](AUTH_MIGRATION_REHEARSAL.md)
- [Tables/columns, backup and rollback procedure](MIGRATION_APPROVAL.md)

The only new tables are auth_group, auth_group_permissions, auth_permission, auth_user, auth_user_groups, auth_user_user_permissions, django_admin_log, django_content_type, django_migrations and django_session. Django creates their indexes/constraints and permission/content-type data. setup_roles creates/configures the five application groups. No custom business migration is introduced.

The private read-only pg_dump backup resides in Git-ignored database/backups; its SHA256 and successful restore are recorded in the rehearsal report. Restore omitted original owner/ACL metadata intentionally; deployment grants remain a separate check. All four original tables' data/stock/captured-price, column/identity and constraint fingerprints matched before/after rehearsal. The live database remains unmigrated. Before approved application, refresh the backup if writes occurred and coordinate writers. Rollback of auth tables loses accounts/roles/sessions; prefer preserving additive tables when reverting code. Never reset the business database or replay Delivered orders.

## Verification results

| Check | Status | Actual result |
|---|---|---|
| Complete Django/PostgreSQL regression suite, including browser wrapper and local configuration tests | PASS | 101 passed, 0 failed, 0 skipped; 79.848 seconds |
| Chromium scenarios inside the backend browser wrapper | PASS | 2 passed: registration/admin approval/session restoration; public navigation/return-to-action/purchasing/forbidden viewer actions |
| Angular Vitest | PASS | 55 passed, 0 failed, 0 skipped; seven files |
| Angular production build | PASS | 378.97 kB initial bundle; estimated transfer 97.82 kB |
| Django system checks | PASS | No issues |
| Native Windows runserver with automatic .env loading | PASS | Root 200 independently of Angular; original DB Admin and health safely 503 pending schema approval |
| Restored current-backup migration rehearsal | PASS | All 18 built-in migrations, group setup and checks succeeded; all business data/schema fingerprints unchanged |
| git diff --check | PASS | No whitespace errors |
| Existing DB registration/login/admin activation | BLOCKED BY DATABASE APPROVAL | No live migrations applied; current live auth tables absent |
| Docker/macOS execution | NOT VERIFIED | Not run in this Windows environment |

The two Chromium scenarios are included through one test wrapper in the 101 backend tests; do not add them again to the backend total. The wrapper checks persisted PostgreSQL user/password hash, role assignment, catalog category, supplier, delivered order and exact stock. Final backend command from backend: `$env:JEDEL_BROWSER_TESTS='1'; .venv/Scripts/python.exe scripts/test_postgres.py`. Frontend commands: `npm.cmd test -- --watch=false` and `npm.cmd run build`. The ignored full backend log is backend/.runtime/public-home-full-verification.log. Browser failure traces are ignored under frontend/test-results.

Earlier runs found a real admin-form metadata issue and test-harness/locator issues (missing admin static assets, Django 6 group-selector ID, ambiguous product names and navigation timing). These were corrected; no test was disabled.

## Commands

Windows, from backend:

```powershell
python manage.py runserver
```

From frontend in another terminal:

```powershell
npm.cmd start
```

macOS, with dependencies/configuration already installed: from backend, `.venv/bin/python manage.py runserver`; from frontend, `npm start`. No repeated shell environment setup is needed when backend/.env is configured. macOS execution is not claimed.

Frontend: http://localhost:4200/ . Backend: http://127.0.0.1:8000/ . Native proxy and trusted local CSRF origins support this arrangement. Backend startup/root are usable now; live account/admin operations still require schema approval. After approved provisioning, explicitly bootstrap the first administrator locally with `python manage.py createsuperuser`; then approve/assign applicants in Django Admin. No default real accounts/passwords exist.

## Files changed for this follow-up

- [backend/README.md](../backend/README.md)
- [backend/apps/purchasing/account_serializers.py](../backend/apps/purchasing/account_serializers.py)
- [backend/apps/purchasing/admin.py](../backend/apps/purchasing/admin.py)
- [backend/apps/purchasing/admin_availability.py](../backend/apps/purchasing/admin_availability.py)
- [backend/apps/purchasing/api/exceptions.py](../backend/apps/purchasing/api/exceptions.py)
- [backend/apps/purchasing/auth_views.py](../backend/apps/purchasing/auth_views.py)
- [backend/apps/purchasing/management/commands/runserver.py](../backend/apps/purchasing/management/commands/runserver.py)
- [backend/apps/purchasing/templates/purchasing/backend_home.html](../backend/apps/purchasing/templates/purchasing/backend_home.html)
- [backend/apps/purchasing/test_accounts.py](../backend/apps/purchasing/test_accounts.py)
- [backend/apps/purchasing/test_admin_workflows.py](../backend/apps/purchasing/test_admin_workflows.py)
- [backend/apps/purchasing/test_browser.py](../backend/apps/purchasing/test_browser.py)
- [backend/config/settings.py](../backend/config/settings.py)
- [backend/config/test_local_environment.py](../backend/config/test_local_environment.py)
- [backend/config/urls.py](../backend/config/urls.py)
- [backend/scripts/rehearse_auth_migrations.py](../backend/scripts/rehearse_auth_migrations.py)
- [backend/scripts/test_postgres.py](../backend/scripts/test_postgres.py)
- [docs/API.md](../docs/API.md)
- [docs/AUTHENTICATION.md](../docs/AUTHENTICATION.md)
- [docs/AUTH_MIGRATION_REHEARSAL.md](../docs/AUTH_MIGRATION_REHEARSAL.md)
- [docs/AUTH_PENDING_MIGRATIONS.sql](../docs/AUTH_PENDING_MIGRATIONS.sql)
- [docs/AUTH_PENDING_MIGRATIONS.txt](../docs/AUTH_PENDING_MIGRATIONS.txt)
- [docs/AUTH_PUBLIC_ADMIN_FIX.md](../docs/AUTH_PUBLIC_ADMIN_FIX.md)
- [docs/MIGRATION_APPROVAL.md](../docs/MIGRATION_APPROVAL.md)
- [docs/VERIFICATION.md](../docs/VERIFICATION.md)
- [frontend/README.md](../frontend/README.md)
- [frontend/e2e/account-flow.spec.ts](../frontend/e2e/account-flow.spec.ts)
- [frontend/e2e/workflow.spec.ts](../frontend/e2e/workflow.spec.ts)
- [frontend/src/app/app.ts](../frontend/src/app/app.ts)
- [frontend/src/app/auth.spec.ts](../frontend/src/app/auth.spec.ts)
- [frontend/src/app/auth.ts](../frontend/src/app/auth.ts)
- [frontend/src/app/core/data/api-data.service.spec.ts](../frontend/src/app/core/data/api-data.service.spec.ts)
- [frontend/src/app/core/data/api-errors.ts](../frontend/src/app/core/data/api-errors.ts)
- [frontend/src/app/pages/analytics.ts](../frontend/src/app/pages/analytics.ts)
- [frontend/src/app/pages/home.ts](../frontend/src/app/pages/home.ts)
- [frontend/src/app/pages/login.ts](../frontend/src/app/pages/login.ts)
- [frontend/src/app/pages/orders.ts](../frontend/src/app/pages/orders.ts)
- [frontend/src/app/pages/pages.spec.ts](../frontend/src/app/pages/pages.spec.ts)
- [frontend/src/app/pages/products.ts](../frontend/src/app/pages/products.ts)
- [frontend/src/app/pages/public-workspace.ts](../frontend/src/app/pages/public-workspace.ts)
- [frontend/src/app/pages/register.ts](../frontend/src/app/pages/register.ts)
- [frontend/src/app/pages/suppliers.ts](../frontend/src/app/pages/suppliers.ts)
- [frontend/src/app/public-navigation.spec.ts](../frontend/src/app/public-navigation.spec.ts)
- [frontend/src/app/routes.ts](../frontend/src/app/routes.ts)

No dependency changes in this follow-up. Existing purchasing models/services, SQL dump and database role scripts were compared to HEAD and remain unchanged. Private .env values were not displayed or rewritten. Test logs/traces and the backup are ignored, not source artifacts.
