# JEDEL.GROUP ERP
## Software Testing Report

**Project:** Jedel.Group ERP System  
**Testing Stage:** Intermediate Testing  
**Date:** November 20, 2026  
**Project Type:** Enterprise Resource Planning System  
**Testing Environment:** macOS / Docker Compose

---

## 1. Introduction

The purpose of this testing phase was to evaluate the functionality, stability, reliability, and integration of the current Jedel.Group ERP system.

Testing focused on the backend, frontend, database connectivity, automated testing, production build, Docker infrastructure, API availability, authentication-related endpoints, and communication between application services.

The testing process combined automated backend and frontend tests, infrastructure verification, API checks, and manual integration inspection.

This is an intermediate testing report. Its objective is to verify the current implementation, document completed testing activities, and identify areas requiring additional verification before final submission.

## 2. Testing Environment

The project was tested using the following environment:

| Component | Environment |
|---|---|
| Operating System | macOS |
| Backend | Django / Python 3.13.18 |
| Database | PostgreSQL 17 |
| Frontend | Angular 21 |
| Frontend Testing | Vitest 4.1.12 |
| E2E Testing | Playwright |
| Containerization | Docker Compose |
| Docker | 29.9.3 |
| Node.js | v24.13.0 |
| npm | 11.6.2 |

The application consists of three Docker services:

- Django Backend
- Angular Frontend
- PostgreSQL Database

All three services reported a healthy status during infrastructure verification.

### Local Service Configuration

| Service | Local Address / Port |
|---|---|
| Frontend | 127.0.0.1:14200 |
| Backend | 127.0.0.1:18000 |
| PostgreSQL | Internal Docker network, port 5432 |

## 3. Backend Automated Testing

Backend testing was performed using a separate temporary PostgreSQL cluster.

This approach allowed automated database tests to execute independently without modifying the project's regular application database.

The test suite was executed using the project's PostgreSQL test runner.

**Results:**

| Metric | Result |
|---|---:|
| Total tests discovered | 197 |
| Tests passed | 196 |
| Tests skipped | 1 |
| Tests failed | 0 |
| Execution time | 15.166 seconds |
| Process exit code | 0 |
| Overall result | PASS |

One browser workflow test, `test_real_browser_workflow`, was skipped because browser testing requires explicit configuration through `JEDEL_BROWSER_TESTS=1` and Playwright Chromium.

The backend test command completed successfully with exit code 0.

**Conclusion:** The backend automated test suite passed successfully, with 196 passing tests, one skipped test, and no reported failures.

## 4. Frontend Unit Testing

Frontend testing was performed using Angular's testing environment and Vitest.

**Results:**

| Metric | Result |
|---|---:|
| Test files passed | 15 |
| Test files failed | 0 |
| Total tests passed | 112 |
| Total tests failed | 0 |
| Overall result | PASS |

The tested components included:

- Authentication
- Account navigation
- Public navigation
- Product selector
- Product metadata
- API data service
- Demo data service
- Metrics
- Store functionality
- Public catalog
- Copilot
- Application pages
- General application sections
- Authentication page
- Statistics card

One Angular performance warning (NG0956) appeared during a page test. It did not cause the test to fail.

**Conclusion:** All 112 frontend unit tests passed successfully across 15 test files.

## 5. Frontend Production Build

The Angular production build was executed using:

`npm run build`

**Results:**

| Metric | Result |
|---|---|
| Build status | Successful |
| Build errors | 0 |
| Initial bundle size | 483.12 kB |
| Estimated transfer size | 120.00 kB |
| Output directory | frontend/dist/frontend |

The Angular application compiled successfully and generated the production output.

**Conclusion:** The frontend production build completed successfully without compilation errors.

## 6. End-to-End Testing

Playwright was used to initiate 10 browser-based test scenarios.

The Chromium browser was successfully installed. However, the tests reported that they require the project's isolated backend browser testing harness.

The following scenarios were included in the suite:

1. Account registration and authentication.
2. Access control across application sections.
3. Handling unavailable backend responses.
4. Copilot consent functionality.
5. Copilot search for anonymous and Basic users.
6. Authorized Copilot functionality.
7. Dark theme and responsive interface.
8. Unified authentication and bookmarks.
9. Visual regression across five viewport sizes.
10. Purchasing workflow and restricted operations.

**Results:**

| Metric | Result |
|---|---|
| Test scenarios attempted | 10 |
| Scenarios passed | 0 |
| Scenarios blocked during execution | 10 |
| Main reason | Isolated backend harness required |

The tests stopped at explicit environment guards because they were launched without the required isolated test configuration.

These results do not establish that the application's business functionality is broken. They indicate that the browser-based scenarios could not proceed to functional verification.

Full automated browser-based end-to-end verification therefore remains outstanding.

**Conclusion:** Playwright was installed successfully, and the E2E test suite was initiated. However, full execution requires additional isolated testing configuration.

## 7. Docker and Infrastructure Testing

Docker Compose was used to verify the availability and health of the three application services.

The infrastructure was checked using:

`docker compose ps`

**Results:**

| Service | Container | Status |
|---|---|---|
| PostgreSQL | db | Up (healthy) |
| Django Backend | backend | Up (healthy) |
| Angular Frontend | frontend | Up (healthy) |

All three services reported healthy statuses during verification.

**Conclusion:** The Docker Compose environment started successfully, and all application services were reported healthy.

## 8. API and HTTP Availability Testing

The backend and frontend endpoints were checked using `curl`.

### 8.1 Backend Health Endpoint

Command:

`curl -i http://127.0.0.1:18000/health/`

**Result:**

- HTTP Status: 200 OK
- Response: `{"status": "ok"}`

The backend health endpoint responded successfully.

### 8.2 Frontend Availability

Command:

`curl -I http://127.0.0.1:14200/`

**Result:**

- HTTP Status: 200 OK
- Content-Type: text/html

The Angular frontend successfully returned the application page.

### 8.3 Authentication and CSRF Endpoint

Command:

`curl -i http://127.0.0.1:18000/api/auth/csrf/`

**Result:**

- HTTP Status: 200 OK
- JSON response containing a CSRF token.
- CSRF cookie successfully issued.
- Cookie configured with SameSite=Lax.

This confirmed that the CSRF endpoint responded successfully and issued the expected authentication-related cookie.

**Summary:**

| Endpoint | HTTP Status | Result |
|---|---|---|
| Backend `/health/` | 200 | PASS |
| Frontend `/` | 200 | PASS |
| Authentication `/api/auth/csrf/` | 200 | PASS |

**Conclusion:** All three HTTP endpoint checks returned successful responses during verification.

## 9. Manual Integration Verification

A manual integration check was performed using the running Docker environment.

The following components and connections were inspected:

- PostgreSQL database container was running and healthy.
- Django backend was running and healthy.
- Angular frontend was running and healthy.
- Backend health endpoint returned HTTP 200.
- Frontend returned HTTP 200.
- Authentication CSRF endpoint returned HTTP 200 and issued a CSRF cookie.
- Frontend API configuration was inspected and confirmed to use `/api` as its API base URL.
- Angular HTTP configuration was inspected, including the session interceptor and CSRF configuration.
- Development and Docker proxy configurations were inspected to verify how frontend API requests are forwarded to the backend.
- The application was manually opened and checked in the running environment.

These checks provided evidence of service availability and the expected frontend/backend integration configuration.

**Important:** Configuration inspection and successful endpoint responses do not independently prove that every authenticated business workflow works end to end. Full browser-based workflow verification remains pending.

**Conclusion:** Manual infrastructure and connectivity verification was completed successfully.

## 10. Summary of Testing Results

| Testing Area | Result |
|---|---|
| Backend automated tests | PASS |
| PostgreSQL isolated test environment | PASS |
| Frontend unit tests | PASS |
| Frontend production build | PASS |
| Docker PostgreSQL service | PASS |
| Docker Django backend service | PASS |
| Docker Angular frontend service | PASS |
| Backend HTTP availability | PASS |
| Frontend HTTP availability | PASS |
| Authentication CSRF endpoint | PASS |
| Manual integration verification | PASS |
| Playwright E2E scenarios | BLOCKED |
| Visual regression testing | NOT VERIFIED |

### Overall Testing Statistics

- 197 backend tests discovered.
- 196 backend tests passed.
- 1 backend test skipped.
- 0 backend test failures.
- 112 frontend unit tests passed.
- 15 frontend test files passed.
- Production build completed successfully.
- Initial frontend bundle size: 483.12 kB.
- All three Docker services reported healthy.
- Three HTTP endpoint checks returned status 200.
- Manual infrastructure and connectivity verification completed.
- Full Playwright E2E execution remains outstanding.

## 11. Identified Issues and Limitations

The testing phase identified the following points requiring further attention:

**1. E2E Test Configuration**

Playwright scenarios require the isolated backend browser testing harness and the appropriate environment variables.

**2. Angular Performance Warning**

Angular warning NG0956 indicates that a collection is being unnecessarily recreated during one page test. This should be reviewed to improve rendering efficiency.

**3. Visual Regression Testing**

Screenshot-based comparisons across five viewport sizes have not yet been fully verified.

**4. Browser Workflow Testing**

One backend browser workflow test remains skipped because browser testing is opt-in and requires additional configuration.

**5. Full Business Workflow Verification**

Although the infrastructure, endpoint availability, and integration configuration were checked, complete browser-based verification of authentication, purchasing, and restricted operations remains outstanding.

These limitations do not invalidate the successful backend and frontend unit testing results.

## 12. Conclusion

The intermediate testing phase demonstrated that the current Jedel.Group ERP implementation has a stable and functional technical foundation.

The backend successfully completed 196 automated tests out of 197 discovered tests, with one skipped browser test and no reported failures.

The frontend successfully completed all 112 unit tests across 15 test files. The Angular production build was also generated successfully without compilation errors.

Docker Compose confirmed that the PostgreSQL database, Django backend, and Angular frontend services were running and healthy.

HTTP availability checks confirmed that the backend health endpoint, frontend application endpoint, and authentication CSRF endpoint all returned HTTP 200 responses.

Manual integration inspection also confirmed the frontend API base URL, session interceptor configuration, CSRF configuration, and proxy settings.

Although the full Playwright end-to-end suite still requires its isolated testing environment, the completed automated tests and infrastructure checks provide evidence of successful backend and frontend implementation at this development stage.

**Final Assessment: The Jedel.Group ERP system successfully passed backend automated testing, frontend unit testing, production build verification, Docker infrastructure checks, API availability testing, and basic manual integration verification. Full browser-based end-to-end and visual regression testing remain planned for the next testing stage.**

---

**Report prepared for:** Jedel.Group ERP Project  
**Testing date:** November 20, 2026  
**Testing approach:** Automated testing, infrastructure verification, API testing, and manual integration inspection  
**Testing environment:** Local Docker Compose development environment
