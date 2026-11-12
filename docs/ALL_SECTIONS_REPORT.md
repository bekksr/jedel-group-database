# All-section access implementation and verification

Current task: public page access across all five sections without publishing private ERP records. Previous authentication/catalog work and all unrelated working-tree changes were preserved. No commit, push, merge, reset, live database write or migration was performed.

## Result matrix

| Section | Anonymous | Basic User | Employee | Manager | Analyst | Admin | Tested |
|---|---|---|---|---|---|---|---|
| Home | Introduction/navigation | Introduction/access guidance | Real dashboard | Real dashboard | Real dashboard | Real dashboard | Unit + Chromium |
| Products | Safe searchable catalog | Safe searchable catalog | Business read/create/edit | Business read/create/edit | Business read-only | Business CRUD | API/unit/Chromium |
| Suppliers | Informative preview | Preview/access guidance | Read/create/edit/search/filter | Read/create/edit/search/filter | Read-only | CRUD | API/unit/Chromium |
| Orders | Procurement workflow preview | Preview/access guidance | Read/create/amend Pending | Read/create/amend/eligible transitions | Read-only | Validated lifecycle | API/unit/Chromium |
| Analytics | Report definitions | Definitions/access guidance | Real reports | Real reports | Real reports | Real reports | API/unit/Chromium |

Security Administrator receives the safe public views, not purchasing access. Employee report access preserves existing business-read policy. Combining groups combines their existing capabilities. Django staff access is separate from the application System Administrator group.

## Root causes and implementation

Home already opened publicly but needed useful links, permission-aware actions and clearer real metric labels. Products already selected the safe catalog and retains that implementation. Suppliers, Orders and Analytics shared a fallback in PublicWorkspacePage that showed generic Access Denied for signed-in non-readers; anonymous visitors received thin introductions. Each now has substantive section-specific content without a private API request. Protected action routes still deny insufficient privileges.

Suppliers explains authorized directory maintenance without publishing unapproved supplier identities or contacts. Orders explains procurement, captured prices, allowed transitions and atomic receipts, without presenting retail checkout. Analytics explains each report without fabricated figures. Authorized analytics uses existing real dashboard, spending, status and dated-order data; monthly counts require at least two recorded months. Commitments and delivered values are explicitly not payments.

Home now links all sections. Shared loading/error/retry status replaces duplicate alerts. Supplier search includes contacts/address only inside the authorized workspace and supports an address filter. Create/edit/delete/transition controls retain existing capabilities. Request access opens truthful guidance for contacting a team administrator; it does not pretend to submit a request. Basic users stay signed in rather than looping through login.

## API and protected fields

No new public endpoint or production Django permission change was required. Existing public GET/HEAD/OPTIONS endpoints are `/api/catalog/products/`, `/api/catalog/products/{id}/`, `/api/catalog/categories/`. They expose only identifiers, product names and categories. Price/stock filters and other private query fields are rejected. The reusable catalog service can support future permission-scoped tools; no AI agent was implemented.

`/api/products/`, `/api/suppliers/`, `/api/orders/`, dashboard and analytics remain protected by server-side business-read authorization. Writes require the existing catalog, order-creation, transition or deletion capability. Anonymous requests receive 401; Basic/Security requests receive 403. Private supplier emails/phones/addresses, costs, stock, purchase orders and reports never appear in safe previews. No public supplier identity or financial aggregate was approved, so none was added.

Employee can maintain catalog and prepare/amend Pending orders but cannot transition them. Manager adds approval/delivery/cancellation. Analyst is read-only. System Administrator adds supported deletion/administration. Existing services enforce Pending -> Approved/Cancelled and Approved -> Delivered/Cancelled, terminal states, atomic stock increments and duplicate-delivery protection.

## Files changed for this task

Angular source: `src/app/app.ts`, `routes.ts`, `pages/home.ts`, `pages/products.ts`, `pages/suppliers.ts`, `pages/orders.ts`, `pages/orders.html`, `pages/analytics.ts`, `pages/public-workspace.ts`; new `pages/access-prompt.ts`, `pages/section-preview.ts`, `pages/workspace-status.ts`.

Frontend tests: new `src/app/all-sections.spec.ts`, new `e2e/all-sections.spec.ts`, updated `e2e/workflow.spec.ts` navigation locators.

Django tests: new `backend/apps/purchasing/test_section_access.py`, extended `test_browser.py` isolated role fixtures. No production Django module changed for this task.

Documentation: `docs/ALL_SECTIONS_AUDIT.md`, this report, `docs/AUTHENTICATION.md`, root `README.md`. Existing dirty files from earlier work are not attributed to this task. No dependency, migration, business model/service, SQL dump or PostgreSQL role-script change.

## Executed verification

Windows environment, PostgreSQL 17 temporary disposable cluster, real Django/Angular and Chromium:

| Check | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Full backend suite (includes browser wrapper) | 121 | 0 | 0 |
| Frontend unit suite | 79 | 0 | 0 |
| Chromium scenarios inside backend wrapper | 5 | 0 | 0 |

Browser scenarios are nested in the backend count, not additional backend tests. Full backend run took 65.803 seconds; Chromium reported 5 passed in 26.1 seconds. Production Angular build passed (408.00 kB initial bundle). `git diff --check` passed. Business models/services and original SQL role/dump paths have no diff against HEAD.

Coverage: all five pages for Anonymous, Basic, Employee, Manager, Analyst, Admin and Security; safe catalog/private-field checks; backend list/detail authorization; private filter rejection; authenticated profile/session flow; request-access guidance; manager order lifecycle and stock receipt; viewer forbidden writes; transactional/concurrent purchasing regressions. Chromium checks mobile width 390 for public/Basic/Security views and desktop role navigation. Backend-unavailable browser coverage deliberately intercepts dashboard with 503; it verifies failure handling, not database uptime. Unit contracts use test HTTP fixtures; production never falls back to fabricated data.

An initial browser run found an ambiguous Products link after Home gained section links. Scoping the old workflow selector to Main navigation fixed the test; the final complete run passed. No failing test was disabled.

## Manual verification

1. With your existing configured database, run `python manage.py runserver` from `backend`; run `npm.cmd start` from `frontend` in another PowerShell. Open `http://localhost:4200/` so `/api` uses the Angular proxy.
2. Logged out, visit all five navigation sections. Products loads safe records/search/categories. Other sections explain their workflows without contacts, costs, stock, actual orders or financial figures. Account opens unified authentication.
3. Log in as Basic User. Repeat all five sections; Request access opens guidance and must not ask for another login. Private API calls remain forbidden.
4. Using existing authorized test accounts, Employee sees real business records, supplier filters and permitted maintenance/order preparation; approval/delivery controls are absent. Analyst sees reports but cannot write.
5. Manager sees eligible order transitions. Admin sees authorized administration/deletion controls. Test mutations only against an isolated development database, never real stock/orders for verification.
6. Refresh to check session persistence; log out to restore Account. At mobile width, verify navigation/cards/tables remain usable. Stop backend and use Retry workspace to verify an honest failure state.

No schema or existing-database approval is required for these changes. Real team-account roles were not modified. macOS, Safari and Firefox were not tested. Preview content intentionally publishes no supplier identities or business aggregates; expanding public data requires explicit classification. Readiness: implemented and verified in the tested Windows/PostgreSQL/Chromium environment, with those environment limits.
