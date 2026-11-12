# Jedel.Group Django backend

Start from this folder with `python manage.py runserver`. Private backend/.env loads automatically; process variables take priority. The backend landing page is http://127.0.0.1:8000/, with Admin/API/docs/health links. Development runserver serves Django Admin static assets.

New registration creates an active Basic User, hashes the password, persists a Django session in the account transaction, and returns the confirmed profile. There is no normal registration approval step. Basic User has no business reads/writes, privileged groups, Staff or Superuser. Existing inactive accounts remain for manual administrator review. Registration cannot choose its own role. Login supports email and existing usernames. CSRF/HttpOnly session cookies remain enforced, with per-IP throttling on login and signup.

Current read-only diagnostics show Django auth/session/admin tables already initialized in jedel_group_db (18 applied migrations, zero pending). This task applied no live migrations and performed no disposable account tests there. The four business models remain unmanaged and unchanged. No new schema migration is needed for the registration policy; Basic User is a normal auth_group row. Never reset or reinitialize existing business data.

First administrator, where needed: explicit local `python manage.py createsuperuser`. Trusted administrators assign privileged roles and review old inactive accounts in /admin/. Do not give ordinary registered users Staff/Superuser. Catalog Admin forms and order actions preserve stock/workflow safety.

From this folder run isolated tests using `python scripts/test_postgres.py`. Set JEDEL_BROWSER_TESTS=1 for Chromium and JEDEL_VERIFY_DEVELOPMENT=1 to check fresh isolated initialization/restart behavior. The guarded temporary cluster never targets the existing database.

See [authentication and roles](../docs/AUTHENTICATION.md), [current implementation/verification report](../docs/AUTO_REGISTRATION_REPORT.md), [API reference](../docs/API.md), and [development setup](../docs/DEVELOPMENT.md).

The read-only /api/catalog/products/ (list/detail) and /api/catalog/categories/ endpoints deliberately expose only product ID/name/category. They do not broaden /api/products/ or business-role permissions, do not select private columns, and reject write/unsupported private-field filters. No migrations or SQL GRANT changes are needed. [Catalog access matrix and tests](../docs/CATALOG_ACCESS_REPORT.md).

Copilot endpoints and server-only AI settings: [AI Copilot guide](../docs/AI_COPILOT.md). No new live migrations are required.
