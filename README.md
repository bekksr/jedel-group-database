# 🏢 Jedel.Group — ERP Supplier & Purchasing System

An educational ERP project that brings suppliers, products, purchasing and inventory together in one team workspace.

## 🎯 Aim

Jedel.Group helps purchasing teams manage their everyday work from a shared, structured system. It connects the purchasing process to inventory and reporting while keeping access appropriate to each user's role.

## 🛠️ Project Objectives

- Organize supplier and product information in one place.
- Support purchase orders from creation through approval, delivery or cancellation.
- Keep inventory accurate when orders are delivered.
- Protect business information with authentication and role-based access.
- Provide useful dashboards and grounded assistance for purchasing decisions.
- Make the educational project reproducible across the team.

## ✨ Functionalities

- 🏭 **Supplier management:** maintain supplier records with validation.
- 📦 **Product catalog and inventory:** browse products and manage authorized catalog data and stock.
- 🛒 **Purchase order management:** create and amend pending orders; approve, deliver or cancel them according to permissions.
- 🔄 **Automated stock updates:** update inventory when an authorized user delivers an order.
- 🔐 **Authentication and registration:** register, sign in and use session-based accounts.
- 👥 **Role-based access control:** restrict business data and actions according to assigned roles.
- 📊 **Dashboard and analytics:** view summaries based on ERP records.
- 🤖 **Jedel AI:** ask questions, search and compare products, and get recommendations using Groq and authorized ERP tools.
- 🗄️ **PostgreSQL integration:** store and retrieve relational business data through Django.
- 🌍 **Cross-platform development:** set up locally on Windows or macOS, or use Docker.

## 💻 Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Angular 21, TypeScript, HTML, SCSS |
| Backend | Python 3.13, Django 6, Django REST Framework |
| Database | PostgreSQL 17 |
| AI | Groq API |
| DevOps | Docker, GitHub Actions |
| Development | VS Code |

Angular communicates with the Django API, which applies business rules and permissions to PostgreSQL data. Groq is the cloud AI provider; ERP tools remain subject to application permissions.

## 🚀 Quick Start

**First-time setup is required.** Install Python 3.13, Node.js 22 LTS (22.12 or later) or 24, and PostgreSQL 17. Create a **new, empty, isolated** `jedel_dev` database and role as described in the [development guide](docs/DEVELOPMENT.md#native-database-explicitly-isolated). Never point demo initialization at an existing business database.

From the project root, run the setup for your platform and provide your local database password when prompted:

<a id="native-windows-first-time"></a>
<a id="local-run-powershell"></a>
**Windows:**

```powershell
.\scripts\setup-windows.ps1
```

<a id="native-macos-first-time"></a>
**macOS:**

```bash
bash scripts/setup-macos.sh
```

After setup, start the backend and frontend in separate terminals:

**Windows backend**

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py runserver
```

**macOS backend**

```bash
cd backend
.venv/bin/python manage.py runserver
```

**Frontend**

```bash
cd frontend
npx ng serve
```

Open the website at [localhost:4200](http://localhost:4200) and the backend at [localhost:8000](http://localhost:8000). For prerequisites, database credentials, Docker setup and troubleshooting, see the [Windows guide](docs/WINDOWS_SETUP.md), [macOS guide](docs/MACOS_SETUP.md) and [development guide](docs/DEVELOPMENT.md).

## Email Password Recovery (Gmail)

Password reset uses Django's single-use reset token, valid for 30 minutes. The API responds identically whether an address is unknown or has multiple matching accounts. Reset links use the configured `FRONTEND_BASE_URL`, never the request Host. Production must use an HTTPS frontend URL and TLS SMTP.

Create a Google App Password for the sending Google account (Google Account → Security → 2-Step Verification → App passwords). Put that app password in local configuration only; do not use your normal Google password. The sender should match `EMAIL_HOST_USER`.

- **Native Windows (PowerShell):** create `backend/.env` from its example only if it does not already exist: `if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }`. Then add or update the mail variables below in `backend/.env`; Django loads it automatically. Do not replace an existing file.
- **Native macOS (Terminal):** create `backend/.env` from its example only if missing: `test -f backend/.env || cp backend/.env.example backend/.env`. Then add or update the mail variables below in `backend/.env`; Django loads it automatically. Do not replace an existing file.
- **Docker Compose (Windows or macOS):** create the repository-root `.env` only if missing (`if (!(Test-Path .env)) { Copy-Item .env.example .env }` in PowerShell, or `test -f .env || cp .env.example .env` in Terminal). Add or update the mail variables below there; Compose passes them to Django. For a custom frontend port, set `FRONTEND_BASE_URL` to that browser-visible URL, such as `http://localhost:4201`. Do not replace an existing file.
- **Production:** configure the same variables in the deployment secret/environment manager, set `DJANGO_DEBUG=false`, and use the HTTPS website URL. Never commit `.env` files or real SMTP credentials.

Required variables: `EMAIL_HOST=smtp.gmail.com`, `EMAIL_PORT=587`, `EMAIL_USE_TLS=true`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`, `FRONTEND_BASE_URL`, and `PASSWORD_RESET_TIMEOUT=1800`. Automated tests use Django's in-memory email backend and send no real messages. To manually verify Gmail delivery, start the backend with its private configuration, submit a registered account email at `/password-reset`, confirm the email arrives, open the link, set a new password, then sign in using the existing username and new password. Delivery must be verified in the running deployment; configuration alone does not prove Gmail accepted the message.

## 🗄️ Database

PostgreSQL stores the four main business tables: **products**, **suppliers**, **purchase orders** and **purchase order items**. A first-time setup for an explicitly isolated development database initializes the schema and synchronizes the shared catalog from [`database/shared_catalog.json`](database/shared_catalog.json): **55 products and three suppliers**. Each startup checks for missing or changed shared catalog fields, adds or updates those rows, preserves existing stock quantities, and leaves local products and all purchase orders/items intact. Conflicting rows are reported and preserved. Git transfers the versioned catalog and setup code; it does not transfer a running database. Existing populated databases outside the isolated `jedel_dev` setup are never changed automatically. See the [database setup guide](docs/DEVELOPMENT.md#native-database-explicitly-isolated) before synchronizing data.

Git transfers the versioned catalog and setup code; it does not transfer or replace a running database. The automatic sync is limited to explicitly isolated `jedel_dev` databases. See the [database setup guide](docs/DEVELOPMENT.md#shared-catalog-updates) before changing its source data.

## Docker on Windows and macOS

Install Docker Desktop and start it. From the repository root, create private local secrets once with `powershell -File scripts/setup-docker.ps1` on Windows or `bash scripts/setup-docker.sh` on macOS. These scripts preserve an existing `.env`. Then run:

```bash
docker compose up --build
```

Open [localhost:4200](http://localhost:4200/) for Angular, [localhost:8000](http://localhost:8000/) for Django, [admin](http://localhost:8000/admin/), [health](http://localhost:8000/health/) or [API documentation](http://localhost:8000/api/docs/). Compose uses a private PostgreSQL volume and initializes the explicitly isolated `jedel_dev` database with the current shared catalog (55 products and 3 suppliers). It does not load the retired demo orders. Repeated startup synchronizes catalog changes while preserving stock and local purchasing records. Never use `docker compose down -v` if the volume contains data you need. Native launchers use the same ports, so stop one environment before starting the other. Optional `JEDEL_FRONTEND_PORT` and `JEDEL_BACKEND_PORT` environment variables change the published ports.

## Updating an Existing Installation

Run `git pull origin main`, then start the existing environment with `scripts\start-windows.ps1` on Windows or `bash scripts/start-macos.sh` on macOS. The launcher synchronizes the versioned shared catalog only when `backend/.env` explicitly sets `JEDEL_ISOLATED_DEVELOPMENT=1`, `DB_NAME=jedel_dev` and `DJANGO_DEBUG=true`. A fresh isolated database receives 55 shared products and 3 shared suppliers; no sample orders are inserted. Repeated synchronization updates shared catalog fields, preserves stock and local records, and reports conflicts for review. Partial business schemas and unbound legacy orders require manual review. To preview the isolated operation, run `python manage.py sync_development` from `backend`; add `--apply` to execute it. Other databases are never automatically changed.

## 🤖 Jedel AI

Open **Jedel AI** in the application to ask questions, search the catalog, compare recorded product prices and availability, and get recommendations. ERP results are based on accessible database records and respect role permissions; recommendations are educational rather than verified external offers or reviews.

Groq-powered conversation requires a privately configured API key. Keep it in local environment configuration, never in source control. See the [Jedel AI guide](docs/AI_COPILOT.md) for configuration, consent and limitations.

## 👨‍💻 Team Members

| Team member | Role |
| --- | --- |
| Bekarys | System Analysis & Business Logic |
| Amir | Data / Database & Backend |
| Aslan | Frontend Development |
| Yerbolat | Architecture & Security |
| Kamshat | Testing & Integration |

## 📚 Documentation

### Roles, public catalog and shared AI limits

Visitors can browse product and category names, supplier names, and order summaries without registering. Guest views omit supplier contact details, inventory, prices and other private purchasing fields; guests cannot create or change orders. Registration creates a normal **User** account with catalog and supplier/order read access, permission to use Jedel AI, and permission to create orders. Order approval and administration remain assigned to higher roles. Existing **Purchasing Employee** accounts retain their role and equivalent User capabilities; legacy **Basic User** accounts are treated as User. Analytics and Jedel AI navigation is hidden from guests and accounts without read access. PostgreSQL uses the restricted `erp_app` service identity; per-person roles are enforced by Django, not by separate SQL logins. `database/roles.sql` is documentation-only; provision a service account only with the reviewed `database/app_user_docker.sql` procedure.

For shared AI quotas across backend workers, run Redis and set `REDIS_URL` in the environment. Docker Compose starts Redis automatically. Native local development can omit `REDIS_URL` and uses a per-process cache until Redis is configured. Do not put Redis credentials into tracked files.

- [Development and database setup](docs/DEVELOPMENT.md)
- [Windows setup](docs/WINDOWS_SETUP.md) and [macOS setup](docs/MACOS_SETUP.md)
- [Authentication and roles](docs/AUTHENTICATION.md)
- [Jedel AI](docs/AI_COPILOT.md)
- [API reference](docs/API.md)
- [Verification and testing](docs/VERIFICATION.md)
