# Jedel Procurement Copilot: implementation and operation

The MVP adds `/ai-assistant` and read-only Django tools without database migrations. It is useful with no AI key: real catalog filtering, approved CSV quotation comparison, authorized inventory questions and review-only order proposals work locally. Optional natural-language catalog interpretation uses an OpenAI provider adapter. No model can approve, deliver, cancel, create orders or edit inventory.

## Audit and available evidence

Before editing, branch/status were checked on `feature/fullstack-integration-auth`; existing teammate changes were preserved. Reviewed Angular navigation/routes/session state, safe catalog projection, Django group capabilities and protected APIs, serializers, purchasing services, PostgreSQL unmanaged mappings, report definitions, environment loading/dependencies, tests, Bekarys business requirements and Yerbolat SQL role model. The six roles were already provisioned and verified in [LIVE_RBAC_PROVISIONING.md](LIVE_RBAC_PROVISIONING.md). This task does not change their memberships or permissions.

Existing working functionality includes session login/registration/logout, CSRF, role-aware public/business pages, catalog CRUD, atomic purchasing transitions and reports. Existing data is product ID/name/category/internal price/stock, supplier directory, purchase orders and captured line prices. Missing: supplier-product catalog relationships, current supplier quotations, product specifications, unit definitions, verified FX, payment data and sufficient demand history. No prices/offers, equivalence, demand forecasts or marketplace connections were invented to fill these gaps.

## Architecture and boundaries

```mermaid
flowchart TD
  UI[Angular Copilot] --> API[Django API: CSRF, limits, input validation]
  API --> Local[Deterministic local orchestration]
  Local --> Tools[Bounded ORM reads with role checks]
  Tools --> DB[(PostgreSQL)]
  API --> CSV[Request-scoped quotation validation and Decimal ranking]
  CSV --> Tools
  API --> Provider[Optional provider interface: one search interpretation]
  Provider --> OpenAI[Responses API]
  Provider --> Safe[Validated public catalog filters only]
  Safe --> Tools
```

Private local questions are handled before provider configuration/consent checks. Supported forms (case insensitive):

- `Which products have low stock?`
- `What items should we consider purchasing?`
- `Show low stock`
- `Show inventory levels for category Hardware.`
- `Prepare a purchase order for 20 units of product 1 from supplier 2.` (also accepts `Help me prepare ...` and optional `#` before IDs)
- `Show purchase order 1 status.`

Use actual IDs; these examples are syntax, not assertions that those records exist. Category inventory returns all matching stock levels, at most 20. Low-stock requests use the explicitly proposed threshold 20; structured inventory controls allow a different request threshold. There is no stored product reorder point or forecast. Unsupported private purchasing instructions are rejected locally and never forwarded to the provider. There is no general SQL, filesystem, URL fetch, marketplace scraper or arbitrary tool dispatcher.

Catalog interpretation sends only the user's explicitly consented message to OpenAI. It requests exactly one strict `search_products` function call; parameters are validated again by Django and executed with the public projection. No product rows, supplier details, quotations, inventory or orders are sent to the model. Provider prose is ignored; explanations and result cards are composed from actual tool results. No second inference call or recursive tool loop exists. The provider protocol allows another interpreter adapter later.

Source documentation used: [official function-calling guide](https://developers.openai.com/api/docs/guides/function-calling) and [Responses create reference](https://developers.openai.com/api/reference/python/resources/responses/methods/create). OpenAI SDK **3.49.0** was discovered from the package index, pinned and installed in the project virtual environment. Its actual Responses method signature was inspected for the implemented parameters without making a model request. No model ID is hardcoded: operators must configure a currently available model that supports these Responses/function-calling options.

## Role policy

| Role | Public search | Optional catalog AI* | Offers / inventory / order status | Review-only order draft |
|---|---|---|---|---|
| Anonymous | Yes | No | No | No |
| Basic User | Yes | Yes | No | No |
| Purchasing Employee | Yes | Yes | Yes | Yes |
| Purchasing Manager | Yes | Yes | Yes | Yes |
| Analyst / Tester | Yes | Yes | Yes | No |
| System Administrator | Yes | Yes | Yes | Yes |
| Security Administrator | Yes | Yes | No | No |

\* Requires explicit consent, enabled provider configuration and available request budget. Roles compose using the existing capability union; superusers are trusted separately. Angular uses server capabilities for controls, and each private tool independently checks permissions even outside a view. All product search cards, including privileged search results, contain only `product_id`, `product_name`, `category`. Inventory and proposals expose additional fields only through authorized local tools. Supplier options contain ID/name, never emails/phones/addresses.

## API

All paths are under `/api/ai/`. Session authentication is reused; every POST requires a CSRF cookie/header, including anonymous search. GET capabilities does not disclose records. Unsupported HTTP methods remain unavailable.

| Method / route | Inputs | Access |
|---|---|---|
| GET `capabilities/` | None | Public; permission-aware feature flags |
| POST `products/search/` | `query` (100 chars), `category` (50), `match` = partial/exact | Public; 20 results maximum |
| POST `chat/` | `message` (1000 chars), `consent_to_provider` | Authenticated; local private intents also require their tool capability |
| POST `inventory/` | `category`, `threshold` (default 20), `low_only` (default true) | Business read; 20 rows maximum |
| GET `suppliers/` | None | Order-preparation permission; first 50 directory choices |
| POST `orders/draft/` | `product_id`, `supplier_id`, `quantity` | Order-preparation permission; no persistence |
| POST `orders/status/` | `order_id` | Business read |
| POST `offers/compare/` | `product_id`, `quantity`, `csv`, `approved_source`, `equivalence_confirmed`, optional `max_delivery_days` | Business read |

Unknown input fields are rejected, not accepted as role/filter instructions. Quantities are positive whole numbers up to 1,000,000. Requests are limited to 96 KiB actual JSON bytes; CSV content is additionally limited to 64 KiB and 50 rows. Errors: 400 validation, 401 unauthenticated private tool, 403 role/CSRF/consent, 404 unknown record, 413 size, 429 rate, 503 provider/database unavailable. Errors do not echo credentials, quotation cells, raw provider exceptions or SQL details. Public detail lookup continues through the existing `/api/catalog/products/{id}/`.

## Approved quotation CSV

Upload UTF-8 CSV in the page. Use this exact header/order:

```csv
product_id,supplier_id,unit_price,currency,unit,available_quantity,min_order_quantity,delivery_cost,delivery_days,quoted_at,valid_until,source,reference,specifications
```

Each row is one current supplier quotation for the selected real product and existing supplier. No sample rows are loaded automatically. Monetary inputs are nonnegative finite Decimal values, maximum 99999999.99, with at most two decimal places. Availability is a nonnegative whole number; minimum order is positive; delivery time is an integer from 0 to 3650 days. `quoted_at` must be timezone-aware ISO8601, not in the future. `valid_until` may be blank (warning), otherwise must be at/after quotation time. Source/reference/specifications are required bounded single-line text. Spreadsheet formula prefixes, NULs, malformed field counts, duplicate supplier/reference pairs and oversized inputs are rejected. Untrusted text is displayed using Angular text bindings, not HTML; it is never interpreted as instructions or sent to the model.

The importing business reader must affirm that the source is approved and product/specification equivalence was checked. This is human attestation, not cryptographic supplier authentication or an administrator-maintained approved-source registry. There is no product-specification or offer relationship in the current database, so the system cannot independently establish equivalence or availability. Supplier/source fields and import timestamp remain visible for review.

Supported currencies: KZT, USD, EUR, GBP. A comparison must contain only one currency. Mixed currencies are rejected; no FX rate is fabricated. `unit`, `units`, `piece`, `pieces`, `pc`, `pcs` normalize to an individual `unit`. Packs, weights and other conversions are rejected rather than guessed. Price and delivery are assumed tax-inclusive; confirm this with the supplier. All quotations remain request-scoped; neither files nor quotes are persisted server-side.

Eligibility requires quoted availability >= requested quantity, quantity >= minimum, compliance with any delivery limit, a nonexpired validity end when supplied, and a quotation no older than 30 days. Ineligible rows remain visible with reasons but cannot win. Blank source information is rejected, while absent validity end produces a warning. No quotations means an explicit empty result, not generated offers.

Calculations use Python Decimal:

```text
subtotal = quantity * quoted_unit_price
total = subtotal + quoted_delivery_cost
effective_unit_cost = total / quantity
```

Costs are returned as two-decimal strings; effective unit cost is rounded half-up to four decimals. Eligible results rank by lowest total cost; delivery days break cost ties, followed by supplier ID/reference for deterministic ordering. Every row shows its calculation, delivery, availability, minimum, source, quote timestamp, validity, specification text and eligibility warnings. No reliability score or payment claim is inferred. Both best reference and supplier ID identify the chosen row.

## Order proposals

Proposals validate a real product, real supplier and quantity, and show the current internal catalog price in KZT with a Decimal subtotal. This price is not represented as a confirmed supplier quotation. Supplier-product availability, delivery and taxes remain unverified. A draft has `draft_only=true`, `persisted=false`; creating, approving, delivering and cancellation are impossible from these tools. The normal order form is linked for human review and existing service validation. No captured historical prices or stock fields are changed.

## Installation and configuration

Backend `.env` is loaded by the existing environment loader. Root `.env` supplies Compose configuration. Both examples contain empty secret/model fields and disabled defaults:

```dotenv
AI_ENABLED=false
AI_PROVIDER=openai
OPENAI_API_KEY=
AI_MODEL=
AI_TIMEOUT_SECONDS=15
AI_MAX_OUTPUT_TOKENS=512
AI_DAILY_CALL_LIMIT=100
AI_USER_DAILY_CALL_LIMIT=20
```

For optional external interpretation, an authorized operator supplies their server-side key/model and explicitly enables AI. Do not put keys into Angular. Enabling the configuration and consented use can incur provider costs; this implementation/testing did not make any paid call. Without a key/model or when disabled, core Django, Angular and deterministic tools work; the UI clearly states chat is unconfigured. Local inventory/order questions remain available according to role. The provider is lazily imported so the core also starts without the SDK installed, although the repository requirements include its pinned version.

Provider safeguards: one inference attempt per chat, no SDK retries, 15-second default timeout (bounded 1–30), 512 default output tokens (bounded 128–1024), parallel tools disabled and `store=false`. General Copilot requests are limited to 30/minute per user or anonymous IP; chat to 5/minute per user. Provider attempts, including failures, consume rolling 24-hour global/per-user call budgets (100/20 default, configurable and bounded). These are request/token ceilings, not a currency-denominated spending guarantee. Configure provider-project spending controls separately.

The development cache is Django LocMemCache: limits are per process and reset on restart. A production multiworker deployment requires a shared cache with atomic add/incr and appropriate edge/IP throttling; the MVP is not a distributed billing-control service. No prompts, keys or private results are included in operational logs. Conversations are bounded browser memory only and are cleared with private results on account change/logout. No AI-history database schema is introduced. Server-side provider storage is disabled in requests; provider account retention controls are separate.

Windows PowerShell (existing configured PostgreSQL required; do not migrate the live database):

```powershell
cd D:\BIS_project\jedel-group-database\backend
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe manage.py runserver
```

Your existing activated/interpreter setup also continues to support `python manage.py runserver`.

In a second PowerShell:

```powershell
cd D:\BIS_project\jedel-group-database\frontend
npm.cmd ci
npm.cmd start
```

macOS bash/zsh, from the cloned repository:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py runserver
```

Second terminal: `cd frontend`, `npm ci`, `npm start`. Follow the existing development guide for first-time isolated PostgreSQL setup. Open `http://localhost:4200/ai-assistant`; requests use the existing Angular `/api` proxy. No shared bearer token is needed. macOS execution was not verified during this task.

Compose: configure root `.env`, then `docker compose up --build`. The existing Compose initializer is guarded for its separate `jedel_dev` database. This task adds optional AI environment forwarding, not a live database initializer. Docker execution/portability was not newly verified here.

## Tests and manual verification

Backend tests use `backend/scripts/test_postgres.py`, never the live database. The runner forcibly disables AI/clears provider credentials. Provider tests inject mock SDK results and exceptions; the installed SDK contract is checked without a network inference call.

```powershell
# From backend; PostgreSQL 17 binaries required
python scripts/test_postgres.py apps.purchasing.test_copilot
$env:JEDEL_BROWSER_TESTS='1'
$env:JEDEL_VERIFY_DEVELOPMENT='1'
python scripts/test_postgres.py
# From frontend
npm.cmd test -- --watch=false
npm.cmd run build
```

Install Playwright Chromium locally if absent with `npx playwright install chromium`; run browser tests through the isolated backend harness, not against real company data. macOS uses `npm` instead of `npm.cmd` and can set the flags with `JEDEL_BROWSER_TESTS=1 JEDEL_VERIFY_DEVELOPMENT=1 python scripts/test_postgres.py`. No live provider smoke test was authorized or performed.

Manual browser checks:

1. Logged out, open AI Assistant. Search a real product/category. Check public IDs/names/categories and honest empty states; no prices, stock or supplier contacts.
2. Basic User sees the same safe catalog and access guidance. AI catalog interpretation requires configuration and explicit consent. Protected inventory questions are denied by Django, without a login loop.
3. Employee/Manager/Admin can select a real product, enter quantity, upload actual approved quotations, confirm source/equivalence and compare totals. Try mixed currencies, expired quotes and unmet minimum quantities. Review source/calculations before any purchasing decision.
4. Analyst can read inventory/compare offers but cannot draft an order. Security Administrator cannot access purchasing tools. Role labels do not override server permissions.
5. Authorized staff can ask a supported inventory/order question without AI. Review a draft: verify the page says not saved, order count and stock unchanged. Use only isolated test data for any later normal purchasing operations.
6. Check unavailable backend/provider errors, retry controls and logout clearing. At 390px width, tables should scroll within their region and cards/controls remain accessible.

## Limitations and verification record

There is no live marketplace/Kaspi integration, FX feed, persistent quotation history, automatic specification matching, supplier-product relation, demand forecasting or provider conversation memory. Natural-language private intents use the documented narrow grammar; other private requests must use the structured forms. The optional LLM is a catalog-query interpreter, not an unrestricted business agent. Live OpenAI model availability/output quality and paid inference remain unverified. No new migration or live database modification is required or performed.

Final test counts, exact file list and browser results are recorded in AI_COPILOT_VERIFICATION.md after execution.

For field-by-field manual tests, safe configuration diagnostics and a fictional quotation CSV, see [the beginner testing checklist](AI_COPILOT_TESTING.md).
