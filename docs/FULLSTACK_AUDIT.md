# Full-stack audit and implementation record

Audit baseline: 892ecb7 on main, clean tree, synchronized with origin/main after fetch on 2026-11-12. Integration branch: feature/fullstack-integration-auth. Remote branches inspected: main, frontend, roles-security, bekarys-business-logic, docs/business-concept. No separate authentication/deployment branch is advertised. No commits, pushes, merges, resets, or rebases performed.

## Initial audit (before edits)

| Feature | Classification | Evidence |
|---|---|---|
| Supplier/product CRUD | PARTIAL | Backend CRUD/API service present; Angular supplier/product pages were browse-only |
| Order lifecycle, atomic stock, concurrent delivery | IMPLEMENTED BUT NOT VERIFIED | transaction/row-lock services and PostgreSQL tests present |
| Dashboard and analytics | IMPLEMENTED BUT NOT VERIFIED | Existing report endpoints and home-page metrics; no independent analytics route |
| Registration | PARTIAL | Client validation only; explicitly preview-only |
| Individual login, sessions, logout, profile | MISSING | Shared EnvironmentTokenAuthentication only |
| Application authorization | PARTIAL | Viewer/Buyer/Approver/Admin shared credentials, no users/groups |
| Angular routing | PARTIAL | No authentication guards |
| Settings | PARTIAL | Manual in-memory bearer entry required |
| Backend landing/Admin | MISSING | Root URL only includes API |
| API root and health | PARTIAL | API router exists; original health explicitly does not check DB |
| OpenAPI | MISSING | No schema or docs route |
| Database mappings | IMPLEMENTED BUT NOT VERIFIED | Four unmanaged models and original SQL dump |
| PostgreSQL roles | IMPLEMENTED BUT NOT VERIFIED | Original roles.sql/test_roles.sql; independent of Django roles |
| Windows launcher | IMPLEMENTED BUT NOT VERIFIED | Existing credential prompts/read-only diagnostics; bearer-dependent |
| macOS/Docker | MISSING | No portable launcher/Compose |
| Automated testing | IMPLEMENTED BUT NOT VERIFIED | Guarded disposable PG runner and Angular Vitest tests |

The live database was not queried or changed during this task. Schema inspection is based on source dump and isolated PostgreSQL copies. Latest integrated business analysis and roles contributions were retained. Existing role/GRANT scripts, business mappings, stock services, SQL dump, captured-price logic and constraints were preserved.

## Implementation decisions

Use Django sessions through Angular's same-origin /api proxy. Registration creates inactive, unprivileged accounts; a trusted superuser approves, assigns groups and activates them. No shared bearer credential is accepted by the deployed DRF configuration. Retained legacy diagnostic modules are historical and their bearer HTTP checks must not be used to certify named-account access.

Group capabilities are explicit in backend/apps/purchasing/accounts.py. User/group management is restricted to bootstrap superusers and explicitly staff-enabled, fully trusted System Administrators. System Administrator group grants application management and Django auth permissions, but never automatically grants Staff or Superuser status. Security Administrator can activate or suspend previously assigned Purchasing Employees and Analysts through a restricted API/settings interface. It cannot assign roles, activate unassigned applicants, edit staff/superusers or access business data.

Business records in Django Admin are view-only for superusers. All writes go through existing validated APIs and services. This intentionally prioritizes integrity over adding a second order-management implementation.

## Remaining acceptance gates

Live schema migration needs explicit approval after backup and rehearsal on a restored isolated copy. Docker startup/persistence and macOS hardware testing require their respective environments. See VERIFICATION.md for exact test results and limitations. Full production deployment, distributed login throttling and production hardening are not delivered by local development support.
