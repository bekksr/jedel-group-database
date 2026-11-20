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

## 🗄️ Database

PostgreSQL stores the four main business tables: **products**, **suppliers**, **purchase orders** and **purchase order items**. A first-time setup for an approved, empty isolated development database initializes the schema and loads educational data, including **55 fictional products**, four suppliers, eight orders and 24 order items.

Git transfers the versioned data and setup code; it does not transfer a running database. Existing populated databases are preserved. See the [database setup guide](docs/DEVELOPMENT.md#native-database-explicitly-isolated) and [demo order synchronization design](docs/DEMO_ORDER_SYNC_DESIGN.md) before synchronizing data.

## Docker on Windows and macOS

Install Docker Desktop and start it. From the repository root, create private local secrets once with `powershell -File scripts/setup-docker.ps1` on Windows or `bash scripts/setup-docker.sh` on macOS. These scripts preserve an existing `.env`. Then run:

```bash
docker compose up --build
```

Open [localhost:4200](http://localhost:4200/) for Angular, [localhost:8000](http://localhost:8000/) for Django, [admin](http://localhost:8000/admin/), [health](http://localhost:8000/health/) or [API documentation](http://localhost:8000/api/docs/). Compose uses a private PostgreSQL volume and initializes the explicitly isolated `jedel_dev` database with 55 fictional products, 4 suppliers, 8 orders and 24 order items on first startup. Repeated startup preserves the data. Never use `docker compose down -v` if the volume contains data you need. Native launchers use the same ports, so stop one environment before starting the other. Optional `JEDEL_FRONTEND_PORT` and `JEDEL_BACKEND_PORT` environment variables change the published ports.

## Updating an Existing Installation

Run `git pull origin main`, then start the existing environment with `.\scripts\start-windows.ps1` on Windows or `bash scripts/start-macos.sh` on macOS. The launcher synchronizes fictional data only when `backend/.env` explicitly sets `JEDEL_ISOLATED_DEVELOPMENT=1`, `DB_NAME=jedel_dev` and `DJANGO_DEBUG=true`. It preserves local records and prints the resulting table counts. A fresh demo contains 55 products, 4 suppliers, 8 orders and 24 order items; open the product catalog to verify them. Existing data or conflicts can change those totals. Partial business schemas and unbound legacy orders require manual review. To preview the isolated operation, run `python manage.py sync_development` from `backend`; add `--apply` to execute it. Other databases are never automatically changed. For another database with existing business tables, `python manage.py add_fictional_products` previews product additions; after review, `python manage.py add_fictional_products --apply --confirm-database <exact-name> --expected-additions <preview-count>` explicitly confirms them. This separate command does not initialize schema or add orders.

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

- [Development and database setup](docs/DEVELOPMENT.md)
- [Windows setup](docs/WINDOWS_SETUP.md) and [macOS setup](docs/MACOS_SETUP.md)
- [Authentication and roles](docs/AUTHENTICATION.md)
- [Jedel AI](docs/AI_COPILOT.md)
- [API reference](docs/API.md)
- [Verification and testing](docs/VERIFICATION.md)
