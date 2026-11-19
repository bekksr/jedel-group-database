# Jedel.Group — End-to-End Integration Report

**Project:** Jedel.Group ERP Supplier & Purchasing System  
**Test date:** November 20, 2026  
**Environment:** Local Docker Compose  
**Branch:** `main`  
**Testing method:** Manual integration and HTTP smoke testing

## 1. Objective

The purpose of this verification was to confirm that the main application components are configured, running, and able to communicate within the local Docker environment.

The verification covered the frontend, backend, PostgreSQL database, Docker Compose services, and authentication infrastructure.

## 2. System Architecture

The application consists of three main services:

| Component | Technology | Port |
|---|---|---|
| Frontend | Angular | 14200 |
| Backend | Django REST Framework | 18000 |
| Database | PostgreSQL 17 | Internal Docker network, 5432 |

The frontend uses the `/api` base URL. Docker's frontend proxy is configured to forward API requests to the backend service.

The backend connects to PostgreSQL using Docker's internal service hostname.

## 3. Manual Verification Results

### 3.1 Docker Compose

Executed:

`docker compose ps`

All three services were running and reported healthy:

- `jedel-group-database-frontend-1`
- `jedel-group-database-backend-1`
- `jedel-group-database-db-1`

**Result:** PASS

### 3.2 Backend Health Check

Executed:

`curl -i http://127.0.0.1:18000/health/`

Received:

- HTTP status: 200 OK
- Response: `{"status": "ok"}`

The health endpoint also checks the availability of required database tables.

**Result:** PASS

### 3.3 Frontend Availability

Executed:

`curl -I http://127.0.0.1:14200/`

Received:

- HTTP status: 200 OK
- Content-Type: text/html

The frontend server successfully returned its application entry page.

**Result:** PASS

### 3.4 CSRF Endpoint

Executed:

`curl -i http://127.0.0.1:18000/api/auth/csrf/`

Received:

- HTTP status: 200 OK
- JSON response containing `csrfToken`
- `csrftoken` cookie successfully issued
- Cookie configured with `SameSite=Lax`

**Result:** PASS

### 3.5 Database Integration

The backend health endpoint successfully checked the required PostgreSQL tables:

- suppliers
- products
- purchase_orders
- purchase_order_items
- auth_user
- django_session

The endpoint returned `{"status": "ok"}`.

**Result:** PASS

### 3.6 Frontend and Backend Configuration

The following integration settings were inspected:

- Angular API base URL: `/api`
- Docker frontend proxy target: `http://backend:8000`
- Backend authentication endpoints registered in Django URL configuration
- Angular HTTP client configured with the session interceptor and XSRF settings
- Backend configured to use session-based authentication

**Result:** Configuration verified.

## 4. Security and Authentication Configuration

The reviewed implementation includes:

- Django session authentication
- CSRF protection for login and registration
- Email or username authentication
- Password validation
- Login and registration rate limiting
- Environment-based API credentials for ERP roles
- Secure session cookie settings
- Restricted CORS configuration

The CSRF endpoint was manually tested. Actual browser-based registration and login workflows were not part of this verification.

## 5. Overall Results

| Area | Result |
|---|---|
| Docker environment | PASS |
| PostgreSQL service | PASS |
| Django backend service | PASS |
| Angular frontend service | PASS |
| Backend health endpoint | PASS |
| Frontend HTTP availability | PASS |
| CSRF endpoint | PASS |
| Required database tables | PASS |
| Frontend proxy configuration | VERIFIED |
| Authentication implementation | CODE REVIEWED |

## 6. Testing Limitations

This verification represents a manual integration smoke test.

The following scenarios were not confirmed by the HTTP checks described above:

- Complete browser-based registration
- Complete browser-based login and logout
- Authenticated frontend API requests through the Docker proxy
- Full purchasing workflow from order creation to delivery
- Full automated end-to-end browser testing

These scenarios require additional functional testing.

## 7. Conclusion

The local Jedel.Group application environment was successfully started and manually verified.

All three Docker Compose services reported healthy status. The backend returned HTTP 200 from its health endpoint, the frontend returned HTTP 200, and the CSRF endpoint successfully issued a token and cookie.

The backend successfully verified the presence of the required database tables.

The frontend proxy and authentication configuration were also inspected.

**Final conclusion:** The core application infrastructure and integration configuration are operational. Full functional end-to-end acceptance testing remains a separate step.

**Report prepared:** November 20, 2026.
