# Amir — data validation and automated stock updates

## Responsibilities and scope

Amir's assigned work covers supplier UNIQUE/NOT NULL rules, email/address validation, product and order data quality, backend integration, and safe automated stock receipts. This report distinguishes existing functionality retained after review from new changes and actual verification on 6 November 2026.

New work: strict text/email input fields, a documented optional-address policy, safe HTTP 400 mapping for PostgreSQL input constraint failures, clearer stock write rejection, read-only live constraint inspection, and named T01–T20 acceptance tests plus supporting regressions. The existing atomic order/delivery service, CRUD endpoints, authentication, and roles were reused and tested rather than replaced by a second delivery implementation.

No live business records, constraints, tables, or migrations were changed. The original SQL dump remains preserved in `database/dumps/jedel_group_db.sql`. Business models remain `managed=False`.

## Actual existing PostgreSQL constraints

Authenticated independent `psql` and Django read-only queries succeeded against `jedel_group_db` at `127.0.0.1:5432`. The new `inspect_data_quality` command queried PostgreSQL catalogs, rather than assuming the dump describes the current database.

| Table | Required columns | Nullable columns | Constraints inspected |
| --- | --- | --- | --- |
| suppliers | supplier_id, supplier_name, email | phone, address | PK supplier_id; UNIQUE(email) |
| products | product_id, product_name, unit_price, stock_quantity | category | PK product_id; price >= 0; stock >= 0 |
| purchase_orders | order_id, supplier_id, order_date, status | expected_delivery_date | PK order_id; supplier FK; allowed status CHECK; expected delivery NULL or >= order_date |
| purchase_order_items | item_id, order_id, product_id, quantity, unit_price | none | PK item_id; order/product FKs; UNIQUE(order_id, product_id); quantity > 0; price >= 0 |

All four primary keys are integer `GENERATED ALWAYS AS IDENTITY`. There are 20 columns, 16 NOT NULL attributes, and 15 named constraints: four PKs, three FKs, two UNIQUE constraints, and six CHECK constraints. Existing identity behavior and FK definitions were preserved without alteration.

Relevant names: `suppliers_email_key`, `uq_order_product`, `products_unit_price_check`, `products_stock_quantity_check`, `purchase_order_items_quantity_check`, `purchase_order_items_unit_price_check`, `chk_delivery_date`, `purchase_orders_status_check`, `fk_purchase_order_supplier`, `fk_item_order`, and `fk_item_product`.

Lengths: supplier name/email 100, phone 20, address 255; product name 100/category 50; status 30. Prices are `numeric(10,2)`; quantities and stock are PostgreSQL integers.

Live read-only observations:

- 3 suppliers, 5 products, 3 orders, 6 order items.
- Order states: one Approved and two Delivered. Total current stock: 132 units.
- Zero missing/ordinary-space-only supplier names/emails, zero case-insensitive duplicate email groups, and zero ordinary-space-only nonempty addresses in these queries.
- No non-internal triggers on these four tables. No competing database stock trigger was observed.

These are point-in-time observations. The SQL `btrim` quality counts check ordinary spaces, not every Unicode whitespace character. API validation uses Python string whitespace handling. No personal record contents or credentials are included in this report.

## Validation policy

| Input | API policy |
| --- | --- |
| supplier_name | Required string; trimmed; nonempty; max 100; missing, null, numeric, boolean, collections and whitespace-only input rejected |
| email | Required string; valid DRF email format; trimmed/lowercased; max 100; case-insensitive duplicate lookup, excluding the same supplier on PATCH |
| address | Optional string or null; trimmed nonempty value max 255; see exact absence policy below |
| product_name | Required nonblank trimmed string, max 100; no numeric/boolean coercion |
| category | Optional string/null/blank, max 50 |
| catalog/item price | Decimal, nonnegative, max 99999999.99, at most two decimal places |
| stock_quantity | Read-only in catalog API; all attempted writes, including negative values, rejected; new products start at zero; DB CHECK also rejects negative stock |
| quantity | Positive whole number, max 2147483647; zero/negative values rejected |
| supplier_id/product_id | Must reference existing records; unknown IDs produce HTTP 400 when submitted in order data |
| items | Required nonempty list, max 500; one entry per product per order |
| dates | Valid date input; optional/null expected_delivery_date must not precede order_date |

Address absence policy is consistent for POST and PATCH:

- Omitted on POST: stored as SQL NULL. Omitted on PATCH: existing address preserved.
- Explicit `null` or exact empty string `""`: clear to SQL NULL.
- Nonempty whitespace-only string (spaces, tabs, newlines, etc.): reject with HTTP 400; do not silently erase the address.
- Valid text: trim surrounding whitespace and enforce 255 characters on the resulting text. Internal whitespace and multiline text are permitted.
- Numbers, booleans, arrays, and objects: HTTP 400. No external address verification or claim of postal deliverability.

Existing records are not normalized in bulk. Email format validation does not verify mailbox ownership or deliverability.

### Database as final integrity authority

The API provides helpful early validation; existing PostgreSQL UNIQUE, NOT NULL, FK, identity and CHECK constraints still enforce their rules if API checks race or are bypassed. Tests execute real invalid SQL updates/inserts in the disposable database to verify constraint enforcement.

The existing UNIQUE(email) is case-sensitive. API writes normalize email to lowercase and check case-insensitively, so two concurrent new normalized API inserts are protected by the existing UNIQUE constraint. A race involving a legacy mixed-case email or a separate direct-SQL writer can still create case variants because there is no case-insensitive unique index. A future reviewed migration to a unique expression index on `lower(email)` or `citext` requires prior duplicate cleanup and explicit approval; none was performed here. Database NOT NULL alone also permits empty strings; email format and nonblank text remain API rules.

## Single delivery workflow

`apps/purchasing/services.py::transition_order` is the single reusable status/delivery operation. Views never independently increment inventory.

1. Enter `transaction.atomic()` and lock the purchase order using `select_for_update()`.
2. Validate transition: Pending -> Approved or Cancelled; Approved -> Delivered or Cancelled. Delivered and Cancelled are terminal. An empty order cannot be approved/delivered.
3. For delivery, read its captured order items and lock all affected products in primary-key order, avoiding inconsistent product lock ordering across concurrent orders.
4. Check product presence, positive quantities and 32-bit stock overflow before updates.
5. Increment stock using database-side `F('stock_quantity') + quantity` with a guarded update and affected-row check.
6. Save Delivered status in the same transaction. Any error rolls back every stock change and status change.

Two callers delivering the same order serialize on the order lock. The second reads Delivered and receives HTTP 409 without inventory changes. Concurrent different orders sharing products retain both increments. Cancellation never increments inventory. Cancellation racing delivery has one terminal winner.

Creating an order also uses one atomic transaction, locks/validates references, validates all items, and rolls back the parent and all items on failure. Decimal item prices are snapshots: changing the catalog price does not change historical line prices/totals. Pending amendments preserve retained prices unless a purchase-price change is explicitly submitted. Approved/final orders cannot be amended.

### Existing deliveries must not be replayed

The live database already contains two Delivered orders. There is no receipt ledger/opening-balance history proving when or how their quantities entered stock. Neither startup, GET requests, inspection nor this change replays them. Re-delivery returns 409. Do not reset their status or reconcile stock automatically from order totals. Manual database writers can bypass application locks/status policy; restrict write privileges and use the service for receipts. A future receipt ledger/audit design requires a separate approved schema plan.

## API behavior and authorization

Existing conventions retained:

| Endpoint | Actions |
| --- | --- |
| /api/suppliers/ | GET, POST |
| /api/suppliers/{id}/ | GET, PATCH, DELETE |
| /api/products/ | GET, POST |
| /api/products/{id}/ | GET, PATCH, DELETE |
| /api/orders/ | GET, POST atomic nested creation |
| /api/orders/{id}/ | GET, PATCH Pending orders only |
| /api/orders/{id}/approve/ | POST, Pending only |
| /api/orders/{id}/deliver/ | POST, Approved only; atomic stock receipt |
| /api/orders/{id}/cancel/ | POST, Pending/Approved only |

`/api/v1/` is a compatibility alias. Action bodies are empty or `{}`; arbitrary status/stock edits are rejected. Financial values in responses are decimal strings, totals derived from captured quantity times unit price.

HTTP 201 means confirmed creation; 200 successful reads/updates/actions; 204 confirmed deletion. Invalid input and recognized PostgreSQL NOT NULL/FK/UNIQUE/CHECK failures on writes return 400. Protected deletion/status conflicts return 409; missing URL resources 404; absent/invalid credentials 401; insufficient role 403; unavailable database 503. Unexpected errors are sanitized. Example error: `{"email":["A supplier with this email already exists."]}`. Known constraint names map to safe field messages; unrecognized integrity details do not leak raw SQL or credentials.

Authentication is the existing bearer-header shared credential model, not JWT or DRF database tokens. Viewer (`ERP_READ_TOKEN`) reads; Buyer (`ERP_BUYER_TOKEN`) creates/updates catalogs and Pending orders; Approver (`ERP_APPROVER_TOKEN`) approves/delivers/cancels; Admin (`ERP_WRITE_TOKEN`) additionally deletes. Django enforces roles regardless of frontend visibility. No public write endpoint was added. Tokens stay outside source and Angular bundles; local Settings stores the selected token in memory. Named users, expiry, individual accountability and an immutable audit trail remain future work.

## Read-only SQL checks

From an authenticated psql session, inspect without modifying data:

```sql
BEGIN READ ONLY;
SELECT current_database(), inet_server_addr(), inet_server_port();
SELECT c.relname, con.conname, con.contype, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('suppliers','products','purchase_orders','purchase_order_items')
ORDER BY c.relname, con.conname;
SELECT table_name, column_name, is_nullable, data_type,
       character_maximum_length, is_identity, identity_generation
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('suppliers','products','purchase_orders','purchase_order_items')
ORDER BY table_name, ordinal_position;
SELECT COUNT(*) AS duplicate_groups FROM (
  SELECT lower(btrim(email)) FROM suppliers
  GROUP BY lower(btrim(email)) HAVING COUNT(*) > 1
) d;
SELECT status, COUNT(*) FROM purchase_orders GROUP BY status;
ROLLBACK;
```

The command below additionally checks trigger definitions and safe aggregate quality counts. It never prints supplier records or connection secrets. In a securely configured environment:

```powershell
cd D:\BIS_project\jedel-group-database\backend
$env:DJANGO_DEBUG = 'true'
& .venv/Scripts/python.exe manage.py inspect_data_quality
```

For interactive credential provisioning use `scripts/start-development.ps1 -CredentialDialog -DatabaseOnly`; it independently verifies psql and Django, prompts securely and does not start a server or run migrations. See the backend README for environment configuration. Do not put passwords into command arguments or commit `.env`.

## Automated test cases and actual results

Named tests are in `backend/apps/purchasing/test_amir_assignment.py`. All T01–T20 below passed on real disposable PostgreSQL, not SQLite or mocks of PostgreSQL locking.

| ID | Case | Observed assertion/result |
| --- | --- | --- |
| T01 | Valid supplier | 201; persisted, trimmed name, normalized email |
| T02 | Duplicate email | 400 for exact/case/padded duplicates; unchanged own email PATCH allowed |
| T03 | Missing supplier name | Omitted/null/blank/spaces rejected 400 |
| T04 | Missing supplier email | Omitted/null/blank/spaces rejected 400 |
| T05 | Invalid email | Malformed/non-string inputs rejected 400 |
| T06 | Optional address | Omitted/null/empty/valid text accepted; PATCH preservation/clearing verified |
| T07 | Whitespace address | Spaces/tabs/newlines/NBSP rejected; failed PATCH preserves address |
| T08 | Long address | 256 rejected 400, 255 accepted |
| T09 | Negative catalog price | Rejected 400 |
| T10 | Negative stock | API write rejected 400; direct negative SQL blocked by CHECK |
| T11 | Zero/negative quantity | Rejected 400 without parent/items created |
| T12 | Missing supplier FK | Nonexistent supplier rejected 400 |
| T13 | Duplicate product | Rejected 400, no order committed |
| T14 | Delivery before order date | Rejected 400 |
| T15 | Approved delivery | 200, Delivered persisted |
| T16 | Correct receipt quantities | Stock 5 -> 7 and 2 -> 5; total 28.00 |
| T17 | Repeat delivery | 409; stocks unchanged after first delivery |
| T18 | Cancelled delivery | 409; no stock increase |
| T19 | Failure after first stock update | Simulated DB failure on second update; 503; both stocks and Approved status restored |
| T20 | Concurrent authenticated deliveries | Separate connections, synchronized requests: one 200, one 409; stocks incremented once |

Supporting tests cover strict address types, field normalization, sanitized constraint error mapping, and real database NOT NULL rejection for supplier name/email. Existing suite additionally verifies FK/UNIQUE/CHECK/identity constraints, historical prices/Decimal totals, order creation rollback, final-status-save rollback, overlapping deliveries, cancellation races, overflow, CRUD, authentication, roles, CORS and diagnostic safety.

Commands executed from repository root/backend as indicated:

```powershell
cd D:\BIS_project\jedel-group-database\backend
$env:DJANGO_DEBUG = 'true'
& .venv/Scripts/python.exe manage.py check
& .venv/Scripts/python.exe manage.py test apps.purchasing.test_amir_assignment.AmirFieldValidationTests --verbosity 2
# Complete suite, from repository root:
cd ..
& backend/.venv/Scripts/python.exe backend/scripts/test_postgres.py
```

The helper initializes a fresh local temporary PostgreSQL 17 cluster on an ephemeral loopback port, with a random temporary credential and explicit isolated-server marker. The test runner refuses destructive setup without isolation guards. The test database is `test_jedel_api`; test schema is extracted from the preserved SQL dump without importing company data. Temporary auth/contenttypes migrations and table cleanup affect this disposable cluster only. It is stopped and removed afterward. It never resets or migrates `jedel_group_db` on port 5432.

Final results: Django system check passed (zero issues); 3 database-independent tests passed with database setup skipped; complete isolated PostgreSQL suite **78 passed, zero failed** (includes T01–T20 and those 3 tests). An earlier 77-test run also passed before the additional NOT NULL regression was added. Authenticated live psql/Django read-only verification and constraint/trigger inspection passed. Live business writes/delivery, browser interactions, and production deployment were not tested; no claim is made about them.

## Professor demonstration

1. Open this report, serializer fields, `transition_order`, and the named test file in VS Code. Explain which constraints are database-enforced and which additional rules are API-enforced.
2. Run `manage.py check` and the three database-independent tests. Show the strict address policy and safe errors without requiring database credentials.
3. Run the disposable PostgreSQL helper. It creates only isolated fixtures and runs the full purchasing workflow, so no existing company data is touched. Show T01–T14 validation results and T15–T20 receipt/rollback/concurrency results.
4. Explain T16's known starting stocks and quantities; T17/T20 prove the same receipt is never counted twice. T19 injects failure after one successful stock update and verifies the entire transaction rolls back.
5. With database-owner permission and secure credentials, run `inspect_data_quality` to show live constraints/identity/nullability/aggregate counts read-only. Do not deliver the existing Approved order or reset old Delivered orders for a demonstration.
6. If a browser demonstration is required, provision a separate disposable development database and run the API/Angular against it with generated role tokens. Demonstrate Buyer creation and Approver delivery; never use the existing business database for disposable demonstration records. The automated test helper is temporary and shuts down after testing, not a persistent browser demo server.

## Remaining limitations

- Case-insensitive email uniqueness is not a database constraint; direct SQL writers and legacy mixed-case races require a separately approved schema solution.
- Shared role credentials are not individual users; no token lifecycle/audit ledger or external email/address verification.
- No historical stock reconciliation, partial receipts, delivery reversal, returns, or automatic replay. Existing Delivered orders are left intact.
- Direct SQL changes can bypass application workflow; PostgreSQL constraints alone do not enforce the receipt state machine.
- Live write grants, production deployment, and browser behavior were not verified in this task. Database-independent and isolated integration results do not substitute for those checks.
- An interrupted response after commit requires reading current state before retrying. Duplicate delivery is guarded; order creation does not yet support a client idempotency key.

## Files in this assignment

- `backend/apps/purchasing/api/fields.py` — strict text/email and optional address policy.
- `backend/apps/purchasing/api/serializers.py` — validation integration and helpful read-only stock error.
- `backend/apps/purchasing/api/exceptions.py` — safe constraint-to-400 mapping.
- `backend/apps/purchasing/management/commands/inspect_data_quality.py` — read-only actual-schema inspection.
- `backend/apps/purchasing/test_amir_assignment.py` — named acceptance and supporting regression tests.
- `backend/README.md` — API policy and report link.
- `docs/amir-data-validation-and-stock-updates.md` — this report.

The existing service/models/views/authentication were reviewed and exercised without duplicating or replacing the delivery path. No dependency installation was necessary.
