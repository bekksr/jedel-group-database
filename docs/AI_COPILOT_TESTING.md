# Beginner checklist: test the Copilot safely

Open **http://localhost:4200/ai-assistant**. Testing catalog search, inventory, quotation arithmetic and draft proposals does not require Groq. No step below creates an order or changes stock. Do not click Create order or any purchasing approval/delivery action while following this checklist.

## What the diagnosis found

Checked on 2026-11-12 using read-only diagnostics:

| Setting / dependency | Result |
|---|---|
| backend/.env | Present; automatic loading enabled |
| AI_ENABLED | No file entry; disabled by default |
| AI_PROVIDER | No file entry; supported Groq default applies |
| AI_MODEL | Default: openai/gpt-oss-20b |
| GROQ_API_KEY | Missing |
| Optional timeout/token/call-limit settings | No file entries; bounded defaults apply |
| Compatible SDK in plain python | Missing |
| Compatible SDK in backend/.venv | Installed: 3.49.0 |

No credential values were displayed, modified or authenticated. The file loader reads `backend/.env`; existing PowerShell/process environment values take precedence. Root `.env` is for Docker Compose, not native Django. Restart Django after editing settings; an already running process does not reliably reload `.env` edits automatically.

Both `http://127.0.0.1:8000/api/ai/capabilities/` and `http://localhost:4200/api/ai/capabilities/` returned HTTP 200, `product_search=true`, `chat_configured=false`. Anonymous private-tool flags were false, as required. A false private flag while signed out does not mean the database or tools are broken. Inspect capabilities on the Angular origin in the browser where you are logged in; `localhost` and `127.0.0.1` do not share host cookies.

Read-only catalog POSTs through the running Angular proxy succeeded with CSRF. These returned only real product IDs/names/categories, not prices or stock.

## Start on Windows

First terminal, using the project interpreter with the SDK installed:

```powershell
cd D:\BIS_project\jedel-group-database\backend
.\.venv\Scripts\python.exe manage.py runserver
```

Alternatively activate that environment, then use your requested ordinary command:

```powershell
.\.venv\Scripts\Activate.ps1
python manage.py runserver
```

If PowerShell blocks activation, use the explicit interpreter command above; changing execution policy is unnecessary. Plain `python manage.py runserver` still supports local tools, but its current interpreter lacks the optional SDK. If dependencies are absent, install them into the project environment once with `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`. This downloads packages, not model inference.

Second terminal:

```powershell
cd D:\BIS_project\jedel-group-database\frontend
npm.cmd start
```

Use the existing PostgreSQL service/configuration. No migration, role setup, database reset or new user is required. Open the page on `localhost:4200`. Stop each development server using Ctrl+C in its own terminal; do not kill unrelated processes.

## Accounts and the Ask button

| Account | Search | Local inventory / compare quotes / order status | Draft |
|---|---|---|---|
| Anonymous | Yes | No | No |
| Basic User | Yes | No | No |
| Employee / Manager / System Administrator | Yes | Yes | Yes |
| Analyst / Tester | Yes | Yes | No |
| Security Administrator | Yes | No | No |

Use an existing appropriately authorized account and your own password. Do not register another account expecting elevated access: registration grants Basic User. Django Staff alone does not grant purchasing access. This task does not assign roles or alter accounts.

The Ask button is intentionally disabled for an empty message, while session/capabilities load, when signed out, or when a required tool permission is missing. A general message such as `Find Laptop Dell` requires the optional provider, login and explicit external-provider consent. A supported local question requires only login plus its role permission, not a key or consent. The page now prints the reason below the form. The local-example button fills a valid inventory question without sending anything automatically.

Supported private questions use a narrow grammar, not general AI interpretation. Use the exact local phrases below. `What is inventory?` is not a supported local command. Permission changes remain administrator-controlled; logging in repeatedly never grants a role.

## Field-by-field manual checklist

### 1. Product search: everybody, no key

In **Search the product catalog**, enter:

| Field | Enter |
|---|---|
| Product name | Laptop Dell |
| Category | Electronics |
| Name matching | Exact name |

Click **Search catalog**. Expected: product **#1 Laptop Dell**, category **Electronics**, source **PostgreSQL public-safe catalog**. No supplier contacts, price or stock appears in these cards, including for privileged users.

Clear Product name, leave Category `Electronics`, choose `Contains name`, click Search catalog. Expected at the audited snapshot: **#1 Laptop Dell** and **#2 Office Monitor**. These are actual existing records, not sample products. If real catalog records later change, the page must show their current state.

For an empty-state test enter Product name `NO-SUCH-COPILOT-TEST-ITEM`, clear Category, click Search catalog. Expected: honest no-matches message. Reset the field afterward.

### 2. Local inventory question: authorized reader, no key

Log in through Account with an existing Employee/Manager/Analyst/System Administrator account, return to AI Assistant and wait for loading to finish.

- Click **Use local low-stock question**, or enter exactly `Which products have low stock?` in **Message**.
- Leave Groq consent unchecked. It is not required and is disabled for local questions.
- The page should say the question runs locally and needs no API key or credits; **Ask Copilot** should be enabled.
- Click **Ask Copilot**. Expected: a conversation response explicitly identifying PostgreSQL, and the Inventory assistant section showing actual eligible records or a genuine empty result.
- Default low-stock threshold is the proposed request value **20**, not a stored reorder point or demand forecast.

For category inventory enter exactly `Show inventory levels for category Accessories.` and click Ask Copilot. Expected: actual inventory for category Accessories, including the existing **Wireless Keyboard** record, if it remains in the catalog. Stock numbers are visible only to authorized readers.

Structured alternative: **Inventory category** = `Accessories`; **Low-stock threshold** = `20`; uncheck **Only products at or below threshold**; click **Review inventory**. This displays all matching category records regardless of threshold. Keeping the checkbox checked can legitimately produce no rows.

Basic/Security accounts must instead see an insufficient-permission explanation and a disabled local Ask action. Direct protected API requests remain forbidden independently of this UI behavior.

### 3. Fictional quotation arithmetic: authorized reader, no key

Sample file: [examples/copilot-fictional-quotes.csv](examples/copilot-fictional-quotes.csv).

**This is fictional interface-test input, never a real offer or purchasing recommendation.** The IDs reference existing product #1 and supplier #1 solely to satisfy importer references. The two rows are fictional quote variants for the same supplier; they do not claim that supplier issued any quotation. All prices, availability, delivery and specifications in the sample are invented test inputs and labelled FICTIONAL. No supplier contact details appear in the file.

1. Search for `Laptop Dell` as above, then click **Select product #1**.
2. **Required quantity (individual items)** = `10`.
3. **Quotation CSV**: choose `docs/examples/copilot-fictional-quotes.csv` from this repository.
4. Leave **Maximum delivery days** blank.
5. In this controlled interface test, check both source/equivalence confirmations only for the clearly labelled fictional test input. They must never be interpreted as approval or verification of a real supplier quotation.
6. Click **Compare quotations**.

Expected deterministic calculations:

| Reference | Calculation | Total | Effective unit cost |
|---|---|---:|---:|
| FICTIONAL-A | 10 × 10.25 + 5.00 | 107.50 KZT | 10.7500 |
| FICTIONAL-B | 10 × 9.50 + 20.00 | 115.00 KZT | 11.5000 |

A ranks first despite B's lower unit price, because delivery is included. Source and quote/import timestamps must be visible. These values come from **Python Decimal arithmetic on the uploaded test CSV**, not PostgreSQL purchasing prices or Groq. No quotation or business record is saved.

The supplied file has a limited validity window and will eventually expire. Generate a fresh fictional file without any database access:

```powershell
# From backend; choose an output name that does not already exist
.\.venv\Scripts\python.exe manage.py copilot_sample_csv --product-id 1 --supplier-id 1 --output ..\docs\examples\copilot-fictional-quotes-new.csv
```

It uses yesterday's quote timestamp and a validity end seven days from generation. It refuses to overwrite a file. If IDs 1 no longer exist, choose actual IDs from your authorized page and substitute them; do not create records just to satisfy this test. Other comparisons must use one currency and individual-item unit aliases. Mixed currencies, invalid values or unknown IDs fail validation. Expired/stale quotes, insufficient availability, unmet minimums and excessive delivery days are excluded rather than winning.

Exact header (all columns required, in this order):

```csv
product_id,supplier_id,unit_price,currency,unit,available_quantity,min_order_quantity,delivery_cost,delivery_days,quoted_at,valid_until,source,reference,specifications
```

### 4. Review-only order draft: authorized purchasing staff, no key

Keep selected product #1 and quantity `10`. In **Purchase order assistant**, choose the existing supplier whose displayed ID is **#1**. Click **Prepare review-only draft**.

Expected: **Draft proposal — not saved**, real product/supplier identifiers, actual current internal catalog price and calculated subtotal in KZT. This price is distinct from the fictional quotation prices above. Availability, taxes and supplier-product relationship remain unverified. There is no new order ID, no order creation and no stock receipt.

Local chat alternative: `Prepare a purchase order for 10 units of product 1 from supplier 1.` Click Ask Copilot without Groq consent. Do not click through to create a real order during this checklist.

Analyst cannot draft even though it can compare quotes and read inventory. Basic/Security cannot draft. These restrictions are enforced by Django.

For **Check an existing order**, copy an allowed existing ID from your protected Orders page into **Purchase order ID**, click **Check order status**. Expected: its actual PostgreSQL state, unchanged. The local equivalent is `Show purchase order N status.` with a real ID substituted for N. No order data is exposed to Basic User.

### 5. Optional Groq chat: configuration only until separate request approval

The only cloud provider is Groq, using the installed OpenAI-compatible Python SDK 3.49.0 with its base URL fixed to `https://api.groq.com/openai/v1`. The reviewed model is `openai/gpt-oss-20b`. No OpenAI API key or fallback is used. Unsupported Responses fields (including `store` and `previous_response_id`) are omitted. Each question is independent; private tool results and prior conversation are never sent to Groq.

Edit **backend/.env locally in your editor**. Preserve all existing database/Django entries. Add these entries; replace placeholders privately, never in chat, screenshots, Git or PowerShell history:

```dotenv
AI_ENABLED=true
AI_PROVIDER=groq
GROQ_API_KEY=YOUR_PRIVATE_PROJECT_KEY
AI_MODEL=openai/gpt-oss-20b
AI_TIMEOUT_SECONDS=15
AI_MAX_OUTPUT_TOKENS=512
AI_DAILY_CALL_LIMIT=100
AI_USER_DAILY_CALL_LIMIT=20
```

The key placeholder is not a working credential. Keep your Groq account on Free Tier; do not enable billing. Application limits cannot verify your provider billing tier. See [Groq model documentation](https://console.groq.com/docs/model/openai/gpt-oss-20b). This task has not edited your real `.env` or enabled the provider.

Restart Django using the `.venv` interpreter, then run the safe diagnostic:

```powershell
.\.venv\Scripts\python.exe manage.py copilot_status
```

It prints only setting presence/validity, SDK version and whether configuration is complete. It prints the approved model identifier, but never a key; it does not contact Groq or query the database. `provider_configuration_complete=true` is a local configuration check only; availability remains unverified. Existing process variables override file settings, so use a fresh terminal if a stale override is suspected. Do not display your environment or dump settings to troubleshoot secrets.

**Obtain separate approval before making a real provider test request.** After such approval, log in, type one of the first two catalog queries below, check consent and click Ask Copilot. Expected: backend message says the model interpreted search filters and returned cards come from PostgreSQL. No product records, quotes, inventory or order data are sent to the model. A configured provider can still return an honest timeout/service error if billing, model access or network access is unavailable.

Three examples grounded in the audited catalog:

| Query | How to test without cloud AI | Source |
|---|---|---|
| Find Laptop Dell in our product catalog. | Product name Laptop Dell; category Electronics; Exact name; Search catalog | PostgreSQL; optional model only interprets wording |
| Show products in the Electronics category. | Clear Product name; category Electronics; Search catalog | PostgreSQL; expected Laptop Dell / Office Monitor |
| Show inventory levels for category Accessories. | Authorized reader: Message field, Ask Copilot, no consent | Local Django + PostgreSQL; Wireless Keyboard category |

## Troubleshooting

| Symptom | Check / action |
|---|---|
| Ask disabled with no message | Enter text or choose the local example; see the displayed reason |
| General catalog phrase disabled | Provider is unconfigured or consent/login is missing; use ordinary search without a key |
| Local question disabled | Use exact supported wording, wait for session/capabilities, and check actual role; Basic registration does not grant business access |
| Message says not configured after editing .env | Check backend file, correct spelling, enabled flag, model/key presence, interpreter SDK and process overrides; restart Django |
| SDK missing | Use `.venv` interpreter or install requirements into the interpreter actually running Django |
| Anonymous private capabilities false | Expected; open capabilities on localhost:4200 in the signed-in browser |
| 403 / CSRF | Use the Angular URL and its `/api` proxy; refresh session/cookie; do not disable CSRF |
| Empty catalog result | Category is exact, case-insensitive; clear filters and use actual catalog names |
| No low-stock rows | Increase proposed threshold or uncheck low-only; do not alter stock to manufacture a result |
| CSV rejected | Match exact header, existing IDs, selected product, UTF-8, whole quantities, two-decimal costs, one supported currency, timezone-aware dates and confirmations |
| Quotation excluded | Read expiry/30-day freshness/MOQ/availability/delivery warnings; regenerate only fictional testing input, never falsify real quote freshness |
| 429 | Wait for the applicable rate/budget window; repeated login attempts do not fix permissions |
| 503 from chat | Read local status, then key/model/billing/network diagnostics after cost authorization; ordinary tools remain usable |
| Cannot reach Django / proxy failure | Confirm both terminals are running on ports 8000/4200; check proxy target 127.0.0.1:8000; retry after restoration |
| Port occupied | Reuse/stop only the server you own; do not kill unrelated processes |

## Automated verification and safety

Tests use a marked disposable PostgreSQL cluster with provider disabled and test credentials cleared. The fictional generator is tested against the real importer on isolated fixtures; setup diagnostics are tested to avoid database queries and secret/model-value disclosure. The real-browser scenario submits the local inventory question with AI disabled. Live connectivity verification used only CSRF retrieval, public-safe search and public capabilities; no live login/session creation, order/stock/group writes or model request was performed.

Current test results are recorded in AI_COPILOT_TESTABILITY_RESULTS.md. No migrations, commits or pushes are part of this task.
