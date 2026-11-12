# Existing PostgreSQL database

The API targets `jedel_group_db`. `dumps/jedel_group_db.sql` is the original team dump, relocated without content changes. Do not execute it against the populated database: it includes table creation, data COPY, and sequence statements.

The API uses manually reviewed unmanaged models. No migrations are run against the existing database. See [SCHEMA_REVIEW.md](SCHEMA_REVIEW.md) for source mappings, read-only inspection, and the live-verification limitation, and [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for the explicit future change policy.

Tests use a separate short-lived PostgreSQL cluster and schema-only DDL extracted from this dump; they do not access the existing application database.

Original SHA256: `80CADF870B4176072D681A4ACB438AF02FD52AC2CFA26FD1BAADCA3642641F09`.

## Account/session schema extension

Individual login requires additive Django auth, contenttypes, sessions and admin tables. This extension has been exercised only in disposable PostgreSQL; it has NOT been applied to jedel_group_db. Follow [the exact migration gate, table/column list, backup and rollback procedure](../docs/MIGRATION_APPROVAL.md).

For fresh isolated development, use [the development guide](../docs/DEVELOPMENT.md). init_development accepts only explicitly designated jedel_dev, extracts schema-only DDL into an empty database, and never imports historical records. Existing role/GRANT scripts remain unchanged. Application account groups do not replace PostgreSQL deployment roles.
