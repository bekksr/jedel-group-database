# Existing database migration gate

Status: NOT APPROVED and NOT APPLIED to jedel_group_db. Do not run an unrestricted migrate against it.

The four business tables remain unmanaged, unchanged and excluded from Django DDL. No custom migrations are needed: Django's installed built-in migrations provide auth, contenttypes, sessions and admin. No historical orders are imported or delivered during initialization.

## Proposed schema extension

For a database with none of these Django tables, the migration set is:

- contenttypes: 0001_initial, 0002_remove_content_type_name
- auth: 0001_initial through 0012_alter_user_first_name_max_length
- admin: 0001_initial through 0003_logentry_add_action_flag_choices
- sessions: 0001_initial

Final new tables/columns:

| Table | Columns |
|---|---|
| django_migrations | id, app, name, applied |
| django_content_type | id, app_label, model |
| auth_permission | id, name, content_type_id, codename |
| auth_group | id, name |
| auth_group_permissions | id, group_id, permission_id |
| auth_user | id, password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined |
| auth_user_groups | id, user_id, group_id |
| auth_user_user_permissions | id, user_id, permission_id |
| django_session | session_key, session_data, expire_date |
| django_admin_log | id, action_time, object_id, object_repr, action_flag, change_message, content_type_id, user_id |

Built-in migrations also create their FK/unique/index constraints and permission/content-type rows. setup_roles creates five group rows separately. No columns in suppliers/products/purchase_orders/purchase_order_items are changed.

## Required operator sequence

1. Stop writers and take a verified full backup using `pg_dump --format=custom --file=<private-backup-path> jedel_group_db` with explicit approved host/user options. Keep credentials outside commands and backup files outside Git. Record PostgreSQL roles/grants separately; database dumps do not include cluster roles.
2. Restore to an explicitly disposable database/cluster using an operator-reviewed `pg_restore`, never the live target. Verify four-table row counts, constraints, stock totals and historical order prices against backup before and after rehearsal.
3. Point a separate backend process at that restored copy. Run `python manage.py showmigrations` and `python manage.py migrate --plan`. Capture exact output. Existing migration history may change the plan; stop on conflicts.
4. Review SQL with `python manage.py sqlmigrate <app> <migration>` for every pending migration in the plan. Run the reviewed plan only on the restored copy, then setup_roles and createsuperuser. Verify login, CSRF, permissions and a browser workflow on isolated data.
5. Present backup verification, exact plan/SQL, table diff, test evidence and target identification for explicit user approval. The test runner has already demonstrated built-in migrations on empty isolated PostgreSQL, but that does not replace rehearsal on the actual restored live schema/data/grants.
6. Only after approval, schedule a maintenance window and apply the reviewed migration plan to the approved target. Verify business schema/data snapshots unchanged, runtime grants, sessions and admin before reopening writers.

Rollback is not a blind migrate-zero operation: reversing auth/contenttypes removes users, permission assignments and admin references; reversing sessions signs users out. Prefer reverting application code while preserving additive tables, or restoring a verified backup during a controlled maintenance window. A full restore can lose writes after backup. Coordinate data recovery with the database owner. Never drop/recreate business tables or replay Delivered orders.

init_development is only for explicitly isolated DB_NAME=jedel_dev and refuses other names. It extracts only the original 17 schema DDL statements into an empty database, skips existing complete business schema, and applies built-in migrations to this explicitly designated development target. It never imports COPY data, changes owners/grants or replays stock operations.

## Current database evidence (2026-11-12 follow-up)

Read-only diagnostics confirmed backend/.env has all five database connection settings configured, but auth/session/admin tables and django_migrations are absent. The live registration endpoint was reproduced in read-only mode returning 503 at its auth_user lookup; no account or business record was created.

The exact pending 18-migration plan is [AUTH_PENDING_MIGRATIONS.txt](AUTH_PENDING_MIGRATIONS.txt), with collected SQL and the migration recorder DDL in [AUTH_PENDING_MIGRATIONS.sql](AUTH_PENDING_MIGRATIONS.sql). Review-only SQL is not a standalone migration script: Django data operations and post_migrate permission creation must run through the reviewed migration process.

A private full pg_dump backup was taken read-only to Git-ignored database/backups, successfully restored with --no-owner --no-acl into the marked disposable jedel_auth_rehearsal database, and migrated there. [AUTH_MIGRATION_REHEARSAL.md](AUTH_MIGRATION_REHEARSAL.md) records before/after business data/schema fingerprints: all four tables were unchanged. Stock and captured historical prices are included in the row fingerprints. Current live migrations remain NOT APPLIED. No migration will run automatically during runserver or web requests.

Existing owner/runtime grants still need deployment-specific verification because rehearsal deliberately omits original owners/ACLs. The configured live role was confirmed to have public-schema CREATE permission without displaying its identity. Before an approved live migration, take/verify an up-to-date backup and coordinate writers; the rehearsal backup is point-in-time evidence, not a guarantee that later business writes can be discarded safely.
