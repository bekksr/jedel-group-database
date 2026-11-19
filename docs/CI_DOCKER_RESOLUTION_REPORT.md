# Docker and CI Resolution Report

**Role:** System Analyst

**Date:** 18 November 2026

**Status:** Requested Docker/CI issues verified; full workflow remains blocked by development-tool advisories with no compatible upstream fix currently available.

## Executive summary

The Docker build failure, missing PostgreSQL 17 package on the Ubuntu runner, and Django Admin smoke assertion are addressed on branch `fix/ci-ubuntu24-docker-smoke`.

The GitHub Actions run verified the Docker image build, Compose health checks, smoke test, and PostgreSQL 17 installation on Ubuntu 24.04. A compatible lockfile refresh initially exposed an npm-version mismatch: npm 11 omitted peer entries required by npm 10. The lockfile was regenerated with CI's npm 10.9.9, and the latest run now passes dependency installation and frontend tests/build on all native runners, as well as Compose build/smoke. Separately, `npm audit --audit-level=high` reports 28 advisories (14 moderate, 14 high); these remain because the Angular toolchain pins affected `picomatch` and no patched release is published. The branch has not been merged into `main`.

## Findings and impact

| Finding | Root cause | Impact |
| --- | --- | --- |
| Docker image could not build | `backend/Dockerfile` contained unresolved merge-conflict markers | Docker Compose could not parse the backend Dockerfile |
| PostgreSQL 17 package unavailable | `ubuntu-latest` moved to a runner image whose default apt repositories did not provide `postgresql-17`; pinning to Ubuntu 24.04 alone did not add that package | Native Linux CI failed before database regression tests |
| Smoke test failed on Admin | `smoke_compose.py` expected the default text `Site administration`, while the application customizes the Admin header | Compose smoke failed at the final administrator-page assertion |

## Resolution implemented

- Removed the conflict markers and retained the `build-essential` and `libpq-dev` installation in `backend/Dockerfile`.
- Pinned Linux CI jobs to `ubuntu-24.04`.
- Configured the official PostgreSQL Apt Repository for Ubuntu 24.04, verified its signing-key fingerprint (`B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8`), and installed PostgreSQL 17 from that repository.
- Updated the smoke assertion to check the configured `Jedel.Group administration` heading.
- Applied the available non-breaking npm audit updates to the lockfile, including Angular 21.2.30 tool packages. No major-version downgrade or dependency override was applied.

## Verification

GitHub Actions run [#17](https://github.com/bekksr/jedel-group-database/actions/runs/44338696442):

| Check | Result |
| --- | --- |
| Fresh Compose build and health checks | Passed |
| Compose smoke, including administrator authentication and page check | Passed |
| PostgreSQL 17 tools installation on Ubuntu 24.04 | Passed |
| npm dependency installation (`npm ci`) | Passed on all native runners and in the Docker frontend image |
| Frontend tests and production build | Passed on all native runners |
| High/critical dependency advisory gate | Failed: 28 advisories reported (14 moderate, 14 high) |
| Backend regression and Ubuntu browser tests | Skipped after the advisory gate failed |

Local validation after the lockfile refresh:

| Check | Result |
| --- | --- |
| Clean dependency installation (`npm ci`) | Passed |
| Frontend tests | 105 passed |
| Frontend production build | Passed |
| Production dependency audit (`npm audit --omit=dev --audit-level=high`) | 0 vulnerabilities |
| Full dependency audit | Still reports 14 moderate and 14 high advisories |

The high `picomatch` advisory affects versions `<=4.0.7`; the current npm latest is `4.0.7`, while Angular 21.2.30 pins `4.0.4`. No patched release is currently available. `npm audit fix --force` proposes downgrading Angular CLI to 16.2.0, which is incompatible with this Angular 21 project, and was not used. The remaining audit failure is limited to the development toolchain, but it still blocks the workflow's later backend tests.

GitHub Actions run [#16](https://github.com/bekksr/jedel-group-database/actions/runs/44338113518) failed because the lockfile produced by npm 11 omitted `@emnapi/core` and `@emnapi/runtime`, which npm 10.9.9 requires for `npm ci`. This affected the Windows dependency-install step and the Compose frontend image build. After regenerating the lockfile with npm 10.9.9, run #17 passed those installation/build checks across the native runners and Docker.

## Release status and recommendation

The three reported defects and the npm-version lockfile correction are verified by GitHub Actions run #17. The overall workflow is not green because the high/critical dependency advisory gate fails; backend native regressions did not run. Do not describe the complete platform verification as passing. Keep the audit gate strict and defer merge until the advisory has a compatible fix, unless the repository owner explicitly approves a different policy.
