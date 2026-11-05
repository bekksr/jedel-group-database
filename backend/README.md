# Jedel.Group ERP REST API

Django 6.0.10 / DRF / PostgreSQL 17, using the existing `jedel_group_db` database. No business schema migrations are provided or required. All four business models use `managed = False`.

## Local setup (PowerShell / VS Code)

Open the existing team repository. Use Python 3.13 and PostgreSQL client/server tools 17.

```powershell
cd D:\BIS_project\jedel-group-database\backend
# For a fresh checkout only:
python -m venv .venv
& .venv/Scripts/python.exe -m pip install -r requirements.txt
```

Set real database credentials in the current terminal. `backend/.env.example` documents supported variables, but Django does not automatically load `.env`. VS Code may supply a private env file to its debugger instead.

```powershell
$env:DB_NAME = 'jedel_group_db'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_USER = Read-Host 'PostgreSQL application role'
$dbPassword = Read-Host 'PostgreSQL password' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $dbPassword).Password
$env:DJANGO_DEBUG = 'true'
# Generates credentials in this terminal; no values are stored in source.
$env:ERP_READ_TOKEN = & .venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
$env:ERP_WRITE_TOKEN = & .venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
& .venv/Scripts/python.exe manage.py check
& .venv/Scripts/python.exe manage.py runserver --skip-migration-check
```

The development-only `--skip-migration-check` option skips migration-history queries, not Django system checks or business database access. No migrations should be run against `jedel_group_db` during setup. `GET /api/health/` is public process liveness and reports `database: not_checked`. Missing database access produces a sanitized 503 on authorized business requests.

Use a restricted database role with DML access to the four business tables and usage of their identity sequences. Do not run the API as `postgres` or grant schema DDL privileges. Real database roles and credentials must be provisioned securely by the database owner; none are created here. Configure `DB_SSLMODE=verify-full` plus `PGSSLROOTCERT` for remote PostgreSQL where applicable.

## Authentication and server-enforced credential roles

The Settings connection form accepts a server-provisioned bearer token held only in memory. Every business request supplies `Authorization: Bearer <token>`. No credentials are bundled in Angular, stored in browser local storage, or read from a cookie. A failed connection never falls back to demo data.

| Environment credential | Role     | Read | Create/update catalogs | Create/amend orders | Approve/deliver/cancel | Delete unreferenced records |
| ---------------------- | -------- | ---- | ---------------------- | ------------------- | ---------------------- | --------------------------- |
| ERP_READ_TOKEN         | Viewer   | Yes  | No                     | No                  | No                     | No                          |
| ERP_BUYER_TOKEN        | Buyer    | Yes  | Yes                    | Yes                 | No                     | No                          |
| ERP_APPROVER_TOKEN     | Approver | Yes  | No                     | No                  | Yes                    | No                          |
| ERP_WRITE_TOKEN        | Admin    | Yes  | Yes                    | Yes                 | Yes                    | Yes                         |

All configured tokens must be distinct, contain at least 32 characters, and have no whitespace. Empty credentials grant no access. Existing read/write token names remain compatible; the write token maps to Admin. Optional additional development credentials can be generated without changing database tables:

```powershell
$env:ERP_BUYER_TOKEN = & .venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
$env:ERP_APPROVER_TOKEN = & .venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

GET `/api/access/` returns the authenticated role and operation capabilities, never token contents. Angular uses these only for appropriate affordances; Django independently enforces every operation. Supplying a role in a request body cannot elevate access. Missing/invalid credentials return 401; a valid but insufficient role returns 403. Unsupported methods on authenticated requests return 405.

This is a minimal authentication flow with **shared credential roles**, not named user accounts. Per-person login, password recovery, token issuance/expiry, automatic revocation, immutable audit logs, and individual approval accountability are not implemented. There is no claim of per-user separation of duties: someone holding multiple shared credentials could use multiple roles. Rotate credentials through the backend environment and use HTTPS outside isolated local development.

CSRF/CORS: the API authenticates only explicit bearer headers, not cookies or Django sessions, so there is no ambient session credential to protect with a CSRF token. Tests with CSRF enforcement verify authenticated requests and anonymous denial. CSRF middleware remains installed for future session features; adding cookie authentication requires a separate CSRF design. Local Angular CORS origins and Authorization header preflight are allowed; other origins receive no permission header. `CORS_ALLOW_CREDENTIALS=False`. CORS is not authorization.

API responses have `Cache-Control: no-store, private` and `Vary: Authorization`. Clickjacking is denied. The JSON parser limits actual bytes to 1 MiB even without a trusted Content-Length; configure matching reverse-proxy request size/time limits for deployment.

### Production configuration

DEBUG now defaults to **false** and a private `DJANGO_SECRET_KEY` is mandatory. Local HTTP development must explicitly set `DJANGO_DEBUG=true`. Outside local development use a stable random secret, HTTPS, restricted hosts/origins, a least-privilege database role, and a reviewed reverse proxy. Production enables HTTPS redirects, secure cookie flags, and HSTS. `DJANGO_HSTS_INCLUDE_SUBDOMAINS` and `DJANGO_HSTS_PRELOAD` remain false until domain ownership and HTTPS support for all affected subdomains are verified. `manage.py check --deploy` reports security.W005 and security.W021 under these defaults; do not silence or blindly enable them.

Example request in a configured PowerShell terminal:

```powershell
$headers = @{ Authorization = "Bearer $env:ERP_READ_TOKEN" }
Invoke-RestMethod http://127.0.0.1:8000/api/suppliers/ -Headers $headers
```

## Routes

Canonical base: `/api/`. `/api/v1/` exposes the same routes as a compatibility alias.

| Path                                | Methods            | Description                                                                                                                  |
| ----------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `/api/health/`                      | GET                | Public process liveness; no database query                                                                                   |
| `/api/access/`                      | GET                | Authenticated credential scope; returns can_write/role/capabilities/authentication/role_based_security, never token contents |
| `/api/dashboard/`                   | GET                | Counts, purchasing/delivered values, recent orders, status/supplier aggregates, stock overview                               |
| `/api/suppliers/`                   | GET, POST          | List/create supplier                                                                                                         |
| `/api/suppliers/{id}/`              | GET, PATCH, DELETE | Retrieve/update/delete supplier                                                                                              |
| `/api/products/`                    | GET, POST          | List/create product                                                                                                          |
| `/api/products/{id}/`               | GET, PATCH, DELETE | Retrieve/update/delete product                                                                                               |
| `/api/orders/`                      | GET, POST          | List/create order and nested items                                                                                           |
| `/api/orders/{id}/`                 | GET, PATCH         | Retrieve/amend Pending order                                                                                                 |
| `/api/orders/{id}/approve/`         | POST               | Pending ? Approved                                                                                                           |
| `/api/orders/{id}/deliver/`         | POST               | Approved ? Delivered, with full stock receipt                                                                                |
| `/api/orders/{id}/cancel/`          | POST               | Pending/Approved ? Cancelled                                                                                                 |
| `/api/analytics/supplier-spending/` | GET                | Non-cancelled order values/counts per supplier                                                                               |
| `/api/analytics/order-status/`      | GET                | Counts for all four statuses, including zeros                                                                                |

Resource lists return `{count, next, previous, results}` with 25 rows per page; use `?page=2`. Search uses `?search=...`:

- Suppliers: name, email, phone, address. Ordering: supplier_id, supplier_name, email, address.
- Products: name/category, optional `?category=Electronics`. Ordering: product_id, product_name, unit_price, stock_quantity.
- Orders: supplier name or numeric order ID, optional `?status=Approved`. Ordering: order_id, order_date, expected_delivery_date, status.

Ordering uses `?ordering=-order_date`. Unsupported ordering fields are ignored by DRF. Dashboard accepts `?low_stock_threshold=20` (inclusive). All statuses use exact title case: Pending, Approved, Delivered, Cancelled.

## Payloads and validation

All request bodies are JSON. Unknown/read-only input keys are rejected rather than silently accepted. IDs are generated by the existing PostgreSQL `GENERATED ALWAYS AS IDENTITY` columns and cannot be provided by clients.

Supplier create:

```json
{
  "supplier_name": "Entered by user",
  "email": "contact@example.test",
  "phone": "",
  "address": ""
}
```

Names and email are required strings, maximum 100 characters; non-string coercion and blank/whitespace-only input are rejected. Phone is optional (20). Address accepts optional text up to 255 characters after trimming: omission on create, null, or exact empty string stores SQL NULL; omission on PATCH preserves the current value. Nonempty whitespace-only addresses and non-string/non-null values return 400. Emails are validated, normalized to lowercase and checked case-insensitively by the API. The original database UNIQUE constraint remains unchanged and case-sensitive; concurrent normalized API inserts are still protected by that constraint. Legacy mixed-case races/direct SQL writers require a future reviewed case-insensitive uniqueness constraint. Existing records are never normalized in bulk.

Product create:

```json
{
  "product_name": "Entered by user",
  "category": "Accessories",
  "unit_price": "12000.00"
}
```

Product name is required (100), category optional (50). Price is nonnegative, at most `99999999.99` with two decimal places. `stock_quantity` is read-only; new products start at zero. Supplier deletion is blocked when referenced by orders. Products cannot be deleted when referenced by items or when their stock is nonzero.

Order create:

```json
{
  "supplier_id": 1,
  "order_date": "2026-11-06",
  "expected_delivery_date": "2026-11-10",
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 2, "quantity": 3, "unit_price": "85000.00" }
  ]
}
```

IDs here are illustrative: select IDs that actually exist. `order_date` defaults to the application's local date. Expected delivery may be omitted/null but cannot precede the order date. Each order requires 1?500 items, existing supplier/products, positive 32-bit integer quantities, unique products, and nonnegative item prices with two decimal places. An omitted item price snapshots the current catalog price; a supplied price represents an explicit purchase price. Financial calculations use Decimal and prices/totals serialize as decimal **strings**, not floats.

New orders always start Pending. `PATCH /api/orders/{id}/` allows supplier, dates, and/or complete replacement of the item list only while Pending. Retained products keep their captured prices unless an explicit purchase-price amendment is supplied. New product lines use current catalog prices. `status`, IDs, stock, and computed totals are not editable. Status action POSTs accept no body or an empty JSON object `{}`. Delivered/Cancelled orders are terminal and cannot be amended or reopened. Order deletion and PUT are not supported.

Order responses include supplier_id/name, dates, status, nested items with captured price and line_total, and a calculated total. The dashboard and supplier spending exclude Cancelled orders from value totals. These amounts are **order values, not invoices or payments**. Reports do not fabricate data or write inventory.

## Transaction and concurrency guarantees

- Creation validates references, duplicate products, quantities, prices, and dates before writes. Order and items commit in one `transaction.atomic` block.
- Pending amendments lock the order and atomically replace items, with rollback on failure.
- Approval/cancellation/delivery re-read and lock the order with `select_for_update()` before validating its current status.
- Delivery locks affected products in primary-key order, checks 32-bit overflow, and increments stock with database `F()` expressions.
- Both stock increments and final status commit together. Any failed update or status save rolls everything back.
- Two delivery attempts on the same order have one winner; the other returns 409. Different orders sharing products do not lose increments.
- Cancellation racing delivery has one winner. Cancelled orders never receive inventory.
- Catalog updates refresh the product under a row lock so a stale instance cannot overwrite recently delivered stock.
- Historical Delivered orders are not replayed during startup or reads. There is no partial receiving or stock ledger in the current schema.

Errors: 400 validation (including unknown status filters and PostgreSQL input NOT NULL/FK/UNIQUE/CHECK violations), 401 authentication, 403 role, 404 absent record, 405 unsupported method, 409 protected deletion/status conflict or other integrity conflict, 413 oversized request, 415 unsupported media type, 503 database failure. Unexpected failures return a generic 500. SQL, database connection details, and credentials are not returned. If a connection fails after a commit, inspect current state before retrying; order creation does not yet have a client idempotency key.

## Safe testing

```powershell
cd D:\BIS_project\jedel-group-database\backend
$env:DJANGO_DEBUG = 'true'
& .venv/Scripts/python.exe manage.py check
& .venv/Scripts/python.exe -m pip check
& .venv/Scripts/python.exe scripts/test_postgres.py
```

The helper locates PostgreSQL 17 under Program Files; alternatively set `PG_BIN` to a bin directory containing initdb and pg_ctl. It creates a fresh temporary cluster, binds only to 127.0.0.1 on an available port, generates an in-memory test password, and runs Django tests against `test_jedel_api`. It stops the cluster and removes temporary files afterward. It never uses the existing service on port 5432 or application DB credentials. PostgreSQL processes require local process/network permission; no Docker, SQLite, or external Python test dependency is needed.

The test runner refuses database creation/teardown without the isolated-server marker, loopback host, separate port, explicit flag, and safe test name. The temporary database receives only schema DDL extracted from the original dump, including identity and constraint definitions. No sample company records are loaded. Any Django auth/contenttypes migrations in test output affect **only this disposable test database**. Unmanaged business tables are created only by this isolated test bootstrap and never by application migrations.

Database-free tests can run without credentials:

```powershell
& .venv/Scripts/python.exe manage.py test apps.purchasing.tests.ApiFoundationTests apps.purchasing.tests.ApiAccessTests
```

Tests cover CRUD, required fields, unknown/read-only keys, filtering/pagination, Decimal totals, saved prices, status rules, invalid references, uniqueness/CHECK/identity constraints, transaction rollback after partial inserts/stock updates, stock overflow, auth scopes, sanitized failures, and real concurrent API calls over separate PostgreSQL connections. `inspectdb` is exercised against the isolated schema to cross-check mappings. Never point destructive tests at `jedel_group_db` or any production database.

## Live database verification and schema ownership

Latest verification: independent psql and Django authenticated to jedel_group_db at 127.0.0.1:5432 and verified the required columns/read-only row counts (3 suppliers, 5 products, 3 orders, 6 items). `manage.py inspect_data_quality` additionally inspected actual nullability, identity columns, constraints and non-internal triggers: 16 NOT NULL columns, four identity primary keys, 15 named constraints and no non-internal triggers on the business tables. See [Amir's validation and stock report](../docs/amir-data-validation-and-stock-updates.md) for rules, SQL checks, T01–T20 results and demonstration instructions. This point-in-time inspection does not establish full schema equivalence or verify deployment grants. Do not overwrite reviewed models with generated output.

See `database/MIGRATION_PLAN.md`: no current business-schema migration is authorized. The original dump is preserved unchanged. Do not restore it over the existing database or run `migrate` as a setup shortcut.

## Frontend integration verification

Angular now has an API-backed workspace adapter, environment-based base URL, memory-only token entry, and explicit demo isolation. The isolated test suite includes a complete authenticated HTTP-handler purchasing flow: create a supplier, create a zero-stock product, create an order with items, approve, deliver, verify stock, and reject repeat delivery. This is an API-level test using DRF APIClient and real isolated PostgreSQL, not a browser automation run. Actual read-only access, required columns, business constraints and trigger presence in the existing `jedel_group_db` are verified; deployment grants and live write workflows remain unverified.

## QA review

See [the verification report](../docs/QA_REPORT.md) and [Amir's latest assignment report](../docs/amir-data-validation-and-stock-updates.md). Django was upgraded from 6.0.3 to the supported 6.0.10 security patch without running migrations against the existing database. The suite includes server-side role authorization, cookie-free CSRF boundaries, CORS preflight, request-size limits, cache headers, and fail-closed production configuration in addition to the purchasing tests. Named-user accounts and deployment grant review remain outstanding.

## Fixing API NOT CONNECTED

See [the secure connection launcher and diagnosis](../docs/CONNECTION_SETUP.md). It prompts locally for the existing database credentials, provisions a role token in memory, verifies READ ONLY SQL and authenticated direct/proxied GETs, and never bypasses authentication. Authenticated read-only connectivity is now verified; credentials must still be supplied securely for each new backend process.

## PostgreSQL localized-error fix

See [the diagnosis, actual read-only results, and restart command](../docs/POSTGRES_CONNECTION_FIX.md). An invalid ASCII-only password reproduced the driver decoding error; the fix provides a safe independent psql preflight and clears stale failed credentials. Correct credentials successfully authenticated with both clients.
