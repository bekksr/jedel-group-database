# Jedel.Group ERP

Angular 21 + Django 6/DRF + PostgreSQL 17 supplier and purchasing application. Individual Django sessions and a unified /auth Log in/Register screen replace manual shared-token entry. New registrations are active, automatically signed in, and assigned Basic User with safe product-name/category browsing and no private business access. Business tables remain unmanaged; purchasing services enforce transactional stock updates and preserve captured prices.

## Start an isolated development environment

Install Docker Desktop and Compose, copy `.env.example` to `.env`, and fill both empty secret values with independently generated secrets. Then:

```sh
docker compose up --build
docker compose exec backend python manage.py createsuperuser
```

Open http://localhost:4200/login and http://localhost:8000/admin/. Register through Account to sign in immediately as Basic User. A trusted administrator assigns any required purchasing or administration role separately. Stop with `docker compose down`; restart with `docker compose up`. The database volume persists. Never use `down -v` for data you need.

Docker creates an isolated jedel_dev database, initializes only empty business schema and adds Django tables. It does not touch the existing jedel_group_db. Docker execution and macOS compatibility require verification in those environments; see the test report.

## Guides

- [Safe product catalog, role matrix and verification](docs/CATALOG_ACCESS_REPORT.md)

- [Windows, macOS, Docker, native setup and troubleshooting](docs/DEVELOPMENT.md)
- [Windows setup](docs/WINDOWS_SETUP.md) and [macOS setup](docs/MACOS_SETUP.md)
- [Authentication and role matrix](docs/AUTHENTICATION.md)
- [Existing database migration approval and backup procedure](docs/MIGRATION_APPROVAL.md)
- [API reference](docs/API.md)
- [Initial audit and implementation decisions](docs/FULLSTACK_AUDIT.md)
- [Current automatic registration and Account navigation report](docs/AUTO_REGISTRATION_REPORT.md)
- [Earlier unified authentication verification](docs/UNIFIED_AUTH_REPORT.md)
- [Earlier verification results](docs/VERIFICATION.md)
- [Original business database documentation](database/README.md)
- [Business requirements](docs/bekarys/README.md)

## Tests

Windows: from backend, `.venv/Scripts/python.exe scripts/test_postgres.py`.

macOS: from backend, `.venv/bin/python scripts/test_postgres.py`.

Frontend: from frontend, `npm test -- --watch=false` and `npm run build`.

PostgreSQL tests use a temporary marked cluster on a random port, never the project database. Do not run migrations against jedel_group_db without explicit approval. Existing docs describing bearer access are historical; this guide and AUTHENTICATION.md describe the session architecture.

No production deployment or live database migration is claimed. No default credentials are provided.

See [all-section access and verification](docs/ALL_SECTIONS_REPORT.md) for current public previews, role permissions, test results and manual checks.
See [RBAC provisioning and account administration](docs/RBAC_REPORT.md) for the six-role policy and required live provisioning approval.

See [AI Procurement Copilot](docs/AI_COPILOT.md) for read-only tools, approved quotation CSVs, optional provider configuration and tests.

Team frontend integration and exact verification: [integration report](docs/TEAM_FRONTEND_INTEGRATION_REPORT.md).
