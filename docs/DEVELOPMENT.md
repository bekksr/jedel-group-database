> Current registration policy: new accounts activate and log in immediately as Basic User, without private business access. Old inactive accounts remain manual-review only. Current diagnostics show existing jedel_group_db auth migrations already applied; do not replay older approval/setup instructions blindly. See [the current report](AUTO_REGISTRATION_REPORT.md).

# Team development setup

> Current setup scripts and maintained copy-paste commands are in the [root README](../README.md). Use `scripts/setup-docker.ps1` or `bash scripts/setup-docker.sh` for first-time secret generation, and the native `setup-windows.ps1` / `setup-macos.sh` scripts instead of repeating the older manual environment-variable procedure below. The procedures below remain historical/manual alternatives; never overwrite an existing `.env`. See [current portability evidence](PORTABILITY_REPORT.md).

Use Python 3.13, Node 22 (22.12 or later), npm, and PostgreSQL 17. Docker Desktop with Compose is the easiest cross-platform option; install the correct Docker Desktop build for Apple Silicon or Intel. These are development servers, not a production deployment.

## Docker: Windows or macOS

From the repository root:

```sh
git clone https://github.com/bekksr/jedel-group-database.git
cd jedel-group-database
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48)); print(secrets.token_urlsafe(48))"
```

On Windows use `Copy-Item .env.example .env` and `py -3.13` if `python` is unavailable. Put independently generated values into POSTGRES_PASSWORD and DJANGO_SECRET_KEY in .env. Do not share them in chat or commit them. Compose rejects empty values.

```sh
docker compose up --build
```

In another terminal:

```sh
docker compose exec backend python manage.py createsuperuser
```

This interactive local command is the explicit bootstrap authority. Choose your own username, email and password. No default users or passwords exist.

Open frontend http://localhost:4200/login, backend http://localhost:8000/, admin http://localhost:8000/admin/, API http://localhost:8000/api/, readiness http://localhost:8000/health/. Register through Account ? Register for an active Basic User session. The superuser assigns any authorized business role separately; old inactive accounts still require manual review. Ordinary team members should not receive Staff or Superuser. The same account can sign into Angular. Group membership takes effect on the next API request.

Stop with Ctrl+C or `docker compose down`. Restart with `docker compose up`. The postgres_data volume persists. Do not use `down -v` unless you deliberately intend to destroy your isolated development database. The db service has no host port and cannot connect to your existing PostgreSQL service. Docker does not import historical records.

## Native database: explicitly isolated

Use a separate local PostgreSQL 17 service/cluster, or at minimum a new empty development database. Never point the initialization command at jedel_group_db. As your local PostgreSQL operator:

```sh
createuser --pwprompt jedel_dev
createdb --owner=jedel_dev jedel_dev
```

Supply connection options (`-h`, `-p`, `-U`) for your separate cluster when necessary. Existing PostgreSQL deployment roles and the application groups are different systems. Do not modify database/roles.sql to enable Django account groups. Runtime needs access to the new Django tables as well as the business tables; use separate owner/runtime credentials for a reviewed production deployment.

## Windows native

From repository root:

```powershell
py -3.13 -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
$env:DJANGO_DEBUG='true'
$env:DJANGO_SECRET_KEY = & backend/.venv/Scripts/python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
$env:DB_NAME='jedel_dev'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='5432'
$env:DB_USER='jedel_dev'
$secret = Read-Host 'Development database password' -AsSecureString
$env:DB_PASSWORD=[Net.NetworkCredential]::new('', $secret).Password
$env:JEDEL_ISOLATED_DEVELOPMENT='1'
cd backend
.venv/Scripts/python.exe manage.py init_development
.venv/Scripts/python.exe manage.py createsuperuser
.venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

The preserved `backend/scripts/start-development.ps1` is specifically for the existing database, performs no migrations and now expects account/session tables to be approved and ready. Its CopyToken option is retired and fails explicitly. Do not run the old bearer HTTP diagnostic commands as session checks.

## macOS native (Apple Silicon or Intel)

Install Python 3.13, Node 22 and PostgreSQL 17 through your chosen package manager. Ensure `initdb`, `pg_ctl`, `createuser`, and `createdb` are on PATH (or set PG_BIN to PostgreSQL's bin directory for tests). From repository root:

```sh
python3.13 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
export DJANGO_DEBUG=true
export DJANGO_SECRET_KEY="$(backend/.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export DB_NAME=jedel_dev DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=jedel_dev
read -r -s DB_PASSWORD
export DB_PASSWORD
export JEDEL_ISOLATED_DEVELOPMENT=1
cd backend
.venv/bin/python manage.py init_development
.venv/bin/python manage.py createsuperuser
cd ..
bash backend/scripts/start-development.sh
```

In zsh, use `read -s 'DB_PASSWORD?Development database password: '` instead of the bash read command. A stable secret key must be restored in each terminal/server restart to preserve sessions. Compose reads root .env. Native Django automatically reads backend/.env, with process environment variables taking priority.

## Frontend (both native platforms)

In a second terminal at the repository root:

```sh
cd frontend
npm ci
npm start
```

On PowerShell use `npm.cmd` if script execution policy blocks npm.ps1. Visit localhost:4200 consistently; mixing localhost and 127.0.0.1 creates separate cookies. All UI API requests use the same relative /api configuration and development proxy. Do not set a database password or an API secret in Angular environments.

## Verification

Windows backend: `cd backend; .venv/Scripts/python.exe scripts/test_postgres.py`

macOS backend: `cd backend && .venv/bin/python scripts/test_postgres.py`

The runner starts a temporary marked PostgreSQL cluster on a random non-5432 port and removes it afterward. Ordinary manage.py test refuses to run database tests against the application server.

Frontend: `cd frontend`, `npm test -- --watch=false`, `npm run build`.

Docker validation: `docker compose config --quiet`; then verify fresh startup, create a supplier, restart services and confirm persistence. Docker and macOS execution must be recorded separately from Windows test results.

## Troubleshooting

- Missing Python/Node/Docker: run `python --version`, `node --version`, `npm --version`, `docker compose version`; install required tools before continuing.
- Port 8000/4200 occupied: stop the owning application yourself or use a separate environment; scripts never kill unrelated processes.
- Database unavailable/503: check PostgreSQL is started and DB_HOST/PORT/USER/PASSWORD are correct. /health/ checks required business and auth/session tables without exposing credentials.
- Missing schema: initialize only empty isolated jedel_dev. An existing project database needs the migration approval process. Never restore a dump blindly.
- Invalid login: use the exact username (email for registration); check account Active and assigned role. Disabled/unapproved accounts cannot sign in.
- 403 CSRF: use the Angular proxy and one hostname; fetch /api/auth/csrf/ before unsafe requests. HTTPS production needs secure cookies and an appropriate trusted origin when applicable.
- 403 permission: ask the administrator to review group assignment; hidden controls do not grant API permissions.
- 409 conflict: refresh the order; never repeat delivery to repair an uncertain response. Atomic delivery prevents duplicate inventory increments.
- Password or role changes: a new login may be needed after password reset; group changes are checked on each request.
- Persistent volume credentials: changing POSTGRES_PASSWORD in .env does not change an initialized database role password. Update it explicitly as its database operator or use the original local value; do not delete team data.

## Real Chromium integration test

From frontend: `npm ci` and `npx playwright install chromium`.

From backend on Windows:

```powershell
$env:JEDEL_BROWSER_TESTS='1'
.venv/Scripts/python.exe scripts/test_postgres.py apps.purchasing.test_browser
```

On macOS: `JEDEL_BROWSER_TESTS=1 .venv/bin/python scripts/test_postgres.py apps.purchasing.test_browser`.

This starts a temporary PostgreSQL cluster, Django live server and Angular proxy on random local ports. It generates temporary passwords, runs Chromium against real UI/API/database flows and checks persisted stock. It never targets the existing project server. Do not run npm test:e2e directly against application data. Browser traces on failure stay in ignored frontend/test-results and may contain test session cookies.

## Verify fresh initialization and repeated startup without Docker

Set JEDEL_VERIFY_DEVELOPMENT=1 when invoking scripts/test_postgres.py. This creates jedel_dev only inside the temporary marked test cluster, prints the exact Django migration plan, verifies an empty catalog (no dump fixtures), creates a sentinel supplier, reruns initialization and confirms the sentinel and five groups persist. It tests initializer idempotence, not Docker volume persistence.

### Single-command local backend startup

From the backend folder run `python manage.py runserver`. The private, Git-ignored backend/.env stores local DJANGO_DEBUG, a stable secret key and PostgreSQL connection settings. Set DB_USER and DB_PASSWORD there once using your editor; no PowerShell environment commands are needed afterward. The local file created in this workspace targets jedel_group_db but contains no database credentials until you supply them. Missing/unavailable database access is reported without stopping the development server; database-dependent pages remain unavailable. Startup never runs migrations. Existing-database authentication migrations still require approval.

Set JEDEL_LOAD_DOTENV=false to disable local-file loading, as the isolated PostgreSQL test harness does.

## Current authentication screen and approval flow

Open http://localhost:4200/auth?mode=register to register, or /auth?mode=login to log in. Old /register and /login bookmarks redirect safely. Use email, or an existing legacy username. Registration is pending approval; an administrator assigns a role and activates it in Django Admin. No bearer token is pasted anywhere.

If registration/login return 503 with authentication_setup_required, the database connection can be healthy while Django account tables are absent. Check read-only `python manage.py showmigrations admin auth contenttypes sessions` and `python manage.py migrate --plan`. The existing jedel_group_db must NOT be migrated without explicit approval. Follow MIGRATION_APPROVAL.md and the current UNIFIED_AUTH_REPORT.md. After approved schema initialization, use interactive `python manage.py createsuperuser`, assign an application role to each applicant, and approve it through Admin's review actions. No default accounts/passwords are supplied.

For a fresh isolated DB_NAME=jedel_dev with JEDEL_ISOLATED_DEVELOPMENT=1, `python manage.py init_development` creates only schema when empty, adds auth tables and roles, and preserves records on restart. Never use it to initialize or replace jedel_group_db.

On this Windows host, default `python` is Django 6.0.3 while the existing project .venv/requirements use 6.0.10. Both were checked without altering dependency pins; see the report for which tests ran in each. Use your chosen installed environment consistently. The custom runserver now preserves Django's staticfiles handler, so Admin CSS/JavaScript are served in DEBUG development with the normal single command.
