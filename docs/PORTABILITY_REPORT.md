# Portability implementation and verification ? 13 November 2026

Verdict: **IMPLEMENTED BUT SOME PLATFORMS UNVERIFIED**.

## Git and preservation

Branch `feature/fullstack-integration-auth`, HEAD `fd50863`. No merge/rebase was in progress. Remote references were fetched safely; HEAD is 2 commits ahead and 0 behind origin/main. Aslan's integrated frontend is already part of HEAD. Earlier unstaged UI/Groq work was preserved. No staging, commit, push, merge, reset, rebase or identity change was performed.

## Audit

| Priority | Finding before this task | Resolution / limitation |
| --- | --- | --- |
| CRITICAL | No automated native first-time setup; system Python could lack SDK/dependencies | Platform wrappers create/check local venv, install pinned requirements and npm ci, and preserve existing configuration |
| CRITICAL | Fresh setup not objectively verified | Clean local clone/source overlay, independently installed dependencies, isolated PG initialization and real restart tests executed |
| CRITICAL acceptance gap | Docker unavailable on this machine | Compose implementation improved; actual fresh-container test remains unverified, CI smoke prepared |
| IMPORTANT | Manual secret copying in recommended setup | OS-specific Docker setup generates independent local secrets without printing them; never overwrites root .env |
| IMPORTANT | Missing read-only database/schema/migration/role readiness | New check_environment checks credentials, PG 17, business columns, auth tables, pending managed migrations and six roles |
| IMPORTANT | Native launch and version checks unclear | Foreground launcher, version checks, Node engines/lock metadata and .nvmrc added |
| IMPORTANT | Transitive Python dependencies not locked | 21 resolved Python dependency constraints added; pip check passes; no package upgrades |
| IMPORTANT | No fresh-environment CI | Windows/macOS/Ubuntu jobs and separate Compose build/restart smoke job prepared; not executed remotely |
| OPTIONAL | No safely labeled demo catalog | Explicit guarded seed_demo; fictional supplier/products, no users/orders/receipt replay |
| OPEN | npm advisories | Audit: 16 moderate, 0 high/critical, Angular CLI/transitive tooling chain; automatic proposed major downgrade not applied |

Already working: real Angular/Django APIs, session authentication/CSRF, six roles, safe public pages, purchasing service transactions, Django Admin, reports, optional Groq and local Copilot tools. Existing Compose already isolated PG without host port mapping; existing schema initializer already refused jedel_group_db and imported only DDL, not historical rows.

## Implementation

- Compose remains PostgreSQL 17 + real Django + real Angular. Backend waits for PostgreSQL health; frontend waits for backend and now has its own health check. Ports bind only host loopback. A named PG volume preserves development records.
- Docker configuration scripts require Docker/Compose and generate root `.env` only when absent. Existing values are never replaced. No host Python is needed for Docker setup.
- Native Python setup checks 3.13, Node 22.12+/24, npm and PostgreSQL tools; installs dependencies into an OS-local venv, uses npm ci, generates only missing local config, privately prompts for a new dev role password, then performs read-only readiness. It never creates a database implicitly or migrates an existing one.
- Empty password detection gives an actionable message before querying PG. Existing configuration is preserved byte-for-byte by setup (it does not open it for writes).
- `check_environment` is read-only, including its SQL transaction. `init_development` still requires `DB_NAME=jedel_dev` plus `JEDEL_ISOLATED_DEVELOPMENT=1`. Existing unmanaged models and authoritative DDL remain unchanged.
- Optional `seed_demo --confirm` requires the same isolation gate. It seeds one `[DEMO]` supplier and two `[DEMO]` products with fictional addresses/initial stocks 10 and 5, no orders/users. It refuses nonempty non-demo business data and repeats without duplication.
- Native launch checks ports, starts real foreground Django/Angular using the venv/local CLI, creates a private temporary proxy, checks health/API readiness, and stops only its own process trees. It never starts/stops the user's PostgreSQL service or kills an occupying application.
- Advanced launcher smoke flags permit alternate ports without colliding with an already running workstation. Defaults remain 8000/4200. Alternate-port smoke validates GET readiness only; trusted origins for authenticated POST must be configured for custom user ports.
- Windows launcher retained at backend/scripts/start-development.ps1. No global Angular install is required. Bash scripts use LF and documented `bash` invocation, so executable Git mode is not required and was not staged/changed.

## Exact launch procedures

Use [the rewritten README](../README.md) for prerequisites and new database bootstrap.

Docker first time from repository root:

```powershell
.\scripts\setup-docker.ps1
# macOS/Linux equivalent: bash scripts/setup-docker.sh
docker compose up --build
```

First administrator in a second terminal:

```sh
docker compose exec backend python manage.py createsuperuser
```

Native Windows from root:

```powershell
.\scripts\setup-windows.ps1
# If NEW jedel_dev is empty, explicitly initialize it as documented.
.\scripts\start-windows.ps1
```

Native macOS from root, after prerequisites:

```sh
bash scripts/setup-macos.sh
bash scripts/start-macos.sh
```

Two terminals remain supported: activate backend/.venv then `python manage.py runserver` (or `python3` on macOS), and `npm start` / `npx ng serve` from frontend.

Frontend http://localhost:4200/; backend http://localhost:8000/; admin /admin/; API /api/; docs /api/docs/; health /health/; Assistant http://localhost:4200/ai-assistant. Use localhost consistently and Angular's /api proxy. No Postman or shared browser token is required.

Stop Docker with Ctrl+C or `docker compose down`; never use `down -v` for valued data. Restart the same project with `docker compose up`. Native Ctrl+C stops the two launcher-created servers, not PG. Existing sessions persist when the same private Django secret and database are retained.

## Actual fresh-source verification method

A local Git clone was created at `D:/BIS_project/.runtime/jedel-clean-portability`, then reviewed current source changes were overlaid. Only the Git source manifest plus intended new source files was copied; no original backend/.env, .venv, node_modules, PostgreSQL directory, backup or API key was copied. The original private configuration remained untouched.

**This is a clean-dependency/source-snapshot test, not proof that a plain GitHub main clone already contains uncommitted changes.** A true published fresh clone cannot include these changes until separately approved and committed/pushed. The checkout included 219 source files at initial snapshot; later reviewed source additions were overlaid as implemented.

The Windows setup script created a fresh venv and installed 21 Python packages and 474 npm packages from package definitions/cache/registry, not by copying existing environments. It generated a new ignored backend/.env. Noninteractive setup deliberately left its new DB password empty; readiness stopped rather than guessing credentials or modifying any host database. Missing-password handling was separately checked and reports the exact missing key.

The test runner supplied independently generated credentials, stable per-run Django secret and a fresh marked PostgreSQL cluster on a random port. In that cluster:

1. Created only an empty jedel_dev database.
2. Ran reviewed schema initialization and managed auth/session/admin migrations.
3. Created the six groups, with no real user assignment.
4. Explicitly seeded fictional catalog twice; no duplication.
5. Registered a disposable Basic User via Django API, persisted a real session and checked /me/ and missing-key capabilities.
6. Repeated initialization; user/session/catalog and sentinel rows survived.
7. Stopped/restarted only that marked temporary PostgreSQL data directory, after checking its resolved path.
8. Confirmed unchanged user/session counts, demo stock total 15 and zero orders.
9. Reused the same session cookie in a **new Django process** after PG restart; /me/ returned the same disposable user.
10. Started the new native launcher on unused ports; Django health, Angular HTML and proxied Copilot capabilities returned 200, then its own process trees stopped.
11. Ran backend/frontend regressions and a separate complete Chromium suite against fresh isolated fixtures.

The live jedel_group_db was only checked by read-only native readiness. No live migrations, seeding, account/role assignment, record updates, stock edits or PostgreSQL GRANT changes occurred. No before/after live-data fingerprint comparison is claimed for this task.

## Executed results

| Check | Result |
| --- | --- |
| Clean Windows dependency installation | PASS; fresh venv/npm ci, no copied local credentials/dependencies |
| Full backend suite from clean source | 165 discovered: 164 passed, 0 failed, 1 browser opt-in skipped; 120.447s |
| Latest portability safety suite | 3 passed, 0 failed, 0 skipped |
| Initialization/idempotence/PG restart/session restoration/launcher | PASS (guarded verification hook, separate from test count) |
| Separate browser Django wrapper | 1 passed, 0 failed, 0 skipped |
| Full Chromium suite from clean source | 10 passed, 0 failed, 0 skipped; 1.0 minute |
| Full frontend suite from clean source | 103 passed, 0 failed, 0 skipped; 13 files |
| Production Angular build | PASS; initial 462.38 kB |
| TypeScript noEmit | PASS |
| npm ci dry-run against updated engine/lock metadata | PASS, offline |
| Python constrained reinstall / pip check | PASS; no broken requirements |
| Original Windows setup --check-only | PASS; existing env preserved; read-only PG/schema/role check |
| All three PowerShell script parse checks | PASS |
| All three Bash script syntax checks (Git Bash on Windows) | PASS; not macOS runtime evidence |
| Python compilation | PASS |
| Source/template guard | PASS; recognizable key patterns not found; secret template fields empty |
| npm audit | 16 moderate, 0 high/critical; exit 1 due advisories |
| Docker Compose config/up/build/restart | NOT VERIFIED; Docker not installed |
| Native macOS Intel/Apple Silicon | NOT VERIFIED; no Mac available |
| GitHub Actions execution | NOT VERIFIED; workflow prepared, not pushed/run |
| Groq live inference | NOT TESTED; no external API request/credentials used |

The full backend run preceded the final extra missing-password diagnostic and session-restoration probe refinements; later targeted safety/launcher/persistence checks exercised the refined paths. Tests were not disabled. Initial sandboxed pip download was denied and then rerun successfully with authorization. The first local clone attempt encountered sandbox ownership checks; cloning as the authorized user succeeded without changing Git configuration.

Evidence is ignored local output under backend/.runtime/: portability-fresh-install.log, portability-fresh-backend.log, portability-fresh-angular.log, portability-fresh-browser.log, portability-persistence-final.log, portability-constraints.log and portability-npm-audit.json. No provider key is present in the clean test configuration.

## Security and limits

- `.env` files remain ignored/untracked; secret examples are blank. Docker build context now also excludes env variants, browser artifacts, private key/backup formats.
- Source guard checks reviewed tracked/new source for recognizable provider/private-key patterns and nonempty secret template fields; this is not an exhaustive secret/penetration audit.
- Basic/private data boundaries, CSRF, admin restrictions and transactional purchasing are covered by actual isolated regression/browser tests. No production logic/role matrix was relaxed.
- Optional Groq remains disabled without a developer key. Native backend/.env and Docker root .env are separate. AI configuration check does not contact Groq. No OpenAI API key/fallback exists. Account free-tier eligibility cannot be certified by configuration.
- Docker images use official multiarchitecture major-version tags, not immutable digest pins. Dependency constraints are explicit but no universal architecture/build guarantee is claimed.
- CI Windows requires the hosted runner's PostgreSQL 17 tools at its documented install path; if unavailable it stops explicitly. macOS/Ubuntu job tool installation and all hosted jobs require first execution/review.
- No license audit or full production deployment audit was performed; no new runtime framework/dependency was introduced.

## Files introduced or modified for portability

- README.md, .gitattributes, .nvmrc, .dockerignore, compose.yaml
- backend/Dockerfile, backend/requirements.txt, backend/constraints.txt
- backend/apps/purchasing/management/commands/check_environment.py
- backend/apps/purchasing/management/commands/seed_demo.py
- backend/apps/purchasing/test_portability.py
- backend/scripts/test_postgres.py, backend/scripts/verify_development.py
- frontend/package.json, frontend/package-lock.json (engine metadata only; package versions unchanged)
- scripts/setup.py, scripts/setup-windows.ps1, scripts/setup-macos.sh
- scripts/setup-docker.ps1, scripts/setup-docker.sh
- scripts/start.py, scripts/start-windows.ps1, scripts/start-macos.sh
- scripts/smoke_compose.py, scripts/check_configuration_safety.py
- .github/workflows/verify.yml
- docs/DEVELOPMENT.md, docs/WINDOWS_SETUP.md, docs/MACOS_SETUP.md
- docs/PORTABILITY_REPORT.md

Earlier unstaged Groq/UI files are preserved. The following final working-tree inventory includes those earlier changes as well as this task; no files are staged.

```text
 M .dockerignore
 M .env.example
 M README.md
 M backend/.env.example
 M backend/Dockerfile
 M backend/apps/purchasing/copilot/orchestration.py
 M backend/apps/purchasing/copilot/provider.py
 M backend/apps/purchasing/copilot/views.py
 M backend/apps/purchasing/management/commands/copilot_status.py
 M backend/apps/purchasing/test_browser.py
 M backend/apps/purchasing/test_copilot.py
 M backend/apps/purchasing/test_copilot_setup.py
 M backend/config/settings.py
 M backend/requirements.txt
 M backend/scripts/test_postgres.py
 M backend/scripts/verify_development.py
 M compose.yaml
 M docs/AI_COPILOT.md
 M docs/AI_COPILOT_TESTABILITY_RESULTS.md
 M docs/AI_COPILOT_TESTING.md
 M docs/AI_COPILOT_VERIFICATION.md
 M docs/DEVELOPMENT.md
 M docs/MACOS_SETUP.md
 M docs/WINDOWS_SETUP.md
 M frontend/e2e/copilot.spec.ts
 M frontend/package-lock.json
 M frontend/package.json
 M frontend/src/app/core/data/copilot.service.ts
 M frontend/src/app/pages/analytics.ts
 M frontend/src/app/pages/connection.ts
 M frontend/src/app/pages/copilot.html
 M frontend/src/app/pages/copilot.scss
 M frontend/src/app/pages/copilot.spec.ts
 M frontend/src/app/pages/copilot.ts
 M frontend/src/app/pages/home.ts
 M frontend/src/app/pages/workspace-status.ts
 M frontend/src/styles.scss
?? .gitattributes
?? .github/workflows/verify.yml
?? .nvmrc
?? backend/apps/purchasing/management/commands/check_environment.py
?? backend/apps/purchasing/management/commands/copilot_smoke.py
?? backend/apps/purchasing/management/commands/seed_demo.py
?? backend/apps/purchasing/test_portability.py
?? backend/constraints.txt
?? docs/GROQ_CONVERSION_RESULTS.md
?? docs/PORTABILITY_REPORT.md
?? docs/UI_VISUAL_REGRESSION.md
?? frontend/e2e/visual-regression.spec.ts
?? frontend/src/app/components/stat-card.scss
?? frontend/src/app/components/stat-card.spec.ts
?? frontend/src/app/components/stat-card.ts
?? frontend/src/app/pages/analytics.scss
?? scripts/check_configuration_safety.py
?? scripts/setup-docker.ps1
?? scripts/setup-docker.sh
?? scripts/setup-macos.sh
?? scripts/setup-windows.ps1
?? scripts/setup.py
?? scripts/smoke_compose.py
?? scripts/start-macos.sh
?? scripts/start-windows.ps1
?? scripts/start.py
```
