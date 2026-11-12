# Jedel.Group ERP

Supplier and purchasing ERP with Angular 21, Django 6/DRF and PostgreSQL 17. Use the website for registration, sessions, catalog management, procurement and reports. No Postman, pasted Bearer token or paid AI key is needed.

## Quick Start: Docker (recommended)

Install Docker Desktop for your operating system and CPU, and start it. Use Docker Compose v2 (the `docker compose` command). From a terminal:

```sh
git clone https://github.com/bekksr/jedel-group-database.git
cd jedel-group-database
```

First-time configuration, **Windows PowerShell**:

```powershell
.\scripts\setup-docker.ps1
```

First-time configuration, **macOS/Linux**:

```sh
bash scripts/setup-docker.sh
```

These scripts generate two independent secrets into the ignored root `.env`, preserve any existing file and validate Compose. They do not initialize your host PostgreSQL or start services. If PowerShell blocks a trusted local script, use `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-docker.ps1` for that invocation only.

Start the whole environment from the repository root:

```sh
docker compose up --build
```

Expected: database healthy, `Isolated development schema ready`, Angular compilation complete. The first build downloads dependencies and can take several minutes. In another terminal, create your own administrator interactively:

```sh
docker compose exec backend python manage.py createsuperuser
```

There are **no default administrator passwords**. New public registrations receive only Basic User. Your administrator assigns other roles deliberately.

| Interface | URL |
| --- | --- |
| Public Home | http://localhost:4200/ |
| Account: Log in / Register | http://localhost:4200/auth |
| AI Assistant | http://localhost:4200/ai-assistant |
| Django landing page | http://localhost:8000/ |
| Django Admin | http://localhost:8000/admin/ |
| API / documentation | http://localhost:8000/api/ / http://localhost:8000/api/docs/ |
| Database readiness | http://localhost:8000/health/ |

The API requires permissions; an anonymous 401 from a protected endpoint is expected. Open the website on **localhost**, using its `/api` proxy, so cookies and CSRF stay consistent.

## What you can do

- Public Home, section previews and product-name/category search.
- Individual registration, automatic login, persistent server sessions, profile and logout.
- Six backend-enforced application roles; protected contacts, prices, stock and company orders.
- Authorized supplier/product management, Pending purchase orders and amendments.
- Manager approval, cancellation and atomic delivery stock receipts, with duplicate-delivery protection.
- Actual PostgreSQL reports; delivered value represents receipts, not confirmed payments.
- Local Copilot catalog search, authorized inventory/status queries, Decimal quotation comparison and review-only drafts.
- Optional Groq conversation/tool interpretation, with explicit consent and no private database-result transmission.

## Requirements and platforms

| Tool | Supported configuration |
| --- | --- |
| Docker path | Current Docker Desktop/Engine with Compose v2; CI uses `--wait`/`--wait-timeout` |
| Native Python | Python 3.13; use a separate local `.venv` on each OS |
| Backend packages | Exact pins in `backend/requirements.txt`, including Django 6.0.10 |
| Native Node/npm | Node 22.12+ (22 LTS recommended) or 24; npm compatible with that Node |
| Frontend installation | `npm ci` from committed package-lock; no global Angular CLI |
| Database | PostgreSQL 17, including client/development tools for native setup/tests |
| macOS source builds | Xcode Command Line Tools and PostgreSQL `pg_config` |

Native Windows is tested on this workstation (Python 3.13.1, Node 24.13.1, npm 11.8.0, PostgreSQL 17). Native macOS Intel/Apple Silicon and Docker execution are **not locally verified**. Portable multiarchitecture images are used without a forced architecture. See [the exact portability report](docs/PORTABILITY_REPORT.md); CI definitions are not evidence that CI has passed.

## Database safety and first initialization

Docker uses an internal PostgreSQL service, an isolated database named `jedel_dev` and a persistent named volume. PostgreSQL has **no host port mapping**. It cannot use your host `jedel_group_db` through the provided configuration.

On the first empty development database, `init_development` extracts only reviewed schema DDL from the authoritative SQL dump, creates the four unmanaged business tables and runs managed Django auth/session/admin migrations. It provisions the six approved groups. It never imports historical rows, real supplier contacts or old Delivered orders. Later starts preserve records; they may apply pending managed migrations only to this explicitly isolated development database. Back up valued development data before updating software.

Optional fictional sample catalog, only after initialization:

```sh
docker compose exec backend python manage.py seed_demo --confirm
```

This creates one clearly labeled fictional supplier and two demo products, with opening stock 10 and 5. It creates no users/orders and never replays deliveries. It refuses nonempty business data without its demo marker; repeating after successful seeding adds nothing. For native isolated development, use the same command with your activated backend interpreter.

**Never run initialization or migrations against existing `jedel_group_db` without separate approval.** Existing records, unmanaged mappings and PostgreSQL GRANT scripts are preserved. [Migration and backup procedure](docs/MIGRATION_APPROVAL.md).

## Everyday Docker use

```sh
docker compose up             # restart existing services/data
# Ctrl+C stops attached services
# or, in a second terminal:
docker compose down           # remove containers/network; preserve database volume
docker compose up --build     # rebuild application after source/dependency changes
```

Do not use `docker compose down -v` for data you need. Do not replace `.env` secrets after a database volume is initialized: PostgreSQL will retain its original password. Reuse the same checkout/project name so Compose selects the same volume.

## Native Windows: first time

Install Python 3.13, Node/npm and PostgreSQL 17. Start your PostgreSQL service as its authorized local operator. Use a **new isolated** development database and role; do not reuse or reset the business database. Run these PostgreSQL utilities against your designated development service (supply `-h`, `-p`, `-U` for its operator as needed):

```sh
createuser --pwprompt jedel_dev
createdb --owner=jedel_dev jedel_dev
```

From the repository root:

```powershell
.\scripts\setup-windows.ps1
```

The script checks versions/tools, creates a Windows `.venv`, installs pinned dependencies and `npm ci`, and creates `backend/.env` only when absent. It prompts privately for the new development database password. Existing `.env` files are never overwritten. On a new empty database, readiness exits with instructions because the schema is not initialized yet. This is expected.

For that **new isolated `jedel_dev` only**, after reviewing its private configuration:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py init_development
python manage.py createsuperuser
python manage.py check_environment
```

Expected final output: `READY: PostgreSQL 17 ... Read-only check; no records changed.` Existing databases missing auth tables require review and approval, not blind initialization. `scripts/setup-windows.ps1 -CheckOnly` performs no dependency/configuration writes.

## Native macOS: first time

Install the correct Homebrew build for your CPU, then prerequisites (review package installation on your own computer):

```sh
brew install python@3.13 node@22 postgresql@17
xcode-select --install
export PATH="$(brew --prefix node@22)/bin:$(brew --prefix postgresql@17)/bin:$PATH"
brew services start postgresql@17
createuser --pwprompt jedel_dev
createdb --owner=jedel_dev jedel_dev
bash scripts/setup-macos.sh
```

Run Homebrew setup steps once, and add the printed tool PATH instructions to your shell configuration if needed. If the schema is empty, finish from `backend`:

```sh
source .venv/bin/activate
python3 manage.py init_development
python3 manage.py createsuperuser
python3 manage.py check_environment
```

Use `bash scripts/setup-macos.sh --check-only` for read-only readiness. Shell scripts are invoked through Bash, so they do not depend on Git executable-bit changes. Do not copy Windows `.venv` or node_modules to macOS. Actual Mac runtime validation remains outstanding.

## Native everyday launch

From the repository root:

```powershell
.\scripts\start-windows.ps1
```

Or on macOS:

```sh
bash scripts/start-macos.sh
```

This foreground launcher requires PostgreSQL to be running. It checks schema and ports, starts real Django/Angular processes, waits for health, prints URLs, and stops only its own process trees on Ctrl+C. It never initializes a database or kills a process occupying a port. It uses the project venv, avoiding the missing-SDK problem caused by plain system Python.

The reliable two-terminal alternative is always available. **Backend terminal**, after activating your venv:

```sh
cd backend
python manage.py runserver
```

On macOS, `python3 manage.py runserver` also works in the activated venv. **Frontend terminal**:

```sh
cd frontend
npm start
# equivalently: npx ng serve
```

## Accounts and roles

Register through Account for immediate Basic User access; session cookies survive browser refresh. Logout invalidates the server session. Passwords are hashed. No shared browser token is required.

A trusted administrator creates the first superuser using the interactive bootstrap command above. Use Django Admin to review users and assign Groups. Staff is not Superuser; the System Administrator group does not automatically set either flag. Only explicitly authorized staff can access administrative models.

| Group | Effective purpose |
| --- | --- |
| Basic User | Safe public product fields and public previews |
| Purchasing Employee | Catalog management, Pending orders; no approval/delivery |
| Purchasing Manager | Employee workflows plus approve/deliver/cancel and reports |
| System Administrator | Authorized business/account administration |
| Security Administrator | Designated account security operations; no business read by default |
| Analyst / Tester | Authorized read-only business/report data |

Role capabilities compose as a union; Basic membership does not override another granted role. Registration cannot choose roles. See [RBAC details](docs/RBAC_REPORT.md) and [authentication](docs/AUTHENTICATION.md).

## Optional Groq chat

**Не вставляйте настоящий API-ключ в README или GitHub.** Место для вашего ключа — строка `GROQ_API_KEY=` в приватном `backend/.env` (native) или корневом `.env` (Docker). В этом README оставляйте только пример без ключа.

1. Create your own key in [GroqCloud](https://console.groq.com/keys). If you exposed a key in chat, Git, a screenshot or a log, revoke it and create a replacement.
2. Edit **backend/.env** for native development, or **root .env** for Docker, in your local editor. Paste the new key only after `GROQ_API_KEY=`. Do not paste it into chat or a terminal command. Never put it in `.env.example`.
3. Set the four settings below. Keep your other database and Django settings unchanged.
4. Restart Django using the project venv, or recreate the Docker backend as described below.
5. Open `/ai-assistant`, log in, enter a non-confidential message and select the Groq consent checkbox. Local inventory/order questions do not require external consent.

All ordinary ERP and local Copilot tools work without an API key. Defaults are disabled. For native development, privately edit **backend/.env**; for Docker, edit the **root .env**:

```dotenv
AI_ENABLED=true
AI_PROVIDER=groq
AI_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=<your own private key>
```

Restart native Django after edits. For Docker use `docker compose up -d --build backend` to recreate its environment; a plain container restart does not load changed Compose variables. Do not enable paid billing. The app has no OpenAI key requirement or fallback. Never put credentials into Angular or Git. Presence is not proof of connectivity or free-tier account eligibility. `python manage.py copilot_status` checks configuration without contacting Groq. Live tests require separate approval. [AI guide](docs/AI_COPILOT.md).

For an already configured native installation, use these exact two-terminal commands from the repository root.

**Windows backend:**

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py copilot_status
.\.venv\Scripts\python.exe manage.py runserver
```

**macOS backend:**

```sh
cd backend
.venv/bin/python manage.py copilot_status
.venv/bin/python manage.py runserver
```

**Frontend, another terminal on either OS:**

```sh
cd frontend
npm start
```

These commands use the installed project SDK even when system Python lacks it. `runtime_status=configured_unverified` means local configuration and SDK checks pass; it does not prove that Groq accepted the key. `missing_sdk` means the wrong/incomplete Python environment is running. No live provider smoke test runs automatically. Only after separately authorizing one harmless request, use `python manage.py copilot_smoke --confirm-external-request` in the activated backend venv.

## Tests and fresh-install verification

From repository root:

```sh
cd frontend
npm ci
npm test -- --watch=false
npm run build
npx playwright install chromium
cd ../backend
```

Backend tests require local PostgreSQL 17 tools; use the activated venv:

```sh
python scripts/test_postgres.py
```

These create a guarded temporary PostgreSQL cluster on a random port. They never use application database credentials. To include first-run initialization, idempotence and a real temporary PostgreSQL restart:

```powershell
$env:JEDEL_VERIFY_DEVELOPMENT='1'
python scripts/test_postgres.py
Remove-Item Env:JEDEL_VERIFY_DEVELOPMENT
$env:JEDEL_BROWSER_TESTS='1'
python scripts/test_postgres.py apps.purchasing.test_browser
```

On macOS/Linux use `JEDEL_VERIFY_DEVELOPMENT=1 python scripts/test_postgres.py` and `JEDEL_BROWSER_TESTS=1 python scripts/test_postgres.py apps.purchasing.test_browser`. The browser tests use isolated accounts, real APIs and PostgreSQL, with Groq disabled.

`.github/workflows/verify.yml` defines Windows/macOS/Ubuntu backend/frontend checks and Ubuntu fresh Compose build/restart smoke tests. These jobs require no personal secrets or live Groq key. Runner tool availability and actual CI execution remain to be verified. See [the report](docs/PORTABILITY_REPORT.md) for actual local results, source snapshot method and unverified environments.

## Troubleshooting

| Problem | Action |
| --- | --- |
| Docker command missing | Install/start Docker Desktop with Compose v2; reopen terminal |
| Port 4200/8000 occupied | Stop your own earlier server; launchers never kill unrelated processes |
| PostgreSQL unavailable | Start the designated development service and check private DB settings; no reset/import workaround |
| Invalid database credentials | Correct only your private `.env`; do not paste it into chat/logs |
| Missing business/auth tables | Fresh isolated `jedel_dev`: explicit initializer. Existing business database: approval procedure |
| Missing Python/Node | Install supported versions above; reopen terminal |
| macOS psycopg build fails | Install Command Line Tools/PostgreSQL, ensure pg_config is on PATH, rerun setup |
| Groq SDK missing | Activate project venv or start with its Python; install requirements there |
| Copilot unavailable without key | Expected for cloud chat; use local catalog/authorized forms |
| Ask Copilot disabled | Wait for session, enter message, select external consent if needed; Basic cannot use private tools |
| Anonymous 401 / role 403 | Expected authentication/permission enforcement; use Account or ask an administrator |
| CSRF failure | Use Angular localhost origin/proxy; refresh login. Never disable CSRF |
| Backend unavailable | Read displayed errors and `/health/`; no mock-data substitution |

## Repository and further documentation

- `frontend/`: Angular pages, API/session services, unit and browser tests.
- `backend/`: Django API/admin, purchasing services, management commands and tests.
- `database/`: original schema/dump and team PostgreSQL role scripts (not demo seeds).
- `scripts/`: cross-platform setup, launch and isolated Compose smoke commands.
- `docs/`: [Windows](docs/WINDOWS_SETUP.md), [macOS](docs/MACOS_SETUP.md), [API](docs/API.md), [migration approval](docs/MIGRATION_APPROVAL.md), [business requirements](docs/bekarys/README.md).

This is a development environment, not a production deployment. Use a checkout containing the setup scripts documented above. Do not infer production readiness or universal OS support from local tests.
