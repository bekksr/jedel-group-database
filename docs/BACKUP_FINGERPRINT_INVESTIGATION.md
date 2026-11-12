# PostgreSQL backup fingerprint investigation

Result: PASS for logical table data and the schema/sequence scope below. No live database modification or RBAC provisioning was performed.

## Confirmed root cause

The original comparison hashed `row_to_json(t)::text` without fixing connection TimeZone. Django reads in UTC; raw psycopg2 connections to the temporary cluster defaulted to Asia/Qyzylorda. PostgreSQL serializes timestamptz using that session setting. Identical stored instants therefore produced different strings and SHA256 results. Changing only the restored session timezone to UTC made all original row hashes equal. No record difference was found.

| Table affected by old hash | Timestamp columns |
|---|---|
| public.auth_user | date_joined, last_login |
| public.django_admin_log | action_time |
| public.django_migrations | applied |
| public.django_session | expire_date |

A separate schema-metadata comparison initially differed only on two physical ordinal positions: django_content_type.app_label (3 -> 2) and model (4 -> 3). Catalog inspection confirmed a dropped attribute at physical slot 2 in the source. A logical pg_dump/pg_restore compacts that dropped slot. Column names, types, nullability, defaults, identity settings and values match after excluding the nonsemantic physical ordinal. Relative visible-column order is preserved. No live column was changed.

## Targets and environment

- Source: jedel_group_db, schema public, PostgreSQL 17.6, UTF8, locale Russian_Russia.1251; source transaction explicitly REPEATABLE READ READ ONLY.
- Restores: isolated_original_archive, isolated_consistent_archive and isolated_same_locale_archive on a separate random-port disposable cluster under a checked jedel-readonly-backup-investigation- temporary directory. No connection to live PostgreSQL was used for restoration or cleanup.
- PostgreSQL 17.6/UTF8 on all targets. First two databases intentionally use locale C; the third uses Russian_Russia.1251 to match live. All data comparisons pass in both locales.
- Source DateStyle ISO, DMY and restore ISO, MDY were recorded. Canonical checks normalize DateStyle to ISO, YMD, TimeZone to UTC, IntervalStyle to postgres, extra_float_digits to 3 and bytea_output to hex. Source and targets initially used extra_float_digits=1. No float or collation discrepancy caused the original mismatch.

## Deterministic and independent checks

1. Enumerate every non-system table by schema/name; all 14 are in public. Select explicit, alphabetically ordered column names and ORDER BY every primary-key column in declared key order. All tables have a primary key. Physical row order and physical column slots do not affect this method.
2. Compare complete typed records in memory, keyed by primary key, and count missing/extra/modified records. Canonical values distinguish NULL, booleans, integers, exact Decimal text, UTF-8 strings, dates and timestamps. Aware timestamps are converted to UTC ISO8601 with six fractional digits; decimals are not converted to float; strings are not case-folded or whitespace-normalized. No user values, password hashes or session tokens are printed.
3. Independently compare primary-key-ordered PostgreSQL COPY CSV SHA256 values with fixed session formatting, explicit columns, quoted non-NULL fields and an explicit NULL sentinel. This bypasses the Python typed-value serialization. All tables match.
4. Reproduce the original raw JSON hashes, then change only the restored connection timezone. All original hashes match after that single setting change.
5. Compare named column definitions (excluding physical ordinal gaps), constraints, indexes, sequence definitions/ownership links/current values, extensions, policies, views and noninternal triggers. Results below.

For the fresh archive, pg_dump used an explicitly exported snapshot from the same open read-only repeatable-read source transaction used by the comparison. This fixes the earlier methodology weakness where sequential reads and pg_dump had independently acquired snapshots. The original archive had no exported comparison snapshot; its exact records nevertheless match both the current consistent snapshot and the preserved historical live fingerprints.

## Table-by-table results

| Table | Source rows | Original restore | Fresh restores | Missing / extra / modified |
|---|---:|---:|---:|---|
| public.auth_group | 1 | 1 | 1 | 0 / 0 / 0 |
| public.auth_group_permissions | 0 | 0 | 0 | 0 / 0 / 0 |
| public.auth_permission | 40 | 40 | 40 | 0 / 0 / 0 |
| public.auth_user | 2 | 2 | 2 | 0 / 0 / 0 |
| public.auth_user_groups | 1 | 1 | 1 | 0 / 0 / 0 |
| public.auth_user_user_permissions | 0 | 0 | 0 | 0 / 0 / 0 |
| public.django_admin_log | 4 | 4 | 4 | 0 / 0 / 0 |
| public.django_content_type | 10 | 10 | 10 | 0 / 0 / 0 |
| public.django_migrations | 18 | 18 | 18 | 0 / 0 / 0 |
| public.django_session | 2 | 2 | 2 | 0 / 0 / 0 |
| public.products | 5 | 5 | 5 | 0 / 0 / 0 |
| public.purchase_order_items | 8 | 8 | 8 | 0 / 0 / 0 |
| public.purchase_orders | 5 | 5 | 5 | 0 / 0 / 0 |
| public.suppliers | 3 | 3 | 3 | 0 / 0 / 0 |

Business stock quantities, captured prices, statuses and contact fields were compared in full without displaying them. Authentication verification includes all user columns (including password storage and staff/superuser/active flags), memberships, direct/group permissions, sessions, content types, admin history and migration history. No row differs.

## Schema and excluded scope

| Object | Compared | Result |
|---|---:|---|
| Visible column definitions | 64 | Match after excluding the explained physical ordinal gap |
| Constraints including primary/foreign/unique/check constraints | 42 | Exact definitions/state match |
| Indexes | 36 | Match |
| Sequences: definitions, table-column links, last_value/is_called | 13 each | Match; no nextval/setval on live |
| Extensions | 1 | Match |
| Noninternal triggers / views / row-security policies | 0 each | Match |
| Non-system functions / large objects | 0 each in source | None to restore |

Restore deliberately uses --no-owner --no-acl. PostgreSQL role identities, original object ownership, effective runtime GRANTs and database-level security/settings are not certified by these data comparisons. No explicit ACL entries were present in either archive TOC. Django auth_permission and its assignment tables ARE included and match; those are distinct from PostgreSQL privileges. A single-database pg_dump does not back up cluster-wide roles/passwords, server configuration, tablespaces or application secrets. Physical storage layout/OIDs and dropped slots are not expected to match a logical restore. Matching-locale restoration was tested separately; operating-system collation portability and original-owner/ACL restoration remain deployment concerns.

Sequence states are not MVCC snapshots; they were independently read and matched, and no sequence was advanced by this investigation. Any later legitimate live writes can make this point-in-time backup stale.

## Backup and restore evidence

- Original archive: database/backups/before-rbac-20261112T154319Z.backup. SHA256: `3ebbeb82fe34c8939f9b79416a0ff6b7d4bfd27a38d72c428891233f3a931bc5`.
- Fresh consistent archive: database/backups/investigation-consistent-20261112T154836Z.backup. Size: 40683 bytes. SHA256: `3175543f1d316c9488ccc6cfe05c5422df588f2230fe74b129ce7bcc6bfbf19f`.
- Fresh pg_dump: exit 0, warnings 0. Each of the three pg_restore replays: exit 0, warnings 0, --exit-on-error enabled. All expected tables and rows restored. The original failed attempt did not retain its temporary logs; the original archive was replayed successfully with new retained logs.
- Private dump/restore/TOC logs: backend/.runtime/backup-investigation-*.private.log. Sanitized machine-readable results: backend/.runtime/backup-investigation-results.json. Diagnostic implementation: backend/.runtime/investigate_backup.py. Backups and runtime artifacts are Git-ignored and may contain sensitive database content; no such row values are included here.

## Live preservation and conclusion

The final independent source transaction and the separate stopped-state verification match every historical live table fingerprint. Users, passwords, flags, direct permissions, group memberships, business data and migration history remain unchanged. Only Basic User still exists. No setup_roles --confirm, live migration, live restoration, user creation, database role change, commit or push was performed. Disposable clusters were stopped and removed after checking their unique temporary directory and distinct target database/port.

The original and fresh archives are verified for logical data recovery and the tested schema/sequence scope. The backup mismatch blocker is resolved. It is safe to reconsider the narrowly scoped live RBAC provisioning after a new read-only dry-run and preservation baseline; no permission to execute it is inferred from this investigation approval. A separate explicit approval is required before ANY live role writes. No production source change was needed; the diagnostic fingerprint methodology was corrected in the private investigation script.
