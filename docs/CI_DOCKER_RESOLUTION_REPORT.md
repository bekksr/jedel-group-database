# Docker and CI Resolution Report

**Role:** System Analyst  
**Date:** 18 November 2026  
**Status:** Requested Docker/CI issues verified; full workflow remains blocked by a separate dependency audit gate.

## Executive summary

The Docker build failure, missing PostgreSQL 17 package on the Ubuntu runner, and Django Admin smoke assertion are addressed on branch `fix/ci-ubuntu24-docker-smoke`.

The GitHub Actions run verified the Docker image build, Compose health checks, and smoke test. The PostgreSQL 17 installation step also passed on Ubuntu 24.04 after configuring the official PostgreSQL Apt Repository. The overall workflow did not pass: `npm audit --audit-level=high` reported 28 advisories (14 moderate, 14 high). Because that step fails before the backend regression steps, those tests were skipped. The branch has not been merged into `main`.

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

## Verification

GitHub Actions run [#14](https://github.com/bekksr/jedel-group-database/actions/runs/44336645381):

| Check | Result |
| --- | --- |
| Fresh Compose build and health checks | Passed |
| Compose smoke, including administrator authentication and page check | Passed |
| PostgreSQL 17 tools installation on Ubuntu 24.04 | Passed |
| Frontend tests and production build | Passed on the native jobs |
| High/critical dependency advisory gate | Failed: 28 advisories reported (14 moderate, 14 high) |
| Backend regression and Ubuntu browser tests | Skipped after the advisory gate failed |

The changed files do not include frontend dependency manifests or lockfiles. The advisory failure is separate from the requested Docker/runner/smoke fixes and should be reviewed independently; do not use `npm audit fix --force`, which proposed a breaking Angular CLI downgrade.

## Release status and recommendation

The three reported defects are verified as fixed in the pushed branch. The overall CI workflow is not green, and the backend native regressions did not run. Do not describe the complete platform verification as passing. Review the dependency advisory gate and repository merge requirements before merging this branch into `main`.
