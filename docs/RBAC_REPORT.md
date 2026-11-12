# RBAC implementation and operator procedure

## Audit

Read-only live diagnostics: database jedel_group_db; OVERLORD is active=True, staff=True, superuser=True. Only Basic User exists. No account or group was written. Existing sessions, CSRF, hashing, safe catalog, six named capability policies, API role checks, protected Admin workflows and Angular role-aware business pages were already implemented. Provisioning previously lacked a plan/confirmation/conflict gate and meaningful grants for most roles. Raw auth permissions could authorize ordinary staff account administration; this is now restricted.

Authentication identifies the user. Django Groups define application roles; Permission records authorize Django model administration. Staff permits entry to Admin, not superuser power. Superuser is a separately trusted Django flag. PostgreSQL connection roles/GRANTs are independent; browser login never changes database credentials. Yerbolat's SQL and Bekarys purchasing requirements remain unchanged.

## Effective policy

| Group | Private read/reports | Catalog add/edit | Prepare/amend Pending | Approve/deliver/cancel | Delete via API | Accounts |
|---|---|---|---|---|---|---|
| Basic User | No | No | No | No | No | Own profile only |
| Purchasing Employee | Yes | Yes | Yes | No | No | Own profile only |
| Purchasing Manager | Yes | Yes | Yes | Yes, eligible states | No | Own profile only |
| System Administrator | Yes | Yes | Yes | Yes, validated services | Yes, constraints apply | Trusted administration; staff and model permissions required for Admin |
| Security Administrator | No | No | No | No | No | Delegated low-privilege activation, not role assignment |
| Analyst / Tester | Yes | No | No | No | No | Own profile only |

All roles and anonymous visitors can open public previews and safe product names/categories. Supplier contacts, prices, stock, orders and reports remain private. Multiple groups compose by union of the explicit capability policy; Basic membership does not subtract access. Inactive accounts have no capabilities. Unknown groups and arbitrary direct permissions grant no purchasing capabilities. Superuser is trusted separately.

The existing `accounts.ROLES` service remains the compatible action policy attached to Django Group membership; this is intentionally retained because Django's generic change_purchaseorder permission cannot distinguish Pending amendments from approvals. Provisioning also assigns meaningful standard model Permission records: view permissions to readers, catalog add/change and order add/change to preparers, deletion and auth model permissions to System Administrator. Removing a standard model permission does not redefine the API role policy; remove/change role membership to revoke those capabilities. Security's narrowly delegated API uses its named group, not unrestricted auth permissions. No competing frontend role policy or new schema is introduced.

Supplier/product writes require manage_catalog, order creation/amendment requires create_orders, all transitions require transition_orders, deletion requires delete_records, business GET/detail/reports require read. Existing API validators prevent arbitrary stock editing. Admin inventory fields/items are read-only and transitions invoke transition_order, preserving atomicity and double-delivery protection. Legacy Viewer/Buyer/Approver/Admin token classes remain regression-tested compatibility code but are NOT enabled in DEFAULT_AUTHENTICATION_CLASSES; live APIs use session authentication only.

## Provisioning: approval still required

From backend in PowerShell:

```powershell
python manage.py setup_roles --dry-run
```

This read-only plan has been executed successfully on the configured database. With no flags the command also only plans. It creates no users, modifies no passwords or flags, deletes no grants, and aborts atomically if existing role grants conflict or expected Permission rows are missing. Repeated confirmed execution is additive and idempotent. --dry-run and --confirm together are rejected.

**The following live role-record write requires the owner's explicit approval and has NOT been executed:**

```powershell
python manage.py setup_roles --confirm
```

It creates five missing Groups, reuses Basic User, and adds the displayed group-permission relations in existing auth tables. No DDL, migration, business-table write or stock change is required. Back up the database before security administration, e.g. use pg_dump's custom format with your locally configured connection; never put a password in a command or repository. Role setup rollback is an administrator review/removal of newly granted memberships; it does not automatically undo later assignments.

## Assign and verify accounts

After approved provisioning, log in to /admin/ as OVERLORD or another trusted authorized administrator. Users -> select an existing account -> Groups -> choose its approved role -> Save. Do not assign proposed team members automatically. To remove a role, deselect that group and check remaining group unions. Normal registration continues to assign only active Basic User and auto-login; old accounts are preserved.

Explicitly set Staff only for trusted System Administrators needing Admin. Do not set Superuser for ordinary application roles. A local trusted operator may bootstrap a separate superuser with `python manage.py createsuperuser` after auth schema readiness; no default passwords exist. Non-superuser System Administrators cannot edit superuser accounts or the superuser flag/direct user permissions, nor their own group/staff/active fields. Their role is trusted to manage application groups and other ordinary accounts; it is not intended as a constrained security delegation. Security Administrators receive no raw group editor or role-assignment API. Account activation excludes self, staff, superusers, privileged business/security groups and users with direct grants. Existing pending registrations are reviewed individually, never bulk auto-promoted.

Refresh/login after assignments, inspect role and capabilities through /api/auth/me/, verify allowed/denied requests independently of UI. Staff without the proper role and auth model permissions cannot edit users/groups. System Admin's Admin catalog deletion remains disabled deliberately; API deletion respects constraints. Historical prices and stock are never editable through Admin.

Angular loads actual role/profile, uses server capability flags for Security access and Administration links, and retains public previews/guards. Account settings reports security API failures instead of swallowing errors. Role assignment requires a System Administrator; no public profile role field is accepted.

## Files in this task

Django: accounts.py, admin.py, security_views.py; management/commands/setup_roles.py and init_development.py; test_accounts.py, test_browser.py, new test_rbac.py (all under backend/apps/purchasing).
Angular: src/app/auth.ts, app.ts, pages/connection.ts, account-navigation.spec.ts.
Documentation: this report and README link. No dependencies, migrations, model/service or SQL role scripts changed.

## Manual checks

1. Approve and execute provisioning only after reviewing the dry-run above; inspect all six groups and their listed permissions.
2. Assign isolated test accounts one group each. Basic sees safe previews only; Employee prepares/amends but cannot transition; Manager transitions eligible orders; Analyst reads without writes; Security sees delegated account controls without business data; System Admin with staff sees supported Admin models.
3. Check private GET/detail APIs return anonymous 401 and Basic/Security 403; check forbidden writes are 403 independently of button visibility. Public catalog must omit stock/prices.
4. Add Basic plus Employee to a test user: employee capabilities persist, no manager or superuser power. Disable account and confirm session requests fail. Verify logout and refresh restoration.
5. Use isolated development data for mutations/deliveries. Do not test real company stock or historical orders.

Verification results are recorded below after the final test run. Existing live roles remain unprovisioned until approval. No macOS/other-browser verification is claimed.

## Final verification results

- Full isolated PostgreSQL suite: **126 passed, 0 failed, 0 skipped**, 67.188 seconds.
- Real Chromium scenarios nested inside that backend suite: **5 passed, 0 failed, 0 skipped**, 24.6 seconds. Existing all-role page matrix, session/account flows and manager lifecycle remain green.
- Final focused RBAC/Admin regression after superuser-account protection: **9 passed, 0 failed, 0 skipped**. These overlap the full suite; do not add them as unique coverage.
- Angular unit regression: **80 passed, 0 failed, 0 skipped** (11 files), including the new backend-capability navigation assertion.
- Production Angular build passed (408.32 kB initial). Django check found no issues. All 18 existing auth/admin/contenttypes/session migrations are applied; no migration was run on live PostgreSQL.
- Read-only live setup_roles --dry-run succeeded; only Basic User exists. No existing user assignment/password/flag was modified. Original models, services and database role scripts have no diff against HEAD. git diff --check passed.

Readiness: **BLOCKED BY DATABASE APPROVAL** for live role provisioning only. Implementation and isolated tests pass. Required approved command from backend: `python manage.py setup_roles --confirm`. No schema migration is required. Assigning real team accounts remains a separate administrator-controlled action; proposed names have not been provisioned.
