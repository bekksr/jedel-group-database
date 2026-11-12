# Safe product catalog and role permissions

Date: 2026-11-12. Branch: feature/fullstack-integration-auth. Existing uncommitted work was preserved. No commit, push, merge, reset, author change, live migration or real business-data mutation was performed.

## Root cause and decision

Basic User's capability set is deliberately empty in accounts.py. In particular, read means private purchasing/business read. Angular's PublicWorkspacePage previously used that one capability for every section and therefore showed its Access Denied branch for Basic User Products. The private ProductSerializer includes unit_price and stock_quantity, and the private supplier endpoint includes contact details. Giving Basic User the existing read flag would expose those fields and reports.

The fix is a separate read-only catalog projection and UI. Private read stays false; existing group assignments/role capabilities and every private business permission remain unchanged. Products uses the safe catalog for anonymous visitors and any account without business read. Authorized business readers keep the existing Products component, prices/stock and capability-gated catalog/order actions. An Analyst no longer receives an order-preparation link without create_orders.

## Exact effective role matrix

| Account/role | Safe catalog ID/name/category | Private product price/stock, suppliers/orders | Catalog create/edit | Eligible catalog delete | Pending order create/amend | Approve/cancel/deliver | Analytics | User/security administration |
|---|---|---|---|---|---|---|---|---|
| Anonymous | yes | no | no | no | no | no | no | no |
| Basic User | yes | no | no | no | no | no | no | own profile/password only; no Django Admin |
| Purchasing Employee | yes | yes | yes | no | yes | no | yes | own account only |
| Purchasing Manager | yes | yes | yes | no | yes | yes, eligible transitions only | yes | own account only |
| System Administrator | yes | yes | yes | yes, existing eligibility rules | yes | yes | yes | trusted user/group administration; Django Staff explicitly required |
| Security Administrator | yes | no | no | no | no | no | no | restricted activation/suspension of assigned employees/analysts |
| Analyst / Tester | yes | yes | no | no | no | no | yes | own account only |

Rows assume one application role; explicitly assigned multiple groups combine capabilities as before. Active superusers retain trusted full authority. Disabled users cannot authenticate/use protected APIs; explicitly public catalog information remains available anonymously. Staff/System Administrator grants are controlled by trusted operators, not public registration.

Legacy Viewer maps to Analyst / Tester, Buyer to Purchasing Employee, Approver to Purchasing Manager, Admin to System Administrator. Manager deliberately combines employee preparation/catalog permissions with transitions. No legacy bearer credential was enabled or added to the normal session flow.

## Public and protected APIs

Public GET/HEAD/OPTIONS only:

- /api/catalog/products/: paginated count/next/previous/results; each result is exactly product_id, product_name and category.
- /api/catalog/products/{id}/: the same three-field detail.
- /api/catalog/categories/: distinct nonempty category names in results, without stock, price or supplier data.

The existing /api/v1/ URL include also retains the same catalog projection safely. Authentication is not required because this minimal product information is now explicitly public. Write verbs receive 405. Private endpoints retain authentication and role checks, including /api/products/, /api/suppliers/, /api/orders/ and transition actions, /api/dashboard/, /api/analytics/* and /api/security/*.

Search matches only product_name/category. Exact category filtering, page-number pagination and ordering by product_id/product_name/category are supported. Search is bounded to 100 characters and category to 50. Unknown/field-selection parameters and private ordering fields are rejected with 400. The ORM selects only the three public columns, not just hiding sensitive values in the browser. Catalog detail, search, ordering, metadata and category facets do not expose unit_price or stock_quantity. Safe count is catalog record count, not inventory units.

No public AI search implementation or endpoint was found in the inspected project. This change supplies ordinary keyword/category search only; it adds no AI/provider calls or misleading AI feature. Any future AI endpoint must preserve the same public-field boundary rather than reuse private serializers or reports. No customer sales, cart, checkout or inventory-issue behavior was introduced.

## Angular implementation

PublicCatalogService uses the existing relative environment.apiBaseUrl and /catalog endpoints with typed PublicProduct objects containing only the approved fields. PublicCatalogPage displays existing-style product cards, server-backed search/category filters and pagination. Loading, empty, errors and retry are explicit; database failures never substitute mock records. Debounced search and switchMap cancel stale requests, and pagination constructs trusted relative URLs instead of following arbitrary next URLs with credentials.

PublicWorkspacePage chooses the safe Products page for anonymous/Basic/Security/other non-business readers. It retains safe intros/prompts for other restricted sections. Private product rendering/actions remain separate. Basic User sees no edit/delete/order buttons; anonymous protected-create links still go through the existing login/capability guard. Signed-in insufficient roles get Access Denied for protected actions, while normal safe Products browsing is useful.

Home and Account navigation, immediate registration, sessions and logout remain intact. Existing supplier management, product CRUD, Pending amendments, approval, delivery, cancellation, stock transactions and analytics were regression-tested.

## Team requirements and PostgreSQL review

Reviewed Bekarys's business-requirements.md, business-processes.md and gap-analysis-and-acceptance.md: the system is supplier purchasing/receiving, captured prices and stock are internal, role terminology differs by layer, and customer sales is future scope. Their files were not rewritten. This request explicitly approves the narrow public product projection; it does not approve public purchasing costs or contacts.

Reviewed Yerbolat's database/roles.sql. SQL role_admin/manager/employee are PostgreSQL privileges, not application Groups, and the API does not select a DB role based on the browser's application role. In particular the SQL employee grant includes some stock columns but omits price/contact columns; the existing app Employee role has the established authorized purchasing read contract. This difference is documented rather than silently changing the teammate's scripts or runtime credentials. Direct SQL manager UPDATE privileges are not a substitute for service transition enforcement.

No role/GRANT script was executed. No schema or permission migration is needed: the catalog reads existing product columns. Original unmanaged models, purchasing services, SQL dump, role/GRANT scripts and their original business constraints/identity relationships were compared to HEAD and remain unchanged. Tests used only a marked disposable PostgreSQL cluster. No real order, stock, captured price or business record was altered.

## Actual verification

| Check | Result |
|---|---|
| Complete Django 6.0.3/PostgreSQL suite | 119 passed, 0 failed, 0 skipped; 111.954 seconds |
| Real Chromium scenarios inside backend wrapper | 3 passed in 21.0 seconds |
| Angular Vitest | 70 passed, 0 failed, 0 skipped; ten files |
| Production frontend build | Passed; initial 394.59 kB, estimated transfer 101.50 kB |
| Focused public catalog PostgreSQL tests | 5 passed; also included in the full suite |
| Fresh isolated migrations/init and restart/six-group sentinel preservation | Passed |
| git diff --check | Passed |
| Original models/services/dump/role script comparisons | Unchanged |
| macOS/Docker/live business-write verification | Not performed in this Windows task |

Backend coverage includes anonymous list/detail/categories, Basic search/filter/page, exact allowlist, no private SELECT columns, private-column ordering/filter/field-selection rejection, no price-based search results, no public writes, protected supplier/contact/order/analytics endpoints, Basic write/transition/Admin denial, named role checks, privilege escalation, legacy account/auth regressions, admin safety and concurrent atomic stock/delivery regressions.

Angular coverage includes Basic catalog rendering, category/search requests, no price/stock/write controls, loading/error/empty/retry, request cancellation, safe relative pagination, public Home/navigation and Security-role public catalog access. Existing auth/CRUD/order tests remain enabled.

Chromium verifies a newly registered Basic User can see/search/filter public products with no price/stock/edit controls and cannot open a create workflow; a real Purchasing Manager logs in and completes supplier/product creation, Pending amendment, approval/delivery and stock/report refresh; the separate administrator session still safely creates a catalog product, and the existing Viewer remains read-only. Browser scenarios are included through one wrapper in the 119 count, not added again.

The first full run found an exact-label browser selector that included the wrapped select option text; it was corrected to use the accessible Category combobox. The implementation/permissions were not weakened and no test was disabled. Final results above are passing runs. Ignored evidence: backend/.runtime/catalog-full-verification.log, backend/.runtime/public-catalog-tests.log and frontend/test-results.

## Manual testing

Start backend from backend with `python manage.py runserver`, and frontend from frontend with `npm.cmd start` on PowerShell. No migrations are required for this change.

1. Anonymous: open http://localhost:4200/products. Expect IDs, names, categories, search and category filters; no prices, stock or contacts. Query /api/catalog/products/ through Angular's origin and inspect the three-field results. Direct private /api/products/ or /api/suppliers/ is denied 401.
2. Basic User: register or log in through Account. Open Products and filter/search. Confirm there is no full-page Access Denied for the catalog and no edit/delete/order control. Direct /products/new should show Access Denied; protected APIs deny 403. Supplier contacts, orders and analytics remain unavailable.
3. Purchasing Employee: have an authorized administrator assign that group to a test/development account. Log in and confirm private Products and supplier/order data appear; create/edit catalog or a Pending order only on isolated development data. Approval/delivery APIs and controls must remain denied.
4. Purchasing Manager: on isolated development data, create/amend a Pending order, approve it and deliver once. Confirm stock changes once, repeated delivery conflicts and analytics refresh. Do not repeat this against real orders.
5. System Administrator: trusted staff account can open /admin/ and supported administration; stock/raw order/item fields stay protected. Normal application deletion still requires existing relationship/stock eligibility.
6. Security Administrator: safe catalog works; private business pages/APIs remain unavailable, while designated account controls remain available. Analyst can read authorized reports/products but cannot edit or transition orders.

Use disposable local accounts/data for role/write demonstrations. Do not change real team roles or stock merely to test. Current remaining scope: no AI search service, customer sales, or new DB changes; macOS/Docker execution was not claimed.

## Exact modified/created files for this task

- [README.md](../README.md)
- [backend/README.md](../backend/README.md)
- [backend/apps/purchasing/api/catalog.py](../backend/apps/purchasing/api/catalog.py)
- [backend/apps/purchasing/api/serializers.py](../backend/apps/purchasing/api/serializers.py)
- [backend/apps/purchasing/api/urls.py](../backend/apps/purchasing/api/urls.py)
- [backend/apps/purchasing/schema.py](../backend/apps/purchasing/schema.py)
- [backend/apps/purchasing/test_browser.py](../backend/apps/purchasing/test_browser.py)
- [backend/apps/purchasing/test_public_catalog.py](../backend/apps/purchasing/test_public_catalog.py)
- [docs/API.md](../docs/API.md)
- [docs/AUTHENTICATION.md](../docs/AUTHENTICATION.md)
- [docs/AUTO_REGISTRATION_REPORT.md](../docs/AUTO_REGISTRATION_REPORT.md)
- [docs/CATALOG_ACCESS_REPORT.md](../docs/CATALOG_ACCESS_REPORT.md)
- [frontend/README.md](../frontend/README.md)
- [frontend/e2e/account-flow.spec.ts](../frontend/e2e/account-flow.spec.ts)
- [frontend/e2e/workflow.spec.ts](../frontend/e2e/workflow.spec.ts)
- [frontend/src/app/core/data/public-catalog.service.ts](../frontend/src/app/core/data/public-catalog.service.ts)
- [frontend/src/app/pages/products.ts](../frontend/src/app/pages/products.ts)
- [frontend/src/app/pages/public-catalog.spec.ts](../frontend/src/app/pages/public-catalog.spec.ts)
- [frontend/src/app/pages/public-catalog.ts](../frontend/src/app/pages/public-catalog.ts)
- [frontend/src/app/pages/public-workspace.ts](../frontend/src/app/pages/public-workspace.ts)
- [frontend/src/app/public-navigation.spec.ts](../frontend/src/app/public-navigation.spec.ts)

No dependency changes, migration files, new business tables or SQL GRANT changes.
