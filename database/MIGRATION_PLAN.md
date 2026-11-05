# Migration policy and future plan

## Current release

No migrations are created for the four existing business tables. Their Django models are unmanaged. No migrations, restores, schema edits, sequence resets, or data rewrites are run against `jedel_group_db`. Shared role-scoped API tokens are environment-based and do not require auth tables or migrations.

Django auth/contenttypes are installed for future integration, but this API does not query their tables for authentication. Do not run `manage.py migrate` as an installation step. The test runner may migrate these apps only in its independently guarded, disposable PostgreSQL database.

## Future changes require a separate review

1. Inspect the live schema, constraints, indexes, triggers, owners, grants, identity sequences, and authentication tables in a read-only session.
2. Agree on one schema owner and decide whether legacy tables remain unmanaged. Back up the database and verify a restore on a disposable instance.
3. For per-user authentication, prepare an explicit additive plan listing the auth/contenttypes/session/token tables actually needed. Review generated SQL and table-name conflicts before applying anything. Do not create replacement business tables.
4. Extend the implemented shared Buyer/Approver credential separation to named accounts, token/session lifecycle, audit events, and individual permission tests. No per-user identities are claimed in this release.
5. Review schema additions such as receipts, stock ledger, idempotency keys, audit history, or indexes independently, with staged validation and a rollback/data-recovery plan.
6. Obtain explicit approval for the concrete migration plan before running it on the existing database. Use a role with DDL privileges only for that approved operation; the API role should have DML privileges only.

Existing constraints and team SQL remain authoritative until this process explicitly changes them.
