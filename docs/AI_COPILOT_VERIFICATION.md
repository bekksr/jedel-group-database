# Copilot delivery and verification

The architecture, endpoints, role matrix, configuration, CSV schema/calculations, startup commands, test commands and limitations are in [AI_COPILOT.md](AI_COPILOT.md).

## Files changed in this task

New Django modules:
- backend/apps/purchasing/copilot/__init__.py
- backend/apps/purchasing/copilot/validation.py
- backend/apps/purchasing/copilot/tools.py
- backend/apps/purchasing/copilot/offers.py
- backend/apps/purchasing/copilot/provider.py
- backend/apps/purchasing/copilot/orchestration.py
- backend/apps/purchasing/copilot/views.py
- backend/apps/purchasing/test_copilot.py

Updated backend/configuration:
- backend/apps/purchasing/api/urls.py
- backend/config/settings.py
- backend/requirements.txt (OpenAI SDK 3.49.0 added; existing Django/DRF pins retained)
- backend/.env.example
- backend/scripts/test_postgres.py (provider disabled, credentials cleared, streamed diagnostics, expanded bounded suite timeout)
- backend/README.md

New Angular files:
- frontend/src/app/core/data/copilot.service.ts
- frontend/src/app/pages/copilot.ts
- frontend/src/app/pages/copilot.html
- frontend/src/app/pages/copilot.scss
- frontend/src/app/pages/copilot.spec.ts
- frontend/e2e/copilot.spec.ts

Updated frontend/configuration:
- frontend/src/app/app.ts (AI Assistant navigation)
- frontend/src/app/routes.ts (/ai-assistant)
- frontend/src/app/auth.ts (session-restoration readiness signal; authentication rules unchanged)
- frontend/src/app/account-navigation.spec.ts
- frontend/README.md
- compose.yaml (optional server-only provider variables)
- .env.example
- README.md
- docs/AI_COPILOT.md
- docs/AI_COPILOT_VERIFICATION.md

No frontend dependency changes, new migrations, business-model/service changes, PostgreSQL script changes, commits or pushes. Unrelated existing dirty files were preserved.

## Coverage

| Area | Backend / integration | Frontend / Chromium |
|---|---|---|
| Public catalog | Real PostgreSQL records, exact/partial/category, bounded results, SQL field isolation | Cards, filters, empty/loading/error/retry; Anonymous/Basic real-browser desktop/mobile |
| Authorization | Anonymous and all six roles; tool-level checks; private endpoint denials | Capability-based tool visibility; private results cleared on logout and late responses ignored |
| Quotations | Decimal totals/ranking, invalid prices/quantities, duplicate/oversized CSV, currency/unit restrictions, stale/expired/MOQ/availability/delivery exclusions | Real fixture CSV upload and 107.50 KZT total with source/calculation display |
| Inventory | Real stock/category filters, explicit proposed thresholds, Basic denied | Structured results and local chat with AI disabled |
| Order assistance | Read-only proposal and real status; no stock/order writes | Review-only draft and browser before/after count/stock verification |
| Provider | Missing key, mocked response, timeout/failure, invalid/malicious tool calls, consent, budgets/rate/size, prompt-injection isolation | Consent and configured-state controls, grounded message rendering |
| Existing ERP | Registration/session/CSRF/RBAC/Admin/CRUD/workflow/rollback/concurrency/double delivery | Existing account, all-section and procurement/browser scenarios retained |

Browser provider inference is not live-tested; browser uses the actual optional-disabled configuration and real Django/PostgreSQL deterministic tools. Provider responses are mocked only in unit tests. No live credits were spent.

## Data preservation

Read-only current business verification matched the prior approved RBAC baseline in complete canonical fingerprints: suppliers 3, products 5, purchase_orders 5, purchase_order_items 8. Prices, stock and historical states are included in these checks. No live migrations or business writes ran. New automated fixtures and role records existed only in marked disposable PostgreSQL clusters. Live account/membership data had changed since the earlier RBAC task baseline, so that old cross-task user snapshot was not falsely reported unchanged; this Copilot task performed no live user or group writes.

## Failures investigated before final verification

Initial combined runs exceeded the previous 180-second overall cap, which discarded useful partial output. The expanded suite now streams test progress and has a bounded 300-second overall limit. A browser supplier selector needed an explicit accessible name, then selection by visible label for Angular numeric ngValue options. The new retry unit test needed asynchronous rejection settlement before DOM assertions. Adding two login scenarios then exposed cross-scenario use of the existing 10/min login-IP bucket; the new isolated browser actors now use distinct documented TEST-NET client IP headers. No production login throttle, account permission or business validation was weakened. No failing test was disabled.

Browser verification also exposed a session-restoration race: a search submitted before restoration could be correctly discarded by the account-generation guard, leaving the user without results. Search now waits for session/capability readiness; the stale-account protection is retained and covered by unit tests. Final execution results follow below.

## Final executed results

| Execution | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Last combined PostgreSQL run, before the final frontend readiness fix | 148 | 1 browser wrapper | 0 |
| Browser integration wrapper rerun after the fix | 1 | 0 | 0 |
| Chromium scenarios inside that passing wrapper | 7 | 0 | 0 |
| Final Angular unit suite (12 files) | 89 | 0 | 0 |

The 148 non-browser backend cases passed and backend implementation did not change afterward. The single failed wrapper was rerun successfully after frontend/test fixes: all 149 unique backend cases therefore have passing results across these runs. A fresh combined 149-case green run was not repeated after the final UI-only change; do not misrepresent the earlier failed job as a passing full job. Browser cases are nested in the wrapper, not additional backend tests. No tests were skipped or disabled.

Passing browser wrapper: 54.194 seconds; seven Chromium scenarios: 42.4 seconds. The new Copilot scenarios took 3.6 and 3.8 seconds and used actual Angular -> Django -> isolated PostgreSQL requests. Public/Basic and authorized Employee flows were checked at desktop and 390px width, including role restrictions, sources, real product/category filters, approved fixture CSV arithmetic, review-only proposals and unchanged orders/stock. Existing all-role pages, unavailable-backend handling, registration, session refresh, logout and Manager purchasing lifecycle also passed.

Final frontend suite: 89 passed. Production Angular build passed: 433.60 kB initial, estimated transfer 110.24 kB. Actual installed SDK 3.49.0 exposes all implemented Responses.create parameters; this was inspected without inference. Django system check: no issues. Git whitespace check passed. Original business model/service/dump and PostgreSQL role-script comparisons showed no diff.

No paid inference, marketplace feed, Docker execution or macOS/Safari/Firefox verification was performed. Docker was unavailable in this environment. Existing Python requirements retain Django 6.0.10; automated backend runs used the existing default Python 3.13 / Django 6.0.3 interpreter. SDK installation/interface inspection used the project virtual environment. This distinction is retained rather than claiming all interpreter environments were fully tested.

Readiness: **IMPLEMENTED WITH UNVERIFIED ENVIRONMENTS**. The deterministic MVP and mocked-provider integration are tested; real provider model/key behavior and production/distributed quota enforcement remain deployment checks. No live schema migration approval is required for this request-scoped MVP. No commits or pushes were made.
