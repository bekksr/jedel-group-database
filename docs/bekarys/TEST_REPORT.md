# Jedel.Group ERP — Test Report

**Project:** Jedel.Group ERP  
**Testing Date:** November 20, 2026  
**Environment:** macOS, Python 3.13.18, PostgreSQL 17, Angular 21, Docker 29.9.3  
**Testing Type:** Backend Automated Testing, Infrastructure Testing, API Testing, Manual Integration Testing

---

## 1. Testing Objectives

The purpose of testing was to verify that the main components of the Jedel.Group ERP system work correctly and communicate with each other.

The testing focused on:

- Backend functionality and database operations.
- PostgreSQL database connectivity.
- Frontend availability.
- Backend API availability.
- Authentication and CSRF endpoint.
- Docker-based service integration.
- Overall system connectivity.

## 2. Backend Automated Testing

The backend automated test suite was executed using:

```bash
PG_BIN=/Library/PostgreSQL/17/bin ./venv/bin/python scripts/test_postgres.py
```

The test runner created a separate temporary PostgreSQL cluster to execute tests without modifying the existing application database.

**Results:**

| Metric | Result |
|---|---:|
| Total tests discovered | 197 |
| Tests passed | 196 |
| Tests skipped | 1 |
| Tests failed | 0 |
| Execution time | 15.166 seconds |
| Process exit code | 0 |

One test, `test_real_browser_workflow`, was skipped because browser testing requires explicit configuration (`JEDEL_BROWSER_TESTS=1`) and Playwright Chromium installation.

**Status: PASSED**

The backend automated test suite completed successfully.

## 3. Docker Infrastructure Testing

The Docker Compose environment was checked using:

```bash
docker compose ps
```

All three application services were running and reported a healthy status.

| Service | Container | Status |
|---|---|---|
| PostgreSQL | db | Up (healthy) |
| Django Backend | backend | Up (healthy) |
| Angular Frontend | frontend | Up (healthy) |

The application services were accessible through the following local ports:

- Frontend: `127.0.0.1:14200`
- Backend: `127.0.0.1:18000`
- PostgreSQL: Internal Docker network, port 5432.

**Status: PASSED**

All three Docker services were running successfully.

## 4. Backend API Connectivity Testing

The backend health endpoint was tested:

```bash
curl -i http://127.0.0.1:18000/health/
```

**Result:**

- HTTP Status: 200 OK
- Response: `{"status": "ok"}`

This confirmed that the backend could connect to the required database tables.

The CSRF endpoint was also tested:

```bash
curl -i http://127.0.0.1:18000/api/auth/csrf/
```

**Result:**

- HTTP Status: 200 OK
- JSON response containing a CSRF token.
- CSRF cookie successfully issued.
- Cookie configured with `SameSite=Lax`.

**Status: PASSED**

The backend health and CSRF endpoints responded successfully.

## 5. Frontend Availability Testing

The frontend was checked using:

```bash
curl -I http://127.0.0.1:14200/
```

**Result:**

- HTTP Status: 200 OK
- Content-Type: text/html
- Frontend server successfully returned the application page.

**Status: PASSED**

The Angular frontend was accessible through its Docker service.

## 6. Manual End-to-End Integration Verification

A manual integration check was performed using the running Docker environment.

The following components and connections were verified:

1. PostgreSQL database container was running and healthy.
2. Django backend was running and healthy.
3. Angular frontend was running and healthy.
4. Backend health endpoint returned HTTP 200.
5. Frontend returned HTTP 200.
6. Authentication CSRF endpoint returned HTTP 200 and issued a CSRF cookie.
7. Frontend API configuration was checked and confirmed to use `/api` as its API base URL.
8. Angular HTTP configuration was inspected, including the session interceptor and CSRF configuration.
9. Development and Docker proxy configurations were inspected to verify how frontend API requests are forwarded to the backend.

The application was also manually opened and checked, and the running environment was reported to be working correctly.

**Status: PASSED — Manual infrastructure and connectivity verification.**

## 7. Frontend Automated Testing and Build

Frontend unit tests, production build and Playwright E2E tests were attempted.

The commands returned exit code 127:

| Check | Result |
|---|---|
| Frontend unit tests | Not completed |
| Production build | Not completed |
| Playwright E2E tests | Not completed |

These commands could not complete successfully in the local shell environment. Therefore, no frontend automated test pass count or successful production build is claimed in this report.

## 8. Overall Testing Summary

| Testing Area | Result |
|---|---|
| Backend automated tests | PASSED |
| PostgreSQL isolated test execution | PASSED |
| Docker PostgreSQL service | PASSED |
| Docker Django backend service | PASSED |
| Docker Angular frontend service | PASSED |
| Backend health endpoint | PASSED |
| Frontend HTTP availability | PASSED |
| Authentication CSRF endpoint | PASSED |
| Manual integration verification | PASSED |
| Frontend automated unit tests | NOT COMPLETED |
| Frontend production build | NOT COMPLETED |
| Browser E2E automated tests | NOT COMPLETED |

## 9. Conclusion

The performed tests confirmed that the main Jedel.Group ERP infrastructure is operational.

The backend successfully passed 197 discovered automated tests, with 196 passing and one optional browser test skipped.

The PostgreSQL, Django backend and Angular frontend Docker services were running and healthy. HTTP connectivity to the frontend and backend was confirmed, and the authentication CSRF endpoint successfully returned a token and issued a cookie.

Manual inspection also confirmed the frontend API configuration, HTTP interceptor and proxy configuration.

Frontend automated tests, production build and browser E2E tests remain unverified because their execution returned exit code 127.

**Final Assessment:** The backend, database infrastructure, frontend availability and main service connectivity were successfully verified. The system passed the performed integration and backend testing checks, with additional frontend automated verification remaining.

---

**Report prepared for:** Jedel.Group ERP Project  
**Testing approach:** Automated backend tests and manual integration verification  
**Environment:** Local Docker Compose development environment
