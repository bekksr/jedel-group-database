# Approved live RBAC provisioning verification

Result: PASS. Explicit owner approval covered setup_roles --confirm on jedel_group_db only.

Completed UTC: 2026-11-12T15:52:52.939206+00:00.

## Preflight

- Connected target confirmed as jedel_group_db. Dry-run matched the six-group approved plan; Basic User existed with no grants and the other five roles were absent.
- The verified backup investigation-consistent-20261112T154836Z.backup was available and its SHA256 matched 3175543f1d316c9488ccc6cfe05c5422df588f2230fe74b129ce7bcc6bfbf19f. Every current table fingerprint still matched its verified source snapshot before provisioning.
- Reviewed command implementation and verified no conflicting grants. No operation beyond the approved Group and group-permission relation changes was included.

## Executed operation

```powershell
python manage.py setup_roles --confirm
```

Exit status: 0. Five missing Group rows created; existing Basic User row/identifier preserved. 49 group-permission links created. No Permission definitions created or changed. Role-related identity sequences advanced as expected.

| Group | Standard Django permissions | Exact approved match |
|---|---:|---|
| Basic User | 0 | Yes |
| Purchasing Employee | 10 | Yes |
| Purchasing Manager | 10 | Yes |
| Analyst / Tester | 4 | Yes |
| Security Administrator | 0 | Yes |
| System Administrator | 25 | Yes |

The Employee and Manager standard model grants are identical; the existing Group capability policy separately grants workflow transitions only to Manager/System Administrator. Security Administrator intentionally receives no unrestricted Django auth model permissions: its designated delegated account API uses the existing named-role policy. Basic User receives no private-business permission. No role was assigned to a real user.

## Preservation results

- OVERLORD: every User field unchanged, including password storage, active/staff/superuser flags and login timestamps.
- Users: 2 before and after, with identical complete data fingerprints.
- User-group memberships: 1 before and after, identical data fingerprints.
- Direct user-permission assignments: 0 before and after.
- All 12 tables outside auth_group/auth_group_permissions have identical canonical full-data fingerprints. Schema objects and non-role sequence states are unchanged.

| Business table | Before | After | Full-data fingerprint |
|---|---:|---:|---|
| suppliers | 3 | 3 | Unchanged |
| products | 5 | 5 | Unchanged |
| purchase_orders | 5 | 5 | Unchanged |
| purchase_order_items | 8 | 8 | Unchanged |

Canonical comparison uses explicit column names and primary-key ordering, UTC timestamps and exact typed values as documented in BACKUP_FINGERPRINT_INVESTIGATION.md. It compares stock, captured prices, statuses and all other fields without exposing private values.

## Exact grant sets

### Basic User

No standard Django Permission grants.

### Purchasing Employee

`purchasing.add_product`, `purchasing.add_purchaseorder`, `purchasing.add_supplier`, `purchasing.change_product`, `purchasing.change_purchaseorder`, `purchasing.change_supplier`, `purchasing.view_product`, `purchasing.view_purchaseorder`, `purchasing.view_purchaseorderitem`, `purchasing.view_supplier`

### Purchasing Manager

`purchasing.add_product`, `purchasing.add_purchaseorder`, `purchasing.add_supplier`, `purchasing.change_product`, `purchasing.change_purchaseorder`, `purchasing.change_supplier`, `purchasing.view_product`, `purchasing.view_purchaseorder`, `purchasing.view_purchaseorderitem`, `purchasing.view_supplier`

### Analyst / Tester

`purchasing.view_product`, `purchasing.view_purchaseorder`, `purchasing.view_purchaseorderitem`, `purchasing.view_supplier`

### Security Administrator

No standard Django Permission grants.

### System Administrator

`auth.add_group`, `auth.add_permission`, `auth.add_user`, `auth.change_group`, `auth.change_permission`, `auth.change_user`, `auth.delete_group`, `auth.delete_permission`, `auth.delete_user`, `auth.view_group`, `auth.view_permission`, `auth.view_user`, `purchasing.add_product`, `purchasing.add_purchaseorder`, `purchasing.add_supplier`, `purchasing.change_product`, `purchasing.change_purchaseorder`, `purchasing.change_supplier`, `purchasing.delete_product`, `purchasing.delete_purchaseorder`, `purchasing.delete_supplier`, `purchasing.view_product`, `purchasing.view_purchaseorder`, `purchasing.view_purchaseorderitem`, `purchasing.view_supplier`

## Postflight

Reran python manage.py setup_roles --dry-run: all six groups report reuse; add nothing. No conflict or unexpected result. No migration, PostgreSQL GRANT-script change, role assignment, password change, business-record modification, commit or push occurred.

Sanitized verification evidence is stored locally in backend/.runtime/rbac-approved-results.json; before fingerprints and backup identity are in rbac-approved-baseline.json. Private/runtime artifacts remain Git-ignored. No application source edits were required by this operation. Earlier reports stating live provisioning was blocked are superseded by this approved result; team-account role assignment remains an explicit administrator action.
