# Groq-only conversion — 12 November 2026

## Result and architecture

One existing `/ai-assistant` page now uses Groq as its sole cloud provider.
No OpenAI API account/key is required. The existing `openai==3.49.0` Python
package remains as the compatible client; no dependency changes were needed.

The endpoint is fixed to `https://api.groq.com/openai/v1/responses`. The reviewed
and accepted model is `openai/gpt-oss-20b`. Other providers/models fail closed;
there is no endpoint/model/provider fallback. Official compatibility evidence:
[Responses API](https://console.groq.com/docs/responses-api) and
[model capabilities](https://console.groq.com/docs/model/openai/gpt-oss-20b).
These document model/tool support, not successful connectivity for this account.

The old adapter forced one catalog-search call and ignored conversational prose.
The new adapter accepts a general English/Russian reply or one whitelisted,
validated function call. Django executes public search, authorized inventory,
order status or review-only drafts locally. Comparison requests give guidance
to the existing approved CSV form, where real Decimal calculations remain local.
No supplier quotations are transmitted to Groq for interpretation.

Every private function rechecks backend capabilities. Basic User cannot read
private stock, supplier contacts, prices or orders. No AI function can create,
approve, deliver, cancel or delete orders, edit stock, or execute SQL.

## Privacy, history and API compatibility

- Consent is required for external chat. Only the current message is sent.
- No database rows, tool results, prior messages or uploaded CSV leave Django.
- Recognizable secrets/mutation commands are rejected; this is not complete DLP.
  Users must not type confidential information into external chat.
- Groq prose is labeled general conversation, not database facts. ORM results
  remain clearly attributed to PostgreSQL. Generated prose is not a verified
  source of business facts.
- No `store`, `previous_response_id`, `truncation`, `include` or related unsupported
  response-storage fields are sent. Context is explicitly zero previous turns;
  the bounded UI transcript is display-only. Ask independent questions.
- One inference attempt, at most one function, no tool-result follow-up, no
  recursive loop, no retries, no built-in browsing/code/MCP tools.
- Default 1000 input characters, 512 output tokens, 15-second timeout,
  5 chat requests/minute/user, and rolling 24-hour 100 global/20 user attempt
  budgets. Attempts include failures. Settings are bounded and configurable.
- HTTP 429 has a retry-later message; credential failures/outages/timeouts are
  sanitized. All local tools remain available independently.

The application does not enable billing or upgrade accounts. Operators must
keep Groq on Free Tier: a client cannot certify or enforce the account billing
tier. LocMemCache limits are per process and reset on restart; production
multiworker operation requires a shared atomic cache and edge throttling.

## Configuration and Windows startup

Privately edit `backend/.env`, preserving existing Django/database settings:

```dotenv
AI_ENABLED=true
AI_PROVIDER=groq
AI_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=<paste privately in your editor>
```

The inspected file loads correctly, but AI is disabled and the Groq key is
missing. This task did not modify that file or any real credential. The project
virtual environment has SDK 3.49.0; plain system Python lacks the SDK.

Backend PowerShell:

```powershell
cd D:\BIS_project\jedel-group-database\backend
.\.venv\Scripts\Activate.ps1
python manage.py copilot_status
python manage.py runserver
```

Frontend, second PowerShell:

```powershell
cd D:\BIS_project\jedel-group-database\frontend
npm.cmd start
```

If dependencies are absent, install the existing pinned requirements into the
virtual environment and run `npm.cmd ci` in frontend. Restart Django after
editing `.env`; existing process variables take precedence.

`copilot_status` makes no network/database request and never prints credentials.
Configuration readiness is not connectivity verification. Optional one-request
smoke command, **only after separate approval**, is:

```powershell
python manage.py copilot_smoke --confirm-external-request
```

It sends one harmless greeting with 64 output tokens and no business data. It
does not retry. Without the flag it refuses to send a request. No real smoke
request was executed during this task.

## Manual checks

1. Open `http://localhost:4200/ai-assistant`. Public search works without a key.
2. Sign in as Basic User; private inventory/order tools remain unavailable.
3. As an authorized reader, enter `Which products have low stock?` or
   `Какие товары заканчиваются?` without consent. Ask Copilot returns local
   PostgreSQL inventory with no external request.
4. After privately configuring Groq and obtaining approval for a real test,
   enter `Привет! Чем ты можешь помочь?`, consent, and click Ask Copilot.
   A general reply is explicitly labeled Groq conversation, not database facts.
5. Ask `Найди ноутбук Dell в нашей базе.` with consent. A valid catalog plan
   returns only actual matching public-safe database records or an empty result.
6. Ask `Покажи товары категории Electronics.` for a category search. Categories
   must exist in your actual catalog; the model is instructed not to invent them.
7. Ask `Помоги выбрать поставщика.` as an authorized reader. Use the resulting
   comparison guidance to select a real product and provide approved/equivalent
   quotation CSV in Best offer finder. Totals are local Decimal results.
8. Use the structured review-only draft form with real authorized IDs. Nothing
   is saved. Existing normal purchasing workflows remain separate.
9. On errors read the displayed status; never work around CSRF or permissions.
   Status/key/model presence does not prove provider connectivity or Free Tier.

## Executed verification

| Check | Actual result |
| --- | --- |
| Focused Copilot/setup Django tests | 35 passed, 0 failed, 0 skipped |
| Full Django regression | 161 discovered: 160 passed, 0 failed, 1 opt-in browser skipped |
| Separate isolated browser wrapper | 1 passed, 0 failed, 0 skipped |
| Full Chromium scenarios inside wrapper | 9 passed, 0 failed, 0 skipped |
| Full Angular suite | 103 passed, 0 failed, 0 skipped; 13 files |
| Django system check | No issues |
| TypeScript `--noEmit` | Exit 0 |
| Angular production build | Passed |
| Docker Compose config validation | Not run successfully: Docker unavailable |
| Live Groq connectivity | Not tested; no approval/key |

Backend writes used only disposable PostgreSQL 17, never `jedel_group_db`.
Existing purchasing, atomic/concurrent receipt, auth/session, admin and RBAC
regressions passed. Provider tests use mocks for English/Russian replies,
function calls, unauthorized tools, malformed output, missing/invalid config,
timeouts, invalid credentials, 429/outages, no retries and unsupported fields.
Browser tests exercise actual local APIs, quotations and drafts with cloud
disabled, not live model quality. Early Angular assertions exposed an outdated
status string and an encoding regression; both were corrected before the final
103-test passing run.

Local evidence: `backend/.runtime/groq-focused.log`, `groq-regression.log`,
`groq-browser.log`, and `groq-angular.log` (ignored runtime artifacts).

## Files changed for this conversion

- `.env.example`, `compose.yaml`, `backend/.env.example`
- `backend/config/settings.py`
- `backend/apps/purchasing/copilot/provider.py`, `views.py`, `orchestration.py`
- `backend/apps/purchasing/management/commands/copilot_status.py`
- `backend/apps/purchasing/management/commands/copilot_smoke.py` (new)
- `backend/apps/purchasing/test_copilot.py`, `test_copilot_setup.py`
- `backend/scripts/test_postgres.py`
- `frontend/src/app/core/data/copilot.service.ts`
- `frontend/src/app/pages/copilot.ts`, `copilot.html`, `copilot.spec.ts`
- `frontend/e2e/copilot.spec.ts`
- `docs/AI_COPILOT.md`, `AI_COPILOT_TESTING.md`
- `docs/AI_COPILOT_TESTABILITY_RESULTS.md`, `AI_COPILOT_VERIFICATION.md`
  (historical-record notices only)
- `docs/GROQ_CONVERSION_RESULTS.md` (new)

Earlier unstaged visual-regression work is preserved separately. No Git commit,
push, merge, identity change or staging occurred. No live migrations, database
records, user memberships, stock, PostgreSQL GRANT scripts or purchasing service
implementations were changed. Test bootstrap applies auth migrations only inside
the disposable test cluster, as required by the existing isolated runner.

Readiness: implementation verified with mocked Groq and real local tools;
live configuration/connectivity, Free Tier account eligibility, live Russian
answer quality, Docker and macOS remain unverified.


## Follow-up verification ? 13 November 2026

The conversion was already implemented and was re-inspected rather than replaced.
Groq remains the only cloud endpoint/model path, with no OpenAI key requirement
or provider fallback. Official Groq Responses/model documentation was checked
again. No unsupported response storage/chaining parameters were introduced.

This follow-up fixes the false-ready case when the selected Python lacks the
compatible SDK. Capabilities now return a sanitized `chat_status`; the UI keeps
external submission disabled and explains the project-venv fix for missing SDK.
`copilot_status` reports `runtime_status=configured_unverified` only when local
settings and SDK checks pass. This is explicitly not provider authentication.

Current running Django and Angular proxy capabilities both returned HTTP 200,
provider groq, configured_unverified, chat_configured=true and local catalog
available. No chat POST or external inference was used for these checks. The
private key was already present and AI enabled; private configuration was not
changed. A key supplied in chat was not copied to source/configuration; it should
be revoked and replaced privately. Never publish or repeat exposed credentials.

The README now gives explicit key creation/rotation/private-file instructions,
Windows and macOS backend interpreter commands, frontend startup and how to
interpret SDK/configuration status. Native Mac execution remains unverified.

Executed final checks:

| Check | Result |
| --- | --- |
| Full Django suite on disposable PostgreSQL | 166 discovered: 165 passed, 0 failed, 1 opt-in browser skipped; 116.229s |
| Full Angular suite | 104 passed, 0 failed, 0 skipped; 13 files |
| Angular production build | Passed; initial 462.68 kB |
| TypeScript noEmit | Passed |
| Django system check | No issues |
| Actual Django/Angular proxy capabilities GET | Both HTTP 200 |
| Source/secret-template guard and diff whitespace check | Passed |
| Live Groq inference | Not run; separate approval required |

The full ten-scenario browser suite passed in the preceding portability task;
it was not rerun for this follow-up. Backend/provider tests use mocked responses
for English/Russian conversation, tool calls, unauthorized requests, credentials,
timeouts and rate limits; no live provider answer quality is claimed. No live
schema or business record changes were made. The isolated test bootstrap uses
only its disposable cluster. No new migration files were introduced.

Files changed in this follow-up: README.md; backend/apps/purchasing/copilot/provider.py;
backend/apps/purchasing/copilot/views.py;
backend/apps/purchasing/management/commands/copilot_status.py;
backend/apps/purchasing/test_copilot.py;
frontend/src/app/core/data/copilot.service.ts;
frontend/src/app/pages/copilot.html;
frontend/src/app/pages/copilot.spec.ts; this report.
Earlier Groq/UI/portability changes remain preserved and unstaged. No commits,
pushes, merges or Git identity changes occurred.

Evidence: backend/.runtime/groq-final-backend.log and groq-final-angular.log.
