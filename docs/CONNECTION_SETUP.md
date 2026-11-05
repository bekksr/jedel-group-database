# Connect the existing database without bypassing authentication

Latest update: authenticated psql and Django read-only queries now succeed against the existing database. See [the localized-error diagnosis and verified fix](POSTGRES_CONNECTION_FIX.md). The failed/cancelled results below describe the earlier session, not the latest connectivity result.

## Diagnosed cause

The frontend already uses `WorkspaceDataService` -> `ApiDataService`, base `/api`, and a proxy to `http://127.0.0.1:8000`. All required resources are mapped. No URL, route, proxy, or CORS change was needed.

The running development backend was started without `DB_USER`, `DB_PASSWORD`, or any `ERP_*_TOKEN`. Angular also starts with no token in browser memory. These are two independent configuration blockers:

1. Missing/invalid bearer credentials return 401 before database queries.
2. After a valid token is configured, missing PostgreSQL credentials make database-backed GETs return 503.

The project uses custom **shared, environment-provisioned bearer credentials** with Viewer/Buyer/Approver/Admin roles. It does not use JWT, DRF database tokens, or a token-generation/login endpoint. `DJANGO_SECRET_KEY` and the PostgreSQL password are not API bearer tokens.

## Verified results in this session

- Direct and proxied `/api/health/`: 200. Health explicitly says `database: not_checked`.
- Direct and proxied unauthenticated `/api/access/` and `/api/dashboard/`: 401.
- PostgreSQL localhost:5432 accepts connections, but the attempted READ ONLY SQL session failed before executing SQL because no password was supplied.
- A secure credential dialog was requested but cancelled; the existing database's schema/counts could not be verified.
- A separate short-lived Django process was provisioned with a cryptographically random Viewer token in process memory. Real GETs returned 401 without credentials, 401 with an invalid token, and 200 for authenticated `/api/access/` with role viewer. All six database-backed business/report GETs returned 503 because database credentials remained missing. The temporary process was stopped; its token was not printed, saved, or used to claim a database connection.
- Django system checks and Angular production build passed. Four non-database diagnostic tests passed; all five diagnostic tests (including a READ ONLY four-table check) passed on a disposable PostgreSQL cluster. This does not verify the existing live database.
- Browser automation is unavailable. No browser connection is claimed.

## Exact local setup

Keep Angular running in one VS Code PowerShell terminal:

```powershell
cd D:\BIS_project\jedel-group-database\frontend
npm start -- --host 127.0.0.1
```

Stop the old, unconfigured Django development instance first. In a new VS Code PowerShell terminal:

```powershell
cd D:\BIS_project\jedel-group-database\backend
& .\scripts\start-development.ps1 -Role viewer -CopyToken
```

The script prompts for your **existing PostgreSQL role and password** locally. The password is hidden. Do not send either the password or the API token through chat. If script execution is blocked on your Windows installation, use a process-only execution policy without changing the machine/user policy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-development.ps1 -Role viewer -CopyToken
```

The launcher:

1. Uses the existing `.venv`; no dependency install, migrations, or database restore occurs.
2. Sets local development DEBUG explicitly and targets the existing `jedel_group_db`.
3. Reuses the selected role token from this terminal's environment or generates a distinct cryptographically random token if absent. Nothing is hardcoded or written to `.env`.
4. Runs Django checks and `verify_connection --database-only`, which enforces a READ ONLY transaction, checks all four tables' required columns, reads row counts, and rolls back. Missing credentials/schema/privileges fail safely without starting a replacement server.
5. Starts Django hidden on 127.0.0.1:8000 with the same credentials inherited in process memory. It will not kill an unrelated process or silently change ports. If port 8000 remains occupied, stop the old development instance and rerun in the same terminal.
6. Verifies anonymous/invalid token rejection and actual authenticated GETs for access, dashboard, suppliers, products, orders, and both analytics endpoints, directly and through Angular's proxy. Redirects are not followed with credentials; only loopback targets are accepted. Responses containing business records and token values are not printed.
7. Copies the selected API token to your **local clipboard only** when `-CopyToken` was explicitly requested. It prints the process PID, status metadata, and table counts, never passwords/tokens.

Open http://localhost:4200 -> Settings -> remain in API mode -> paste the clipboard contents into Bearer access token -> Connect. Paste just the token, without the word `Bearer`. A successful load must show API MODE and actual rows/counts. Zero rows can be a legitimate live database result; sample records are never substituted.

Viewer can read every page but cannot edit. For full administration, explicitly choose `-Role admin`; for narrower writes use `buyer` or `approver`. Restart the backend with the desired configured role and paste that role's token into Settings. Server authorization remains enforced. No business write is performed by the launcher's verification.

Runtime logs are ignored under `backend/.runtime/`. The script prints the Django PID; stop only that process when needed with `Stop-Process -Id <printed-PID>`. The backend runs without autoreload, so restart it after backend code changes. Angular continues to watch frontend changes.

### Read-only checks without starting a server

```powershell
& .\scripts\start-development.ps1 -Role viewer -DatabaseOnly
```

For a Windows credential dialog, add `-CredentialDialog`; this always requests credentials again, even when the terminal already has values. To re-enter a password in the hidden terminal prompt, clear only the terminal's old password first:

```powershell
Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
& .\scripts\start-development.ps1 -Role viewer -CopyToken
```

If environment credentials/tokens are already configured in the same terminal, commands can be run independently:

```powershell
$env:DJANGO_DEBUG = 'true'
& .venv/Scripts/python.exe manage.py check
& .venv/Scripts/python.exe manage.py verify_connection --database-only
& .venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000 --noreload --skip-migration-check
# Separate terminal with the SAME private environment values:
& .venv/Scripts/python.exe manage.py verify_connection --http-only --role viewer
```

Environment variables in a new terminal are not automatically inherited from another existing terminal. This is why the launcher provisions credentials, starts Django, and tests requests from one process environment. Refreshing the browser clears its token; reconnect with a currently accepted token. Restarting with newly generated credentials invalidates old clipboard/browser credentials.

## Remaining prerequisite

A valid existing PostgreSQL username/password and sufficient SELECT privileges are still needed to verify this installation. Do not modify pg_hba.conf to trust all clients, disable authentication, reset passwords/databases, create replacement tables, restore the dump, or run migrations as a shortcut. Check live triggers/schema/grants before enabling real inventory writes. The preserved dump and isolated test results are not a substitute for a live read-only check.

## Current handoff state

The previously agent-started, unconfigured Django instance was stopped to free port 8000 for this launcher. Angular remains running at http://localhost:4200 (HTTP 200 verified). Until you run the launcher with valid local database credentials, the backend is not listening and API mode cannot load business data. This is an explicit configuration prerequisite, not a successful connection.

Files changed in this fix: `.gitignore`, root `README.md`, `backend/README.md`, `backend/scripts/start-development.ps1`, `backend/scripts/check_authentication.py`, `backend/apps/purchasing/management/commands/verify_connection.py`, `backend/apps/purchasing/test_connection_diagnostics.py`, and this document. Angular services, environment URLs, proxy, CORS rules, authentication, and role permissions did not require changes and were preserved.
