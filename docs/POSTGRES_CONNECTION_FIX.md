# PostgreSQL connection error: diagnosis and verified fix

Date: 6 November 2026. Target: PostgreSQL 17, `127.0.0.1:5432`, database `jedel_group_db`, existing role `postgres`.

## Confirmed cause

The reported `UnicodeDecodeError` was a secondary error while psycopg2 decoded a localized libpq connection error as UTF-8. It is not evidence that the password contains Unicode characters.

Controlled reproduction on this machine:

- With no password, psycopg2 raises OperationalError.
- With an intentionally invalid, **ASCII-only**, random password, psycopg2 raises UnicodeDecodeError during connect.
- The independent PostgreSQL 17.6 `psql` client receives a **CP1251** localized authentication-rejection message, not a UTF-8 message. Message text and credentials were not logged.
- `client_encoding=UTF8` and startup `options=-c client_encoding=UTF8` do not fix this pre-connection failure.
- Python's preferred Windows encoding is CP1251. LANG/LC_ALL were C.UTF-8; changing Python console output does not repair a server startup message that is being decoded inside the driver.
- psycopg2 2.9.10 bundles libpq 16.4 here. Installed psql is 17.6. This difference does not itself prevent connection to PostgreSQL 17: authenticated psql and Django queries both succeeded with valid local credential entry. No dependency change was needed.
- A synthetic SecureString -> process environment -> Python SHA-256 equality check, plus psycopg2 parameter round-trip, preserved special/non-ASCII characters exactly. Only booleans were printed, not values/hashes. Passwords must not be trimmed or re-encoded manually.

Upstream describes [localized connection errors masking the real error](https://github.com/psycopg/psycopg2/issues/1816). This investigation independently reproduced the failure rather than assuming the password was Unicode or blindly setting client encoding.

The launcher also retained a failed password in its terminal environment. Windows PowerShell can turn native stderr into a terminating error before LASTEXITCODE is checked, skipping cleanup. This was reproduced and fixed with a catch/finally-safe cleanup path. The actual password used in the earlier failing user terminal was not inspected; we do not claim to know its characters or exact value.

## Small safe changes

- Django's default host is now 127.0.0.1. Only public connection fields are trimmed; the password is preserved exactly.
- Local launcher targets jedel_group_db / 127.0.0.1 / 5432 and defaults an absent username to postgres as requested. Conflicting host/port values produce an error rather than selecting an unintended server.
- An independent `psql --no-password` preflight receives the password only through its child environment. It runs a fixed BEGIN READ ONLY / SELECT / ROLLBACK query. No credentials appear in command arguments, source, output, or files.
- Localized client stderr is captured as bytes and classified without printing it. Authentication rejection, missing database, unreachable service, and unavailable client remain distinct outcomes. None are converted into fake success.
- Django's verification command catches UnicodeDecodeError separately from DatabaseError and uses the independent psql result to expose a safe actionable cause.
- Failed preflight/Django verification clears the cached DB_PASSWORD even when Windows PowerShell terminates on native stderr. The next run requests a password again.
- No pg_hba.conf, locale/server configuration, authentication policy, database encoding, schema, data, sequences, or dependencies were changed.

## Actual verification

Credentials were entered through a secure local prompt and never printed or saved. Both independent psql and Django successfully authenticated to the **existing** jedel_group_db and ran read-only queries.

| Existing table       | Verified row count |
| -------------------- | ------------------ |
| suppliers            | 3                  |
| products             | 5                  |
| purchase_orders      | 3                  |
| purchase_order_items | 6                  |

Django verified all required columns, confirmed transaction_read_only=on, and rolled back the verification transaction. Counts are actual query results, not values inferred from the dump. This verifies connectivity and the required table columns, not every production grant/trigger or future write operation.

Additional checks:

- Django system checks: no issues.
- PowerShell launcher syntax: passed.
- Intentional invalid-credential launch: safely rejected, no raw driver traceback, cached password cleared=True.
- Connection diagnostics: **12 tests passed** against a disposable PostgreSQL cluster, including independent psql authentication, read-only SQL, localized error handling, password not passed on command line, and no false success. The existing database was never used for destructive tests.
- Preserved SQL dump SHA256 remains `80CADF870B4176072D681A4ACB438AF02FD52AC2CFA26FD1BAADCA3642641F09`.

## Restart from VS Code PowerShell

The password from the secure verification prompt was intentionally not persisted. In your local terminal:

```powershell
cd D:\BIS_project\jedel-group-database\backend
$env:DB_NAME = 'jedel_group_db'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_USER = 'postgres'
Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
& .\scripts\start-development.ps1 -Role viewer -CopyToken
```

Enter the existing password in the hidden terminal prompt. To use a Windows dialog instead, add `-CredentialDialog`. Stop any existing Django instance on port 8000 first. The launcher verifies psql and Django before starting a server; no migrations or dump restore are part of setup.

Keep Angular running at http://localhost:4200 for the launcher's proxied HTTP checks. After successful verification, paste only the locally copied token into Settings -> Connect. Viewer loads data but cannot modify it; explicitly select Buyer/Approver/Admin only when that operation scope is intended. The database verification used DatabaseOnly, so it did not start Django or verify browser/API writes in this task.

Independent checks, after configuring credentials in the same terminal:

```powershell
$env:DJANGO_DEBUG = 'true'
& .venv/Scripts/python.exe manage.py check
& .venv/Scripts/python.exe manage.py verify_connection --psql-only
& .venv/Scripts/python.exe manage.py verify_connection --database-only
```

A rejected password should now produce a sanitized authentication error and re-entry prompt on the next run, not an unhandled UnicodeDecodeError. Do not reset the database, change trust authentication, or assume client encoding is a substitute for valid credentials.
