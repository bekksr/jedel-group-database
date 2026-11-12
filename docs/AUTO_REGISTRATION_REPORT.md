> Product visibility follow-up: Basic User now has a safe ID/name/category catalog. Private costs/stock/suppliers/orders remain protected. See [the current catalog report](CATALOG_ACCESS_REPORT.md).

# Automatic registration, auto-login and Account navigation

Date: 2026-11-12. Branch: feature/fullstack-integration-auth. Prior uncommitted work was preserved. No commit, push, merge, reset or Git author change was performed.

## Result

**PASS in the tested Windows/isolated PostgreSQL environment.** New registration is active and automatically logged in, with a least-privileged Basic User role. The public header has one Account entry; authenticated users have a profile menu. The configured existing database is now schema-ready, confirmed read-only; no disposable account was registered there during testing.

## Previous and new behavior

Previously register created an inactive account with no group, displayed pending approval and required a later manual login after activation. The header had separate Register/Log in entries.

Now register validates name/email/password/confirmation, rejects duplicate or colliding identifiers and privilege fields, creates a real active account with Django password hashing, and assigns only Basic User. Django login and explicit database session persistence happen inside the same transaction as user/group assignment. A session creation failure rolls back the account instead of reporting fake success. Only after commit does the endpoint return 201 with a profile and the welcome detail.

Angular confirms the session with /api/auth/me/, updates its single user state, displays "Account created successfully. Welcome to Jedel.Group!" and redirects Home. Reload restores the profile from the server. If persistence is confirmed but profile retrieval fails, the UI explains that the user should try logging in before registering again; it does not claim successful authenticated access or blindly resubmit. A late anonymous /me/ response cannot erase the new profile. Logout invalidates the database session and clears client/private workspace state.

## Default role and security

Basic User has own-profile/name/password access and safe public pages only. Every purchasing capability is false: no private supplier contacts, catalog prices/stock, orders, analytics, catalog mutations, order preparation, approval/delivery/cancellation, security controls or administration. This is deliberately safer than Viewer/Analyst, which can read confidential ERP data.

New users are not Staff/Superuser and are not assigned Purchasing Manager, Security Administrator or any privileged group. Request fields cannot choose roles or flags. The backend independently enforces permissions; hiding UI buttons is not the security boundary. A trusted administrator may assign a business role later.

Basic User is an ordinary Django Group row, created lazily within real registration or by explicit setup_roles. There is no new table/migration. Its Django permission set must be empty; an unsafe existing default group causes registration to fail safely rather than inheriting grants or overwriting existing group permissions. Role setup now knows six application groups; existing PostgreSQL role/GRANT scripts remain unchanged.

CSRF remains enforced on login/registration and cookie-authenticated unsafe operations. Session cookies remain HttpOnly/SameSite with HTTPS Secure flags outside development. Angular uses relative /api via the development proxy. No password or session secret is stored in localStorage. Both registration and login have independent 10/minute IP cache limits applying to authenticated and anonymous requests. The local in-process cache is not a distributed production rate-limit guarantee.

Duplicate-email checks are case-insensitive and serialized; new email/username namespace collisions with old accounts are rejected. Existing ambiguous legacy identifiers still fail closed during login rather than selecting an arbitrary account. Password rules/hashing and confirmation remain Django-backed.

## Existing users

No existing users were automatically activated, disabled, reassigned or otherwise changed. Read-only diagnostics found two inactive nonstaff accounts before and after this task. The isolated tests verify both old inactive users and existing active purchasing users retain their state and roles.

Authorized administrators can review old inactive accounts in Django Admin ? Users, inspect each account, assign Basic User or an explicitly authorized business group, then activate it or use the existing approval action. Reject/suspend keeps the user inactive without deleting records. This manual path is for old inactive accounts or deliberate access management; new normal registrations do not require approval.

## Account navigation and UI

Logged out: Home | Products | Suppliers | Orders | Analytics | Account. Account opens /auth in Log in mode. Register is the second mode within the same centered responsive card. /login and /register bookmarks remain functional redirects. The existing card typography/layout, field validation, password toggle and submission lock remain.

Logged in: public navigation plus an avatar/name/actual-role profile menu containing My Profile, Settings and Log out. My Profile and Settings lead to the existing account settings functionality. Selecting a destination closes the menu. Ordinary users are not shown a Django Admin link. Logout restores the one Account entry.

Public Home does not require authentication. Private sections show safe previews/prompts for anonymous visitors, and Access Denied for signed-in users without business capability. Account creation itself grants no purchasing permission. Existing privileged users can still log in through a protected-action returnTo route and resume only authorized operations. Registration redirects Home as requested.

The initial browser run found a real notification bug: clearing the private workspace also removed the welcome notification. The fix lets authentication-driven data clearing preserve notices while explicit logout still clears old notifications. The profile menu also closes on selection. A browser test selector was scoped to the profile dropdown to distinguish it from the existing workspace Settings link. No failing test was disabled.

## PostgreSQL and migration status

The database state changed since the earlier report: read-only catalog/history checks now confirm all ten Django tables and all 18 built-in auth/admin/contenttypes/session migrations already applied in jedel_group_db. No migrations are pending. The agent did not apply those live migrations. Current runtime INSERT/SELECT/UPDATE/session-delete privileges were checked read-only and are sufficient for the new account/session workflow.

The live Basic User group had not yet been created during final diagnostics; that is expected because this task performed no live registration. First real registration creates the empty-permission Group row transactionally. No schema DDL or startup command is needed for the new policy.

Business tables suppliers, products, purchase_orders and purchase_order_items, their mappings, purchasing services, original SQL dump and PostgreSQL role/GRANT scripts remain unchanged. No existing stock, captured price, status, record or constraint was modified by testing. All disposable accounts and order operations ran in a marked temporary PostgreSQL cluster on a separate port. Fresh isolated initialization and repeated initialization preserving a sentinel row were verified with six groups. Historical missing-schema approval reports must not be replayed blindly against this now-initialized database.

## Actual tests

| Check | Result |
|---|---|
| Full backend/PostgreSQL regression suite (Django 6.0.3) | 114 passed, 0 failed, 0 skipped; 88.341 seconds |
| Real Chromium scenarios in backend wrapper | 3 passed in 21.0 seconds |
| Angular Vitest | 66 passed, 0 failed, 0 skipped; nine files |
| Angular production build | Passed; initial 389.08 kB, estimated transfer 100.31 kB |
| Fresh disposable PostgreSQL migration/init | Passed |
| Repeated init / six groups / sentinel preservation | Passed |
| Read-only existing DB schema/migration/permission checks | Passed; 18 applied, zero pending |
| Existing inactive users observed before/after | Two, left unchanged |
| git diff --check | Passed |
| macOS and Docker execution for these changes | Not tested in this Windows session |

The browser scenarios verify: automatic registration/session/profile/refresh, Basic User denial by private APIs, profile menu/logout/Account restoration, and explicit login with the new account; unified modes/bookmarks/password visibility/validation and responsive widths; existing administrator catalog/purchasing lifecycle and viewer restrictions. The wrapper directly checks PostgreSQL account/hash/group and business persistence/stock. Browser tests are included through one wrapper in the 114 backend total, not added again.

Backend tests cover session creation rollback, CSRF, duplicate/colliding emails, password rules, auto-activation/login, Basic User restrictions, privilege-field rejection, misconfigured default role, old-account preservation, throttling with authenticated sessions, admin safety, concurrent delivery/rollback and existing business regressions. Frontend tests cover one Account link, real-profile state confirmation, no fake success on profile failure, stale restore races, profile menu/logout, public Home, guards and existing forms.

Final commands: from backend, `$env:JEDEL_BROWSER_TESTS='1'; $env:JEDEL_VERIFY_DEVELOPMENT='1'; python scripts/test_postgres.py`; from frontend, `npm.cmd test -- --watch=false` and `npm.cmd run build`. Evidence is in ignored backend/.runtime/auto-registration-full.log and ignored frontend/test-results. No credentials are included in source documentation.

## Manual browser verification

1. From backend run `python manage.py runserver`; from frontend in another terminal run `npm.cmd start`. Restart running dev servers if needed to pick up code. backend/.env supplies configuration; do not paste a bearer token.
2. Open http://localhost:4200/. Confirm public Home and exactly one Account entry beside the five navigation sections.
3. Click Account. Confirm Log in is selected; switch Register and enter your own full name, new email, password and matching confirmation.
4. Submit once. After server confirmation, expect Home, the welcome notification and your name / Basic User profile menu. No pending-approval message should appear.
5. Refresh: the profile/menu should remain. Open My Profile or Settings and verify your own details. No Staff/Admin link or business permissions should appear.
6. Open Products/Suppliers/Orders/Analytics as Basic User: protected records must remain unavailable. This is expected least privilege, not a broken login. Ask an authorized administrator for an appropriate business role if needed.
7. Open the profile menu and Log out. Account should return; public Home remains accessible. /api/auth/me/ returning 401 after logout is normal.
8. Reopen Account and log in with your new email/password; verify session restoration again. /login and /register must still select the corresponding mode.
9. An authorized administrator may separately review old inactive accounts and explicitly assign/activate them. Do not bulk-activate existing users merely because signup policy changed.

No schema migration or manual role seed is required for this change on the currently initialized database. No disposable real-team account test was performed there. Production distributed-cache/proxy/HTTPS hardening and macOS/Docker runtime checks remain separate deployment/environment validation.

## Files changed for this task

- [README.md](../README.md)
- [backend/README.md](../backend/README.md)
- [backend/apps/purchasing/accounts.py](../backend/apps/purchasing/accounts.py)
- [backend/apps/purchasing/auth_views.py](../backend/apps/purchasing/auth_views.py)
- [backend/apps/purchasing/management/commands/setup_roles.py](../backend/apps/purchasing/management/commands/setup_roles.py)
- [backend/apps/purchasing/schema.py](../backend/apps/purchasing/schema.py)
- [backend/apps/purchasing/test_accounts.py](../backend/apps/purchasing/test_accounts.py)
- [backend/apps/purchasing/test_browser.py](../backend/apps/purchasing/test_browser.py)
- [backend/scripts/verify_development.py](../backend/scripts/verify_development.py)
- [docs/API.md](../docs/API.md)
- [docs/AUTHENTICATION.md](../docs/AUTHENTICATION.md)
- [docs/AUTO_REGISTRATION_REPORT.md](../docs/AUTO_REGISTRATION_REPORT.md)
- [docs/DEVELOPMENT.md](../docs/DEVELOPMENT.md)
- [docs/UNIFIED_AUTH_REPORT.md](../docs/UNIFIED_AUTH_REPORT.md)
- [frontend/README.md](../frontend/README.md)
- [frontend/e2e/account-flow.spec.ts](../frontend/e2e/account-flow.spec.ts)
- [frontend/e2e/workflow.spec.ts](../frontend/e2e/workflow.spec.ts)
- [frontend/src/app/account-navigation.spec.ts](../frontend/src/app/account-navigation.spec.ts)
- [frontend/src/app/app.ts](../frontend/src/app/app.ts)
- [frontend/src/app/auth.spec.ts](../frontend/src/app/auth.spec.ts)
- [frontend/src/app/auth.ts](../frontend/src/app/auth.ts)
- [frontend/src/app/core/data/workspace-data.service.ts](../frontend/src/app/core/data/workspace-data.service.ts)
- [frontend/src/app/pages/auth-page.html](../frontend/src/app/pages/auth-page.html)
- [frontend/src/app/pages/auth-page.spec.ts](../frontend/src/app/pages/auth-page.spec.ts)
- [frontend/src/app/pages/auth-page.ts](../frontend/src/app/pages/auth-page.ts)
- [frontend/src/app/routes.ts](../frontend/src/app/routes.ts)

No dependency or migration files were added/changed for this task. The existing uncommitted integration work was preserved.
