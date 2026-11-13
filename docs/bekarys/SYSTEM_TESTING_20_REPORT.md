# Jedel.Group — 20-Scenario System Testing and Verification Report

**Document type:** System Analysis / QA and Verification  
**Prepared by:** Toktar Bekarys  
**Project:** Jedel.Group ERP  
**Date:** 13 November 2026  
**Scope:** 20 system-level test scenarios covering integration, access control, API behavior and purchasing workflow  
**Excluded from this report:** AI Copilot feature testing and implementation.

---

## 1. Executive Summary

This report defines a 20-scenario verification baseline for the Jedel.Group ERP system and records the test evidence currently available.

Testing is divided into three evidence categories:

- **PASS — Current Docker smoke evidence:** Directly supported by the latest recorded Docker build/startup and HTTP checks.
- **PASS — Previously recorded automated evidence:** Supported by earlier project verification reports, but not newly executed during the latest Docker startup session.
- **NOT RUN — Requires a dedicated functional/manual test:** The expected result is defined, but no direct execution evidence has been supplied for this specific test in the latest run.

This distinction prevents infrastructure startup evidence from being incorrectly presented as proof of full functional acceptance.

### 1.1 Current high-level result

The latest local Docker environment demonstrated:
- Successful backend image build after adding the required build dependencies.
- Successful frontend image build.
- PostgreSQL 17 initialization and readiness.
- Backend startup and healthy status.
- Frontend Angular compilation and successful HTTP response.
- Six application role groups initialized in the isolated development schema.
- Backend `/health/` response of HTTP 200.
- Frontend `/` response of HTTP 200.

The complete 20-scenario matrix appears below.

## 2. Test Objectives

The testing objectives are to verify that:
1. The application can be built and started consistently.
2. The database becomes ready before backend initialization.
3. The backend exposes a successful readiness response.
4. The frontend compiles and serves the application.
5. The backend and frontend remain independently reachable.
6. Private APIs require authentication and authorization.
7. Role restrictions are enforced by the backend.
8. Purchasing operations follow valid order states.
9. Inventory changes are controlled by backend workflow logic.
10. The development environment does not modify the existing business database.

## 3. Test Environment

| Item | Environment / value |
|---|---|
| Operating system | macOS on Apple Silicon |
| Container runtime | Docker Desktop / Docker Compose |
| Database | PostgreSQL 17 |
| Backend | Python 3.13, Django |
| Frontend | Node.js 22 image, Angular development server |
| Backend local URL | `http://localhost:8000` |
| Frontend local URL | `http://localhost:4200` |
| Development database | `jedel_dev` |
| Database isolation | Docker named volume `postgres_data`; `JEDEL_ISOLATED_DEVELOPMENT=1` |
| Date of recorded Docker run | 13 November 2026 |

The local Docker database is an isolated development environment. It is not the existing `jedel_group_db` business database.

## 4. Test Result Categories

| Status | Definition |
|---|---|
| PASS — Current run | Direct evidence exists in the latest Docker build, container status or HTTP output |
| PASS — Prior report | A previous project verification document records a passing automated test |
| NOT RUN | No direct execution evidence is available for this specific scenario in the current evidence set |
| BLOCKED | Test cannot be completed because a required service, account or fixture is unavailable |

A test must not be marked PASS merely because the application starts.

## 5. Twenty-Test Matrix

| Test ID | Test area | Scenario | Expected result | Recorded status |
|---|---|---|---|---|
| SYS-01 | Build | Build backend Docker image | Backend image builds without dependency/compiler failure | PASS — Current run |
| SYS-02 | Build | Build frontend Docker image | Frontend image builds successfully | PASS — Current run |
| SYS-03 | Database | Start PostgreSQL 17 | Database initializes and reports ready to accept connections | PASS — Current run |
| SYS-04 | Startup dependency | Start backend after database readiness | Backend waits for healthy database dependency | PASS — Current run |
| SYS-05 | Backend health | Request `GET /health/` | HTTP 200 and JSON status `ok` | PASS — Current run |
| SYS-06 | Frontend build | Start Angular development server | Angular bundle generation completes | PASS — Current run |
| SYS-07 | Frontend HTTP | Request `HEAD /` on port 4200 | HTTP 200 response | PASS — Current run |
| SYS-08 | Container orchestration | Inspect `docker compose ps` | Database, backend and frontend show healthy status | PASS — Current run |
| SYS-09 | Development isolation | Initialize Docker development schema | Isolated schema is prepared; existing records are not imported or rewritten | PASS — Current run |
| SYS-10 | Role initialization | Initialize application role groups | Six named application groups are prepared; user assignments and privilege flags remain unchanged | PASS — Current run |
| SYS-11 | Authentication | Anonymous user requests a private endpoint | Request is rejected as unauthenticated | PASS — Prior report |
| SYS-12 | Basic User authorization | Basic User requests private purchasing data | Request is denied | PASS — Prior report |
| SYS-13 | Public catalog | Anonymous/Basic User requests public catalog | Only approved public product fields are returned | PASS — Prior report |
| SYS-14 | Employee authorization | Purchasing Employee attempts manager-only approval | Request is denied | PASS — Prior report |
| SYS-15 | Manager workflow | Purchasing Manager approves an eligible Pending order | Order transitions to Approved | PASS — Prior report |
| SYS-16 | Delivery integrity | Authorized manager delivers an eligible Approved order | Order transitions to Delivered and stock receipt is applied exactly once | PASS — Prior report |
| SYS-17 | Analyst restrictions | Analyst / Tester attempts a write operation | Write is denied while permitted reads remain available | PASS — Prior report |
| SYS-18 | Security role boundary | Security Administrator attempts role assignment | Role escalation is denied; only the delegated account operation is allowed | NOT RUN — current evidence |
| SYS-19 | Frontend capability handling | Login/profile refresh updates role-aware navigation | UI reflects server-provided capabilities and handles profile errors | PASS — Prior report |
| SYS-20 | Full end-to-end regression | Execute complete browser journey across authentication, purchasing and role boundaries in current Docker environment | All supported workflows pass without regression | NOT RUN — current evidence |

## 6. Detailed Test Procedures

### SYS-01 — Backend Docker build

**Purpose:** Verify that the backend image can install its Python dependencies and build.

**Procedure:**
```bash
docker compose build backend
```

**Expected result:** The backend image completes all Dockerfile steps.

**Observed evidence:** The first build attempt failed during compilation of `psycopg2` because the image did not contain the required C development headers. The Dockerfile was adjusted to install `build-essential` and `libpq-dev`. The subsequent full Compose build completed successfully.

**Result:** PASS — Current run.

### SYS-02 — Frontend Docker build

**Purpose:** Verify that the Angular frontend image can be built.

**Procedure:**
```bash
docker compose build frontend
```

**Expected result:** Dependencies install and the frontend source is copied into the image.

**Observed evidence:** The successful Compose output reported the frontend image as built.

**Result:** PASS — Current run.

### SYS-03 — PostgreSQL initialization

**Purpose:** Confirm that the database container initializes and accepts connections.

**Procedure:**
```bash
docker compose logs db
```

**Expected result:** PostgreSQL reports that the database system is ready to accept connections.

**Observed evidence:** The recorded log contains the PostgreSQL readiness message.

**Result:** PASS — Current run.

### SYS-04 — Backend database dependency

**Purpose:** Confirm that backend startup is coordinated with database health.

**Procedure:**
```bash
docker compose ps
docker compose logs backend
```

**Expected result:** The backend starts after the database health check succeeds.

**Observed evidence:** The Compose output showed the database becoming healthy before the backend was reported healthy.

**Result:** PASS — Current run.

### SYS-05 — Backend health endpoint

**Purpose:** Verify the backend readiness endpoint.

**Procedure:**
```bash
curl -i http://localhost:8000/health/
```

**Expected result:** HTTP 200 and a JSON response indicating healthy status.

**Observed evidence:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status": "ok"}
```

**Result:** PASS — Current run.

### SYS-06 — Angular compilation

**Purpose:** Confirm that the frontend development server compiles the application.

**Procedure:**
```bash
docker compose logs frontend
```

**Expected result:** Angular reports successful bundle generation.

**Observed evidence:** The log reported `Application bundle generation complete` and watch mode enabled.

**Result:** PASS — Current run.

### SYS-07 — Frontend HTTP response

**Purpose:** Confirm that the frontend serves an HTTP response.

**Procedure:**
```bash
curl -I http://localhost:4200/
```

**Expected result:** HTTP 200.

**Observed evidence:** The recorded response returned `HTTP/1.1 200 OK` and `Content-Type: text/html`.

**Result:** PASS — Current run.

### SYS-08 — Compose container status

**Purpose:** Confirm that all required containers remain healthy.

**Procedure:**
```bash
docker compose ps
```

**Expected result:** Database, backend and frontend are Up and healthy.

**Observed evidence:** The recorded output showed all three containers as healthy.

**Result:** PASS — Current run.

### SYS-09 — Development database isolation

**Purpose:** Verify that the Docker environment uses an isolated development schema.

**Procedure:** Inspect the Compose configuration and backend initialization logs.

**Expected result:** The backend uses the development database and the initialization process does not import or rewrite existing business records.

**Observed evidence:** Compose config sets `DB_NAME=jedel_dev` and `JEDEL_ISOLATED_DEVELOPMENT=1`. The backend log states that the isolated development schema is ready and existing records were not imported or rewritten.

**Result:** PASS — Current run.

### SYS-10 — Role group initialization

**Purpose:** Confirm that the application role groups are prepared.

**Procedure:** Inspect backend initialization output.

**Expected result:** Six named groups are created or prepared with their configured permission sets.

**Observed evidence:** The log lists Basic User, System Administrator, Purchasing Manager, Purchasing Employee, Security Administrator and Analyst / Tester. It also states that user assignments, passwords and staff/superuser flags remain unchanged.

**Result:** PASS — Current run.

### SYS-11 — Anonymous private endpoint access

**Purpose:** Verify that private business endpoints require authentication.

**Procedure:** Send a request to a protected endpoint without a session.

**Expected result:** The backend rejects the request, normally with HTTP 401.

**Evidence classification:** Earlier project RBAC verification records a passing full isolated PostgreSQL test suite. This scenario is not claimed as newly executed in the current Docker smoke session.

**Result:** PASS — Prior report.

### SYS-12 — Basic User private-data restriction

**Purpose:** Ensure that Basic User cannot access private purchasing information.

**Procedure:** Authenticate as Basic User and request a private supplier or order endpoint.

**Expected result:** HTTP 403 or the documented equivalent denial.

**Evidence classification:** Earlier RBAC report documents Basic User as having no private business permissions and records passing automated RBAC verification.

**Result:** PASS — Prior report.

### SYS-13 — Public catalog boundary

**Purpose:** Confirm that the public catalog exposes only approved information.

**Procedure:** Request the public catalog without privileged authentication and inspect the response fields.

**Expected result:** Public product fields are limited to `product_id`, `product_name` and `category`. Prices, stock and supplier contacts are not exposed. Public catalog writes are rejected.

**Evidence classification:** Earlier project documentation describes the implemented public catalog policy and records passing verification.

**Result:** PASS — Prior report.

### SYS-14 — Purchasing Employee approval restriction

**Purpose:** Ensure that an employee cannot perform a manager-only approval.

**Procedure:** Authenticate as Purchasing Employee and call the approval endpoint for an eligible test order.

**Expected result:** The backend denies the operation.

**Evidence classification:** The documented role matrix prohibits employee approval; earlier RBAC regression evidence is recorded as passing. This exact request is not claimed as newly executed in the latest Docker session.

**Result:** PASS — Prior report.

### SYS-15 — Manager approval workflow

**Purpose:** Confirm that an authorized manager can approve an eligible Pending order.

**Procedure:** Authenticate as Purchasing Manager and submit the approval request for a test order in Pending state.

**Expected result:** The order transitions to Approved.

**Evidence classification:** Earlier project verification records purchasing lifecycle browser scenarios as passing.

**Result:** PASS — Prior report.

### SYS-16 — Delivery and inventory integrity

**Purpose:** Verify that delivery updates inventory through the authorized workflow and cannot be applied twice.

**Procedure:** Use an isolated test order in Approved state, submit the delivery operation once, and inspect order state and stock. Then attempt a repeated delivery.

**Expected result:** The first delivery transitions the order to Delivered and applies the stock receipt atomically. The repeated operation is rejected or treated as a conflict without applying stock a second time.

**Evidence classification:** Earlier project verification records the manager lifecycle/browser checks as passing. No delivery was executed against the existing business database as part of the latest Docker startup.

**Result:** PASS — Prior report.

### SYS-17 — Analyst read-only policy

**Purpose:** Ensure that Analyst / Tester can read authorized information but cannot mutate business records.

**Procedure:** Authenticate as Analyst / Tester; perform a permitted read and then attempt a write.

**Expected result:** Read is allowed; write is denied.

**Evidence classification:** The role policy and prior RBAC verification support this behavior. Not newly executed during the latest Docker startup.

**Result:** PASS — Prior report.

### SYS-18 — Security Administrator privilege boundary

**Purpose:** Ensure that delegated account-security access cannot become role administration.

**Procedure:**
1. Authenticate as Security Administrator.
2. Request the eligible account list.
3. Attempt to submit a role/group assignment.
4. Attempt to modify staff/superuser flags.
5. Attempt to target a privileged or excluded account.

**Expected result:** Only the narrowly delegated account activation operation is permitted for eligible targets. Role assignment and privilege escalation are denied.

**Evidence classification:** The policy is documented in the RBAC report, but no direct execution output for this exact scenario is present in the current evidence set.

**Result:** NOT RUN — current evidence.

### SYS-19 — Frontend capability handling

**Purpose:** Verify that role-aware navigation follows the backend profile/capability response.

**Procedure:** Sign in with accounts having different roles, refresh the profile and inspect the available navigation. Also simulate a failed profile/security request.

**Expected result:** Navigation reflects server-provided capabilities; failed profile/security calls produce an explicit error state rather than silently granting access.

**Evidence classification:** Earlier project verification records an Angular unit regression of 80 passed tests across 11 files, including a backend-capability navigation assertion.

**Result:** PASS — Prior report.

### SYS-20 — Current full end-to-end regression

**Purpose:** Validate the complete integrated application in the current Docker environment.

**Procedure:**
1. Open the frontend.
2. Authenticate with a controlled test account.
3. Verify the profile and role-aware navigation.
4. Exercise public catalog access.
5. Exercise private supplier/product/order access according to role.
6. Create a disposable Pending purchase order.
7. Verify employee and manager authorization boundaries.
8. Approve and deliver only with the correct role.
9. Verify inventory receipt exactly once.
10. Verify logout/session expiration behavior.
11. Review backend logs for errors.
12. Confirm no changes to the separate business database.

**Expected result:** All user journeys and role boundaries pass without a regression.

**Evidence classification:** The latest evidence confirms service startup and basic HTTP checks, not this entire browser journey. The complete current-run end-to-end test has not been supplied.

**Result:** NOT RUN — current evidence.

## 7. Previously Recorded Automated Test Results

The project's existing RBAC verification material records the following results from an earlier isolated verification environment:

| Test group | Recorded result | Interpretation |
|---|---:|---|
| Full isolated PostgreSQL backend suite | 126 passed, 0 failed, 0 skipped | Historical automated backend result |
| Chromium scenarios within the backend suite | 5 passed, 0 failed, 0 skipped | Included in the full suite; do not add as separate unique tests |
| Focused RBAC/Admin regression | 9 passed, 0 failed, 0 skipped | Overlaps the full suite; do not add to total unique coverage |
| Angular unit regression | 80 passed, 0 failed, 0 skipped, 11 files | Historical frontend unit-test result |
| Django system check | No issues reported | Historical framework check |
| Angular production build | Passed | Historical build result |

These numbers are quoted as previously recorded project evidence. They are not claimed to have been rerun as part of the latest Docker startup.

## 8. Defect and Resolution Record

### 8.1 Backend dependency build failure

**Observed issue:** The first Docker build failed while compiling `psycopg2`. The compiler output reported that `assert.h` could not be found.

**Cause indicated by build output:** The build image did not contain the complete required C development toolchain/headers.

**Resolution recorded:** The backend Dockerfile was changed to install `build-essential` and `libpq-dev`.

**Retest:** A subsequent `docker compose up --build` completed successfully and built both backend and frontend images.

**Status:** Resolved for the recorded local build.

### 8.2 Startup readiness

**Potential issue:** Services may start before their dependencies are ready.

**Control:** Compose health checks and service dependency conditions coordinate database, backend and frontend startup.

**Retest evidence:** All three containers were shown as healthy.

**Status:** Passed in the recorded local run.

## 9. Test Limitations

- A healthy container does not prove every API route works.
- An HTTP 200 response from `/` does not prove every Angular page or form works.
- A backend health response does not prove every business transaction works.
- A role group being initialized does not prove a particular user has been assigned to it.
- Historical test results must not be represented as newly executed tests.
- The latest Docker database is isolated and does not contain the full existing business dataset unless separately seeded.
- AI Copilot tests are outside the scope of this report.

## 10. Final Assessment

The current Docker evidence supports a successful local build and service-startup baseline. The backend and frontend both respond over HTTP, PostgreSQL is ready, all three containers are healthy, and the six application role groups are initialized in the isolated development schema.

Earlier project verification documents also record successful backend, browser, RBAC and Angular test runs. Those results provide additional project evidence but belong to a previous verification run.

For a fully current acceptance sign-off, SYS-18 and SYS-20 should be executed in the current Docker environment, and the evidence should be attached to the repository. The report deliberately keeps those scenarios marked NOT RUN until their results are available.

## 11. Recommended Evidence to Commit

The following evidence can be stored alongside this report, after checking that it contains no credentials or private data:

- Sanitized output of `docker compose ps`.
- Sanitized output of `curl -i http://localhost:8000/health/`.
- Sanitized output of `curl -I http://localhost:4200/`.
- Relevant backend startup log lines showing role initialization and isolated schema readiness.
- Test runner output for the current backend suite.
- Test runner output for current frontend unit tests.
- Screenshots of role-specific UI behavior using disposable test accounts.
- Screenshots or API responses demonstrating denied requests for unauthorized roles.

Do not commit `.env`, passwords, API keys, database dumps containing real business data, session cookies or private runtime artifacts.

## 12. Reproduction Commands

```bash
# Build and start the local system
docker compose up --build

# Check service status
docker compose ps

# Backend readiness
curl -i http://localhost:8000/health/

# Frontend HTTP response
curl -I http://localhost:4200/

# Inspect backend initialization and runtime logs
docker compose logs backend

# Inspect frontend compilation and runtime logs
docker compose logs frontend

# Inspect database readiness logs
docker compose logs db
```
