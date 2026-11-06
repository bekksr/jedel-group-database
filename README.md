# Jedel.Group ERP Supplier and Purchasing System

## Project Description

A five-student university project for managing suppliers, products, purchasing and stock receipts, using Angular, Django REST Framework and PostgreSQL.

## Database Management System

- DBMS: PostgreSQL
- Database: jedel_group_db
- Tool: pgAdmin 4

## Database Tables

- **Suppliers**: stores supplier information.
- **Purchase_Orders**: stores purchase orders.
- **Products**: stores product information and stock quantities.
- **Purchase_Order_Items**: connects purchase orders with products.

## Purchase Order Statuses

- Pending
- Approved
- Delivered
- Cancelled

## Team Members

- Bekarys
- Amir
- Aslan
- Kamshat
- Yerbolat

## Monorepo

See [Bekarys's System Analysis & Business Logic documentation](docs/bekarys/README.md) for business requirements, purchasing processes, lifecycle, traceability and acceptance analysis.

- `frontend/`: Angular standalone ERP with default API integration and a separate explicit demo option.
- `backend/`: Django REST API, scoped bearer access, unmanaged PostgreSQL models, atomic order/stock services, and isolated PostgreSQL tests.
- `database/`: unchanged team SQL dump, schema review, and migration policy.

Open `D:\BIS_project\jedel-group-database` directly in VS Code. The existing repository history and team credits are preserved; no additional Git repository was initialized.

See [frontend setup and features](frontend/README.md), [backend API, authentication, setup, and tests](backend/README.md), and [database integration policy](database/README.md).

The frontend now defaults to API mode. Connect in Settings using a server-provisioned read/write access token held only in browser memory. The API denies business access until server-side tokens are configured; a separate explicit demo option remains available. Database credentials are never supplied to Angular. Authenticated read-only connectivity and required columns in the existing four tables have now been verified; no non-internal business-table triggers were observed in the previous read-only inspection; deployment grants still need review. No existing database schema or records were changed.

## Local run (PowerShell)

Prerequisites: Node.js 24 LTS with npm 11, Python 3.13, and PostgreSQL 17 tools. Use two VS Code terminals. Do not run migrations or restore the SQL dump against the existing database. Django reads process environment variables; `.env` is not automatically loaded.

Backend terminal:

```powershell
cd D:\BIS_project\jedel-group-database\backend
# Fresh checkout only:
python -m venv .venv
& .venv/Scripts/python.exe -m pip install -r requirements.txt
$env:DJANGO_DEBUG = 'true'
$env:DB_NAME = 'jedel_group_db'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_USER = Read-Host 'PostgreSQL application role'
$dbPassword = Read-Host 'PostgreSQL password' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $dbPassword).Password
$env:ERP_READ_TOKEN = & .venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
$env:ERP_BUYER_TOKEN = & .venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
$env:ERP_APPROVER_TOKEN = & .venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
$env:ERP_WRITE_TOKEN = & .venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
& .venv/Scripts/python.exe manage.py check
& .venv/Scripts/python.exe manage.py runserver --skip-migration-check
```

Keep these generated tokens private. To copy a role credential on Windows, stop/restart the development server if necessary and run `Set-Clipboard -Value $env:ERP_BUYER_TOKEN` in the same terminal, or use the corresponding other role variable. Do not commit values or paste them into chat. Provision stable shared credentials securely when collaborating; random regeneration changes which tokens are accepted.

Frontend terminal:

```powershell
cd D:\BIS_project\jedel-group-database\frontend
npm ci
npm start
```

Open http://localhost:4200, choose Settings, enter a backend role token, and select Connect. Buyer creates suppliers/products/orders; Approver handles approve/deliver/cancel; Admin can do both and delete unreferenced records. Viewer is read-only. These are shared credential roles, not per-user login accounts.

If database credentials are unavailable, choose the explicitly labelled demo option in Settings. API mode never fabricates database results. The isolated PostgreSQL test suite can still run without application credentials via `backend/.venv/Scripts/python.exe backend/scripts/test_postgres.py` from repository root.

The [QA report](docs/QA_REPORT.md) lists verified behavior, remaining warnings, and browser/live-database verification gaps.

## Fixing API NOT CONNECTED

See [the secure connection launcher and diagnosis](docs/CONNECTION_SETUP.md). It prompts locally for the existing database credentials, provisions a role token in memory, verifies READ ONLY SQL and authenticated direct/proxied GETs, and never bypasses authentication. Authenticated read-only connectivity is now verified; credentials must still be supplied securely for each new backend process.

## PostgreSQL localized-error fix

See [the diagnosis, actual read-only results, and restart command](docs/POSTGRES_CONNECTION_FIX.md). An invalid ASCII-only password reproduced the driver decoding error; the fix provides a safe independent psql preflight and clears stale failed credentials. Correct credentials successfully authenticated with both clients.

## Pre-push verification

See [the pre-push audit](docs/PRE_PUSH_VERIFICATION.md) for current build/test results, publication inventory, security findings and the recommended feature-branch/PR commands. Never publish local credentials or unreviewed database backups. The existing SQL dump contains supplier contact records; the team must confirm they are approved educational data before further publication.
