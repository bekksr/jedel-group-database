# Jedel.Group ERP Angular frontend

The production and development builds default to **API mode**. Dashboard, suppliers, products, purchase orders, and analytics use Django/PostgreSQL responses. No seed is loaded unless the user explicitly chooses DEMO MODE in Settings.

## Start on Windows

Backend terminal (configure real credentials and server access tokens first; see `backend/README.md`):

```powershell
cd D:\BIS_project\jedel-group-database\backend
& .venv/Scripts/python.exe manage.py check
& .venv/Scripts/python.exe manage.py runserver --skip-migration-check
```

Frontend terminal:

```powershell
cd D:\BIS_project\jedel-group-database\frontend
npm ci # Fresh checkout or changed dependency lockfile only
npm start
```

Open http://localhost:4200, navigate to Settings, and enter a server-provisioned bearer access token. For local HTTP development explicitly set `$env:DJANGO_DEBUG = 'true'` in the backend terminal. The token is sent only to the configured Django API and held in memory. It is never placed in source, an Angular environment file, local storage, URLs, or a build. Page refresh/disconnect clears it. No named-user login or full RBAC is claimed: the backend implements shared Viewer, Buyer, Approver, and Admin credential roles.

Viewer tokens permit reads; Buyer tokens permit catalog edits and draft orders; Approver tokens permit order status actions; Admin tokens permit all supported operations including deletion. Django enforces these roles independently of UI visibility. Missing/invalid tokens, unreachable Django, or unavailable PostgreSQL show an error without demo fallback. The access check and all database-backed resource/report requests must succeed before the UI reports a connection.

## API configuration

- `src/environments/environment.ts`: production defaults.
- `src/environments/environment.development.ts`: development replacement selected by Angular CLI.
- `apiBaseUrl` defaults to `/api`. It contains no secrets.
- Development `/api/**` requests are proxied by `proxy.conf.json` to `http://127.0.0.1:8000`.
- Production hosting must forward `/api/` to Django and serve `index.html` for frontend routes. To use a separate API origin, change the build environment and configure the matching backend CORS origins and HTTPS.
- `enableDemoMode` controls whether Settings offers the explicit demo option. API mode always remains the default.

## Data services and contracts

`ERP_DATA` now resolves to `WorkspaceDataService`. Its default delegate is `ApiDataService`; the seeded `DemoDataService` is imported lazily only after explicit selection. Switching modes clears API records/credentials and never copies demo changes into the database. The shell, dialogs, Settings, and footer display the active mode.

`api-contracts.ts` describes actual Django JSON formats: paginated resources, nullable optional fields, decimal strings, nested items, dashboard aggregates, and analytics results. The adapter:

- Collects all resource pages for the current client-side search/sort/pagination UI; it never follows an absolute pagination link with a bearer token.
- Converts null phone/address/category to empty display strings.
- Flattens nested order items while retaining their order ID and server-calculated line totals.
- Uses server-calculated order totals, dashboard KPIs, supplier spending, status distributions, and stock summaries in API mode.
- Rejects malformed/unsafe monetary display values instead of silently losing precision. Client-side draft calculations are estimates; the server captures prices and returns authoritative totals.
- Publishes the complete fetched workspace only after all requests succeed. A failed refresh hides stale records and disables writes until a successful refresh/reconnection.

Resource loading intentionally collects full paginated lists to retain the existing UI for this university project. For large installations, replace this with resource-specific server-side paging/filtering; do not silently truncate results. Parallel report/resource requests do not provide a cross-request repeatable-read snapshot if other clients are writing concurrently.

## Features and requests

| Feature         | API integration                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Connection      | GET `/api/access/`, checks read/write scope; then loads database-backed resources                                     |
| Dashboard       | GET `/api/dashboard/?low_stock_threshold=20`, canonical counts/totals/recent orders/charts/stock                      |
| Suppliers       | GET all pages; POST, PATCH, DELETE with validation and confirmed refresh                                              |
| Products        | GET all pages; POST, PATCH, DELETE; inventory remains read-only in forms                                              |
| Purchase Orders | GET all pages and individual details; POST nested order/items; POST approve/deliver/cancel actions                    |
| Analytics       | GET `/api/analytics/supplier-spending/` and `/api/analytics/order-status/`; dashboard purchasing and stock aggregates |
| Settings        | In-memory token connection, explicit mode selection, session-only low-stock preference, demo-only reset               |

Low-stock preferences are browser-session configuration, not a persisted database setting. Applying them in API mode reloads the server dashboard with the selected threshold. Searches, category/status filters, sorting, and pagination operate over the fully loaded API results.

## Writes and failures

No optimistic database changes are applied. Forms remain open while requests are pending and block duplicate submissions. A server rejection retains entered form values, displays useful field/constraint errors, and emits no success notification. Read-only controls are disabled based on the server's scope response; Django still enforces access independently.

After a successful mutation, all resource lists, dashboard data, analytics, and stock are refreshed before the normal success notification. If the mutation was confirmed but refresh failed, the form closes and a warning says **do not resubmit**; cached data is hidden pending refresh. A timeout, lost connection, 5xx, or unreadable successful response may follow a committed transaction; the UI disables further writes and asks the user to refresh/check the record. Writes are never automatically retried.

409 conflicts refresh current records where possible and preserve the original error. Supplier/product referential constraints and product-stock deletion restrictions come from Django. No frontend reset is permitted in API mode.

Order workflow:

- Pending ? Approved ? Delivered
- Pending ? Cancelled
- Approved ? Cancelled
- Delivered/Cancelled are final

The API service never increments stock itself. Only the server's successful delivery and subsequent refreshed product records change displayed stock. Duplicate delivery is rejected both by cached-state controls and, authoritatively, by the locked backend operation. Product edits send only catalog fields, never stock quantities. Historical item prices are retained by Django.

## Explicit demo option

Settings ? Use explicit demo mode ? confirmation. This loads the exact SQL seed in memory, labels DEMO MODE throughout, and makes no business API requests. Demo notifications explicitly state PostgreSQL was not changed. Refresh returns to disconnected API mode. Demo reset is available only in this mode. There is no fallback to demo on an API error.

## Validation

```powershell
npm run build
npm test -- --watch=false
# From backend:
& .venv/Scripts/python.exe manage.py check
& .venv/Scripts/python.exe scripts/test_postgres.py
```

The frontend suite has 41 tests: routes and demo interactions, real API contract adapters using HttpTestingController, paging, server aggregates, authentication scope, loading/submission behavior, retained inputs after validation rejection, stock updates only after confirmed refresh, failed/ambiguous writes, refresh-after-commit failures, and explicit demo isolation. Native dialog behavior is stubbed in jsdom. These are not real-browser visual/focus tests.

The backend suite has 42 tests on an isolated PostgreSQL cluster, including an authenticated supplier ? product ? order with items ? approve ? deliver ? stock verification flow, repeat-delivery rejection, transaction rollbacks, constraints, and concurrency races. No destructive tests use the existing `jedel_group_db` database.

Live application integration is **not verified against the existing database** because its password is unavailable. Browser automation is unavailable, so a browser-level purchasing workflow and visual/responsive checks were not executed. No claim of completed live deployment is made. Configure real backend database credentials, verify live schema/triggers/grants, provision API credentials securely, and complete the browser workflow before using live records.

## QA improvements and limits

The review added server-capability-aware controls, unique error associations (`aria-invalid`, `aria-required`, `aria-describedby`), modal focus return, Escape navigation, labelled keyboard-scrollable tables, pagination clamping after refresh, improved measured text/status contrast, small-screen chart wrapping and a single-column KPI breakpoint at 420px. Extreme currency amounts that cannot retain their cents through the actual formatter are rejected rather than shown incorrectly.

These are source changes and unit/component checks, not real browser certification. Mobile/tablet/desktop rendered layouts, dialog focus trapping, zoom, and assistive-technology behavior still need manual review at 320/768/1440 pixels. Browser automation is unavailable in this environment. No screenshots were generated.

`npm audit --omit=dev` reports zero production dependency advisories. The full audit still reports 16 moderate CLI/transitive development dependency advisories. No forced Angular downgrade or unreviewed major dependency override was applied. See [QA_REPORT.md](../docs/QA_REPORT.md).
