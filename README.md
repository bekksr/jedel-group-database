<div align="center">

# Jedel.Group ERP

**Supplier & Purchasing Management System**

An educational ERP platform for suppliers, products, purchase orders, inventory, analytics and an AI-powered assistant.

![Angular](https://img.shields.io/badge/Frontend-Angular_21-DD0031?logo=angular&logoColor=white)
![Django](https://img.shields.io/badge/Backend-Django_6-092E20?logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_17-4169E1?logo=postgresql&logoColor=white)
![Groq](https://img.shields.io/badge/AI-Groq-orange)

**[Quick start](#quick-start) · [Database](#shared-demo-database) · [Features](#what-is-jedelgroup) · [Jedel AI](#jedel-ai) · [Troubleshooting](#troubleshooting)**

</div>

> **Development / university demonstration project.** This README reflects the behavior described in the project's supplied documentation. Test the commands in your actual checkout before publishing. Windows has been exercised by the team; native macOS and Docker runtime verification are still outstanding.

## What is Jedel.Group?

Jedel.Group helps a purchasing team manage the full procurement cycle: maintain a product catalog, work with suppliers, create purchase orders, approve or cancel orders, receive delivered stock, and view inventory and purchasing reports.

| Area | What you can do |
| --- | --- |
| **Catalog** | Browse products and categories; authorized staff can manage products |
| **Suppliers** | Maintain supplier records with data validation |
| **Purchasing** | Create and amend Pending orders; approve, deliver or cancel with role checks |
| **Inventory** | Track quantities; delivered orders update stock through backend business rules |
| **Analytics** | View data and summaries calculated from PostgreSQL |
| **Accounts** | Register, sign in, use server sessions and role-based permissions |
| **Jedel AI** | Ask questions, search products, compare recorded prices and stock, and get recommendations |

Angular communicates with Django REST endpoints through the local `/api` proxy. Django enforces permissions and business rules against PostgreSQL 17. Optional Groq requests interpret consented questions; private ERP tool results stay in Django.

### Application links

After startup:

| Page | Local URL |
| --- | --- |
| Website | http://localhost:4200/ |
| Login / registration | http://localhost:4200/auth |
| Jedel AI | http://localhost:4200/ai-assistant |
| Django home | http://localhost:8000/ |
| Django Admin | http://localhost:8000/admin/ |
| API documentation | http://localhost:8000/api/docs/ |
| Health check | http://localhost:8000/health/ |

## Quick start

**New teammate? Choose one setup method below.** `git clone` or `git pull` downloads source code and committed demo-data files; Git does **not** transfer a running PostgreSQL database, passwords, user accounts or sessions. A first-time setup is required on each computer.

### Option A — Docker (recommended for a fresh isolated demo)

Install and start Docker Desktop (Compose v2). Then:

```bash
git clone https://github.com/bekksr/jedel-group-database.git
cd jedel-group-database
```

Run **one** first-time configuration command:

| Windows PowerShell | macOS / Linux |
| --- | --- |
| `.\scripts\setup-docker.ps1` | `bash scripts/setup-docker.sh` |

Start the services:

```bash
docker compose up --build
```

On the first start with an **empty isolated Docker database volume**, the existing setup initializes its database schema and demo dataset. On later starts, the volume is preserved. Create a personal administrator only if your role requires one:

```bash
docker compose exec backend python manage.py createsuperuser
```

Do not use `docker compose down -v` if you want to retain the database volume.

### Option B — Native Windows (VS Code + PowerShell)

**One-time prerequisites:** Python 3.13, Node.js/npm and PostgreSQL 17. Make sure PostgreSQL is running. Use an **empty, separate development database** (`jedel_dev`) and a local role; do not reset an existing `jedel_group_db`.

An authorized local PostgreSQL operator can create the role and database (provide the correct host, port and operator login for your installation):

```powershell
createuser --pwprompt jedel_dev
createdb --owner=jedel_dev jedel_dev
```

Clone and run **first-time setup** from the project root:

```powershell
git clone https://github.com/bekksr/jedel-group-database.git
cd jedel-group-database
.\scripts\setup-windows.ps1
```

The setup script installs Python/npm dependencies, creates private configuration when absent, and initializes/seeds an explicitly isolated **empty** database. Provide your own local PostgreSQL credentials when requested.

**Everyday start — two VS Code terminals:**

**Terminal 1 — Django** (from the project root):

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py runserver
```

**Terminal 2 — Angular** (from the project root):

```powershell
cd frontend
npx ng serve
```

Open **http://localhost:4200/**. You can also use `npm start` for the frontend or `.\scripts\start-windows.ps1` from the root to launch both services.

### Option C — Native macOS

**One-time prerequisites:** Python 3.13, Node.js/npm, PostgreSQL 17 and Xcode Command Line Tools. The project's existing Homebrew setup example is:

```bash
brew install python@3.13 node@22 postgresql@17
xcode-select --install
export PATH="$(brew --prefix node@22)/bin:$(brew --prefix postgresql@17)/bin:$PATH"
brew services start postgresql@17
createuser --pwprompt jedel_dev
createdb --owner=jedel_dev jedel_dev
```

Clone the project and run the first-time initializer:

```bash
git clone https://github.com/bekksr/jedel-group-database.git
cd jedel-group-database
bash scripts/setup-macos.sh
```

**Everyday start — two terminals:**

**Terminal 1 — Django:**

```bash
cd backend
./.venv/bin/python manage.py runserver
```

**Terminal 2 — Angular:**

```bash
cd frontend
npx ng serve
```

Or launch both from the root with `bash scripts/start-macos.sh`. **Native macOS has not yet been verified on a real Mac**; report any error with the exact terminal output.

## Shared demo database

### What the team actually receives from GitHub

- **Included in Git:** database schema, setup scripts, migrations required for Django's managed auth tables, demo-data generator and versioned examples.
- **Generated locally:** PostgreSQL database, Django accounts/sessions, local passwords, API keys and `backend/.env`.
- **Not included:** your actual Windows PostgreSQL data directory or database service.

This design allows every teammate to create a reproducible **local** demo without sharing private credentials or overwriting anyone's real records.

### Versioned educational dataset

| Environment | Product count | How it is populated |
| --- | ---: | --- |
| Current owner's `jedel_group_db` | **55** | Original five products + 50 fictional products added after review |
| Fresh isolated `jedel_dev` | **55** | Versioned fictional dataset loaded by `seed_demo` on first initialization |

The shared dataset uses the 50 previously reviewed fictional products plus five additional fictional products. It is **not a copy of the owner's database**: the five original products and the owner's supplier, order, account and session records are not exported. Product IDs are generated locally; order items reference the locally created product and order IDs. The existing four-table schema, constraints and foreign keys are preserved.

The current SQL dump contains schema only; its historical data sections have been emptied. Older Git commits may still contain the original supplier contact rows, so repository owners must review history before publishing or changing repository visibility.

The isolated demo initializer creates **four fictional suppliers, 55 products, eight orders and 24 order items** across all four order statuses (`Pending`, `Approved`, `Delivered`, `Cancelled`). Opening stock is fictional; old deliveries are not replayed into it. No users, passwords or sessions are imported.

Descriptions for the 55 fictional products are maintained in `frontend/src/app/core/data/product-metadata.ts`, keyed by their exact demo label rather than local database IDs. They are illustrative and do not claim manufacturer specifications. Five earlier catalog examples reuse generic descriptions only when ID, name and category all match the existing sample metadata. Custom products have no editable description field in the existing database schema and show a fallback until separately approved schema support is added. Renaming a product breaks its metadata match.

To verify actual PostgreSQL rows on a fresh native setup, connect to your isolated database (supply host/port if needed):

```sh
psql -U jedel_dev -d jedel_dev -c "SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM suppliers) AS suppliers, (SELECT COUNT(*) FROM purchase_orders) AS orders, (SELECT COUNT(*) FROM purchase_order_items) AS items;"
```

For Docker, replace `psql -U jedel_dev -d jedel_dev` with `docker compose exec db psql -U jedel_dev -d jedel_dev`. A new demo reports `55, 4, 8, 24`; later user changes can change these counts. Git transfers the versioned Python dataset and setup code; setup or an explicitly approved sync imports records into PostgreSQL.

After `git pull`, teammates who previously loaded the 50-product isolated demo can preview and explicitly add the five new products from `backend` using their virtual environment:

```bash
python manage.py sync_demo_products
python manage.py sync_demo_products --apply
```

The command requires `JEDEL_ISOLATED_DEVELOPMENT=1` and `DB_NAME=jedel_dev` and checks the original demo marker. It reports pending products and suppliers, skipped records and category/price/name conflicts. `--apply` inserts missing labeled products and suppliers atomically; existing rows, IDs and stock are never updated. Repeated runs add nothing. Existing order and order-item fixtures cannot be safely synchronized because the schema has no stable demo identity for them; review those manually. Fresh 55-product installations do not need synchronization.

The native development launcher runs the preview check automatically for marked isolated demos; it never applies changes. Plain `manage.py runserver` does not run synchronization. Run the explicit commands above after a pull if the preview lists additions.

For Docker, run the same commands through the backend container: `docker compose exec backend python manage.py sync_demo_products`, followed by the same command with `--apply` only after reviewing its output.

To explicitly seed an already-initialized but empty **isolated** development database:

```bash
python manage.py seed_demo --confirm
```

Run this from `backend` using the project virtual environment and only after checking the configured database name and isolated-development setting. The command refuses populated business databases and repeat runs are designed not to duplicate data.

**Existing `jedel_group_db` is not reset automatically.** To preview additions without writing:

```bash
python manage.py add_fictional_products
```

Adding fictional products to an existing database must be deliberate, reviewed and backed up. After preview, the explicit command is `python manage.py add_fictional_products --apply --confirm-database DATABASE_NAME`, replacing `DATABASE_NAME` with the verified configured name. This command handles products only; it does not synchronize suppliers or orders. Never automatically run a full restore or destructive migration after `git pull`.

## Accounts and permissions

Register through the website to get a **Basic User** account. There are no default shared administrator passwords. A trusted local operator can create an administrator when required:

```bash
python manage.py createsuperuser
```

Run this inside the `backend` directory with its virtual environment. The backend enforces permissions; registration cannot grant elevated roles. See [RBAC documentation](docs/RBAC_REPORT.md).

| Role | Purpose |
| --- | --- |
| Basic User | Public catalog and previews |
| Purchasing Employee | Business read, catalog management and pending orders |
| Purchasing Manager | Employee capabilities plus order transitions |
| System Administrator | Business and account administration |
| Security Administrator | Designated security operations |
| Analyst / Tester | Read-only business and reports |

## Jedel AI

The assistant works in two modes:

1. **Local ERP tools:** permitted product searches, inventory summaries, purchasing analytics and review-only drafts, using actual PostgreSQL data.
2. **Optional Groq chat:** general English/Russian conversations and tool interpretation, requiring a private key and explicit user consent.

For native startup, edit only your ignored private `backend/.env`:

```dotenv
AI_ENABLED=true
AI_PROVIDER=groq
AI_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=YOUR_OWN_PRIVATE_KEY
```

For Docker, use the ignored root `.env` according to the setup documentation. Never commit either private file, paste keys into chat or put secrets in Angular. Restart the backend after changes.

Examples after signing in with a business-read role:

```text
Find laptops under 400000 KZT.
Which one is cheapest?
Compare the best two.
Which would you recommend and why?
```

Recommendations currently reflect recorded **price and stock**, not verified external customer reviews or offers. Live Groq connectivity remains to be checked. See [AI documentation](docs/AI_COPILOT.md).

## Updating your checkout

```bash
git switch main
git pull --ff-only origin main
```

**Git updates code and demo-data definitions, not your already-running PostgreSQL records.** Use the preview and explicit sync command above for the earlier isolated demo. Never auto-overwrite an existing database to “sync” it. After first-time setup, ordinary backend and frontend launch commands remain the same.

## Testing

Frontend, from `frontend/`:

```bash
npm ci
npm test -- --watch=false
npm run build
```

Backend, from `backend/` with the virtual environment active:

```bash
python manage.py check
python scripts/test_postgres.py
```

The backend runner creates a temporary isolated PostgreSQL cluster and does not use application database credentials. To include fresh initialization and restart verification, set `JEDEL_VERIFY_DEVELOPMENT=1` before running it. For browser checks, install Playwright Chromium with `npx playwright install chromium` in `frontend/`, then run `JEDEL_BROWSER_TESTS=1 python scripts/test_postgres.py apps.purchasing.test_browser` on macOS/Linux. In PowerShell, set `$env:JEDEL_BROWSER_TESTS='1'` before that Python command and remove the variable afterwards. The live Groq provider and native macOS/Docker runtime were not independently verified on the owner's Windows machine. See [portability report](docs/PORTABILITY_REPORT.md).

## Troubleshooting

| Issue | What to check |
| --- | --- |
| Empty product catalog | Did first-time setup seed the **correct isolated** database? Check current DB and roles. Basic User sees fewer fields. |
| Database connection refused | Start PostgreSQL; verify private host, port, username and password. |
| `401` or `403` from API | Authentication or authorization may be working as designed; sign in or ask an admin for a role. |
| Port `8000` / `4200` occupied | Stop the older server you own; do not force-kill unrelated processes. |
| `ng` command not found | Run `npm ci` in `frontend/`, then `npx ng serve`. |
| Python module / Groq SDK missing | Use the project `.venv` Python, not the system interpreter. |
| CSRF or session problems | Open the Angular site on `localhost:4200` and use its configured `/api` proxy. |
| Groq chat unavailable | Check private Groq configuration, server logs, consent and role. Core ERP features work without a key. |
| Existing database has missing tables | Do not blindly migrate/reset it. Use the documented approval and recovery process. |

## Project structure

```text
jedel-group-database/
├── frontend/      Angular UI, services, tests
├── backend/       Django API, business rules, management commands
├── database/      Schema, dumps and SQL role scripts
├── scripts/       Windows/macOS/Docker setup and launchers
├── docs/          Architecture, API, RBAC, AI and team documentation
└── README.md
```

### More documentation

[Windows](docs/WINDOWS_SETUP.md) · [macOS](docs/MACOS_SETUP.md) · [API](docs/API.md) · [Database migration safety](docs/MIGRATION_APPROVAL.md) · [Business analysis](docs/bekarys/README.md)

## Team contributions

Contributions are reviewed through feature branches and pull requests. Keep local credentials, database files, personal records and generated backups out of Git. Include relevant test results and database-safety notes in changes that affect setup or business rules.

---

<div align="center">

**Jedel.Group · Team university ERP project**

*Source code, demonstration data and documented setup — without shared passwords or private accounts.*

</div>
