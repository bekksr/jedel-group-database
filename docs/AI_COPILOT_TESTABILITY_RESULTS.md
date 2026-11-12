> Historical verification record. The provider configuration below predates the Groq-only conversion. Use [AI_COPILOT.md](AI_COPILOT.md) and [GROQ_CONVERSION_RESULTS.md](GROQ_CONVERSION_RESULTS.md) for current setup and results.

# Copilot testability diagnosis and results

Date: 2026-11-12. Branch: feature/fullstack-integration-auth; existing dirty work preserved. No commit/push/migration or live business/account/permission write.

## Root cause and changes

The native backend loads backend/.env correctly. That file has no AI configuration entries: AI_ENABLED defaults disabled, AI_MODEL and OPENAI_API_KEY are missing, and AI_PROVIDER uses the supported OpenAI default. Plain python lacks the SDK; backend/.venv has OpenAI 3.49.0. No credential value or configured model value was printed, edited, authenticated or sent anywhere. No paid inference request ran.

Ask Copilot is not a universal offline chat button: arbitrary catalog wording needs configured external interpretation plus login/consent. Local inventory/order intents already execute before provider checks in Django. The old UI used broad keyword detection, provided little explanation and could allow unauthorized local attempts. It now mirrors the supported narrow grammar for button eligibility, checks server capability flags, explains every disabled state, distinguishes local vs external execution, disables irrelevant consent and provides a local low-stock suggestion. Backend authorization remains independent and unchanged.

Added safe commands: copilot_status prints only presence/validity and dependency/configuration metadata, never credentials/model values; copilot_sample_csv writes two clearly fictional test variants with fresh validity dates and refuses overwrite. Neither command queries or modifies the database or calls a provider. The test CSV contains no supplier contacts, real quotations or claimed marketplace facts. Existing IDs 1/1 are used solely as reference inputs; sample arithmetic is not a real supplier recommendation.

## Live read-only communication checks

| Check | Result |
|---|---|
| Direct Django GET /api/ai/capabilities/ | HTTP 200; product_search true, chat_configured false |
| Angular-proxied GET /api/ai/capabilities/ | HTTP 200; same anonymous flags |
| CSRF + Angular-proxied search: exact Laptop Dell / Electronics | HTTP 200; product #1 |
| Angular-proxied search: category Electronics | HTTP 200; Laptop Dell #1, Office Monitor #2 |
| Angular-proxied search: exact Wireless Keyboard / Accessories | HTTP 200; product #3 |

No live login was performed for verification. Private endpoint/role tests and authenticated browser workflows used only explicitly isolated disposable PostgreSQL. The live requests above were capabilities, CSRF cookie retrieval and read-only public catalog search, never chat.

## Actual tests

| Execution | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Selected isolated PostgreSQL backend suite | 28 | 0 | 0 |
| Chromium scenarios inside backend browser wrapper | 7 | 0 | 0 |
| Full Angular unit suite (12 files) | 91 | 0 | 0 |

Backend suite: 56.394 seconds. Chromium: 29.1 seconds. Browser cases are nested in the backend wrapper, not extra backend tests. Selected backend modules: test_copilot, test_copilot_setup, test_browser. These cover search/category/public-field isolation, every application role's private-tool permissions, Decimal comparisons, invalid/missing/stale CSV, no-key behavior, local questions, CSRF, mocked provider failures, budgets/rates, generated fixture import, diagnostics redaction and existing browser registration/session/purchasing workflow regression. A full repeat of unrelated backend modules was not performed for this UI/diagnostics change. Existing model/service logic has no diff.

Real Chromium verified Anonymous/Basic safe catalog, Employee comparison, draft-only behavior, actual local chat submission with provider disabled, order/stock preservation, desktop/mobile layout, the existing all-role five-section matrix and Manager procurement workflow. Optional provider responses were mocked in unit tests; no real key/model/billing availability is certified.

Production Angular build passed: 435.76 kB initial; 110.77 kB estimated transfer. Django check: no issues. git diff --check passed. Live four-table canonical fingerprints and counts unchanged: suppliers 3, products 5, purchase_orders 5, purchase_order_items 8. Original business models/services and PostgreSQL role scripts unchanged.

## Files for this task

- frontend/src/app/pages/copilot.ts
- frontend/src/app/pages/copilot.html
- frontend/src/app/pages/copilot.spec.ts
- frontend/e2e/copilot.spec.ts
- backend/apps/purchasing/management/commands/copilot_status.py (new)
- backend/apps/purchasing/management/commands/copilot_sample_csv.py (new)
- backend/apps/purchasing/test_copilot_setup.py (new)
- backend/apps/purchasing/test_copilot.py
- docs/examples/copilot-fictional-quotes.csv (new)
- docs/AI_COPILOT_TESTING.md (new field-by-field checklist)
- docs/AI_COPILOT_TESTABILITY_RESULTS.md (this report)
- docs/AI_COPILOT.md (testing-guide link)

No dependencies or real .env values changed. The provider remains disabled/unconfigured. No marketplace integration, online price verification, paid inference, Docker execution or macOS verification is claimed. Follow [AI_COPILOT_TESTING.md](AI_COPILOT_TESTING.md) for every field/button/expected source, safe provider activation and troubleshooting. Paid testing still requires separate explicit authorization.
