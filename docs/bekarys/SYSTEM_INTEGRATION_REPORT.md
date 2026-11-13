# Jedel.Group — System Integration Report

**Document type:** System Analysis / Technical Integration  
**Prepared by:** Toktar Bekarys  
**Project:** Jedel.Group ERP  
**Date:** 13 November 2026  
**Scope:** Frontend–Backend–Database integration and local Docker deployment  
**Excluded from this report:** AI Copilot implementation and provider integration, handled separately by the assigned AI developer.

---

## 1. Executive Summary

This report documents the system integration work and the available verification evidence for the Jedel.Group ERP application. The system is composed of an Angular frontend, a Django REST backend, and a PostgreSQL relational database. Docker Compose is used to start the application components together in an isolated local development environment.

The integration objective is to ensure that the application layers can start, communicate, and expose the expected service interfaces without requiring developers to configure each component independently. The integration also preserves the system's existing purchasing workflow, authentication, role-based access control, and database safety boundaries.

The latest local Docker run reached a successful build and startup state:

- Frontend and backend Docker images were built successfully.
- PostgreSQL 17 initialized and reported that it was ready to accept connections.
- The backend completed its startup initialization and reported healthy.
- The frontend Angular development server completed bundle generation.
- The backend health endpoint returned HTTP 200 with `{"status":"ok"}`.
- The frontend root endpoint returned HTTP 200.
- `docker compose ps` showed all three containers as healthy.

These results establish successful local service startup and basic connectivity. They do not, by themselves, prove that every business workflow or every browser interaction has been tested.

## 2. System Overview

### 2.1 Architecture

The application follows a three-layer architecture:

| Layer | Technology | Responsibility |
|---|---|---|
| Presentation | Angular, TypeScript, HTML, SCSS | User interface, navigation, forms, client-side state and API consumption |
| Application / API | Django, Django REST Framework | Authentication, authorization, business rules, validation and API responses |
| Data | PostgreSQL 17 | Persistent relational storage for suppliers, products, purchase orders and order items |
| Local orchestration | Docker Compose | Starts the database, backend and frontend with service dependencies and health checks |

### 2.2 Component responsibilities

**Frontend**
- Presents the purchasing workspace and public catalog.
- Requests data through the backend API.
- Uses authenticated session/profile information and server-provided capabilities to control protected navigation.
- Displays validation and API errors rather than treating a failed request as a successful operation.
- Does not independently decide whether a user is authorized to perform a protected operation.

**Backend**
- Exposes REST endpoints for authentication, products, suppliers, purchase orders, analytics and security-account operations.
- Enforces authorization and business rules on the server.
- Controls order status transitions and inventory receipt operations.
- Uses database transactions for critical business operations.
- Provides health and API documentation endpoints.

**Database**
- Stores the system's purchasing data.
- Maintains relational integrity and persistence.
- Is accessed by the backend rather than directly by the browser.
- Uses a separate isolated development database in the Docker Compose environment.

## 3. Integration Objectives

The integration work is intended to achieve the following:

1. Establish a repeatable local startup procedure.
2. Build the Angular and Django services from the repository.
3. Start PostgreSQL before the backend attempts database operations.
4. Wait for database readiness using a health check.
5. Verify backend readiness through an HTTP health endpoint.
6. Start the frontend after the backend becomes healthy.
7. Route frontend API requests through the configured Docker development proxy.
8. Keep credentials in environment configuration rather than source code.
9. Keep local test data isolated from the existing business database.
10. Preserve the API, authentication, RBAC and purchasing workflow contracts.

## 4. Docker Compose Integration

### 4.1 Services

The Compose configuration defines three services:

| Service | Image / build source | Internal responsibility | Host binding |
|---|---|---|---|
| `db` | `postgres:17` | PostgreSQL database | Container port 5432; no host port published in the shown configuration |
| `backend` | `backend/Dockerfile` | Django application and API | `127.0.0.1:8000:8000` |
| `frontend` | `frontend/Dockerfile` | Angular development server | `127.0.0.1:4200:4200` |

The frontend and backend are exposed on loopback addresses for local development. This is appropriate for a development environment and should not be treated as a production deployment configuration.

### 4.2 Startup dependencies

The database service uses `pg_isready` as its health check. The backend depends on the database reaching the `service_healthy` state. The backend has its own HTTP health check against `/health/`. The frontend depends on the backend reaching the healthy state.

This dependency chain reduces startup race conditions:

`PostgreSQL ready → Backend initialized and healthy → Frontend started`

### 4.3 Environment configuration

The root `.env` file is used to provide private development values, including the PostgreSQL password and Django secret key. The setup script created a private root `.env` with independent development secrets.

AI-related environment variables are present in the Compose configuration because the repository supports a separately implemented AI component. Their presence does not mean that AI implementation is part of this report's scope.

**Security rule:** `.env` files, API keys, passwords and private runtime files must not be committed to Git. Only safe templates such as `.env.example` should be version-controlled.

### 4.4 Database isolation

The Compose configuration uses a named Docker volume, `postgres_data`, and a development database named `jedel_dev`. The backend is configured with `JEDEL_ISOLATED_DEVELOPMENT=1`.

The startup output explicitly reported that the development schema was isolated and that existing records were not imported or rewritten. This is important because the development container database is not the same as the previously used `jedel_group_db` business database.

The Docker initialization created a new PostgreSQL data volume. It should not be interpreted as a migration or modification of the existing business database.

## 5. API Integration

The Angular application communicates with Django through HTTP API endpoints. The frontend should treat the backend as the authoritative source for data, permissions and business workflow outcomes.

### 5.1 Main API areas

| API area | Example endpoint | Purpose |
|---|---|---|
| Health | `GET /health/` | Readiness check including required database/table readiness |
| Liveness | `GET /api/health/` | Application liveness; not a database-readiness guarantee |
| Authentication | `/api/auth/...` | Login, registration, logout and current-user profile |
| Public catalog | `GET /api/catalog/products/` | Public product preview using approved fields |
| Public categories | `GET /api/catalog/categories/` | Public category facets |
| Access capabilities | `GET /api/access/` | Protected purchasing-workspace capabilities |
| Suppliers | `/api/suppliers/` | Protected supplier directory and management |
| Products | `/api/products/` | Protected product operations |
| Purchase orders | `/api/orders/` | Purchase-order creation, reading and eligible amendment |
| Order workflow | `/api/orders/{id}/approve/` | Approval transition |
| Order workflow | `/api/orders/{id}/deliver/` | Delivery and inventory receipt |
| Order workflow | `/api/orders/{id}/cancel/` | Eligible cancellation |
| Dashboard | `GET /api/dashboard/` | Private purchasing and inventory metrics |
| Analytics | `/api/analytics/...` | Private purchasing analytics |
| Security accounts | `/api/security/accounts/` | Restricted account activation controls |
| API documentation | `/api/docs/`, `/api/schema/` | API reference and schema |

Exact request and response contracts should be maintained in `docs/API.md` and the backend URL/view implementation. The table above is an architectural index, not a replacement for the endpoint specification.

### 5.2 Public and private API boundary

The public catalog intentionally exposes a limited set of product information. The documented public product representation contains `product_id`, `product_name` and `category`. It does not expose purchasing prices, stock quantities or supplier contact information.

Private purchasing endpoints remain protected. A frontend route guard or hidden button is not a security boundary; the backend must independently reject unauthorized requests.

### 5.3 Business workflow integration

The purchasing workflow uses the following states:

`Pending → Approved → Delivered`

An eligible order may also be cancelled. The backend controls which transitions are allowed.

- A new purchase order is created in `Pending`.
- Eligible Pending orders may be amended.
- An authorized manager may approve an eligible Pending order.
- Delivery is performed through the backend workflow service.
- Delivery updates inventory using the server-side business operation.
- A delivery must not be replayed when its result is uncertain; the current order state must be checked first.
- Cancellation follows the defined business rules and must not be implemented as an arbitrary client-side status edit.

The frontend must call the dedicated workflow endpoints instead of directly changing status or stock fields.

## 6. Authentication and Session Integration

The application uses a server-managed authentication/session model. The browser must not store passwords or session secrets in local storage.

The frontend should:
1. Submit credentials to the authentication endpoint.
2. Handle the server response.
3. Retrieve the authenticated user's profile.
4. Use server-provided role/capability information for navigation and UI affordances.
5. Handle expired sessions and authorization errors.
6. Use the expected CSRF/session mechanism for state-changing requests.
7. Treat the backend response as authoritative.

Registration must not display a successful welcome state until account creation and session persistence have succeeded and the client has retrieved the resulting profile.

## 7. Integration Verification Evidence

### 7.1 Build

The successful Docker build output reported that both images were built:

- `jedel-group-database-backend`
- `jedel-group-database-frontend`

The earlier backend build failure occurred while compiling `psycopg2` because the build image lacked the required C development headers. The Dockerfile was adjusted to install `build-essential` and `libpq-dev`. The subsequent build completed successfully.

### 7.2 Runtime status

The recorded `docker compose ps` output showed:

| Container | Status |
|---|---|
| `jedel-group-database-db-1` | Up, healthy |
| `jedel-group-database-backend-1` | Up, healthy |
| `jedel-group-database-frontend-1` | Up, healthy |

### 7.3 Backend health check

Command executed:

```bash
curl -i http://localhost:8000/health/
```

Observed result:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status": "ok"}
```

This confirms that the backend health endpoint responded successfully in the running Docker environment.

### 7.4 Frontend HTTP check

Command executed:

```bash
curl -I http://localhost:4200/
```

Observed result:

```http
HTTP/1.1 200 OK
Content-Type: text/html
```

The Angular development server also reported successful application bundle generation and watch mode.

### 7.5 Database initialization

The PostgreSQL logs reported that the database system was ready to accept connections. The backend then completed its startup initialization, applied the standard Django framework migrations shown in the logs, provisioned the six application role groups in the isolated development schema, and reported that the isolated schema was ready.

This startup evidence applies to the new Docker development database. It is not evidence that the existing business database was migrated.

## 8. Integration Risks and Controls

| Risk | Potential impact | Control |
|---|---|---|
| Backend starts before PostgreSQL is ready | Connection errors during startup | Database health check and `depends_on: service_healthy` |
| Frontend uses an incorrect API base URL | API requests fail | Docker proxy configuration and endpoint smoke checks |
| Frontend trusts hidden buttons as authorization | Unauthorized API access | Enforce permissions in Django views/services |
| Public catalog returns private fields | Business information disclosure | Explicit serializer/queryset allowlist |
| Delivery request is repeated | Duplicate inventory receipt | Transactional workflow and state validation |
| Local development uses a business database | Accidental data modification | Isolated `jedel_dev` database and named volume |
| Secrets are committed | Credential exposure | `.env` exclusion and safe example templates |
| Development server is exposed publicly | Unintended access | Loopback-only host port bindings; production server required for deployment |

## 9. Limitations

The evidence in this report confirms successful local container startup, build completion, database readiness, backend health and frontend HTTP availability.

The following should not be inferred from these checks alone:
- Full end-to-end completion of every user journey.
- Successful execution of every purchasing transition through the browser.
- Production readiness, load capacity or production security.
- Successful integration with a remote production database.
- A completed Git merge or push.
- A completed manual acceptance test for every role.

The AI Copilot is outside this report's implementation scope.

## 10. Conclusion

The local integration environment successfully builds and starts the three main system services. PostgreSQL becomes ready, Django initializes against the isolated development database, and Angular compiles and serves the frontend. The backend and frontend HTTP smoke checks both return successful responses.

The system therefore has a verified local integration baseline. Further acceptance should focus on authenticated browser workflows, role-specific access, API error handling, order lifecycle behavior and regression testing.

## 11. Reproduction Commands

```bash
# From the repository root
bash scripts/setup-docker.sh

# Build and start all services
docker compose up --build

# In another terminal
docker compose ps

# Backend readiness
curl -i http://localhost:8000/health/

# Frontend HTTP response
curl -I http://localhost:4200/

# Stop services without deleting the development database volume
docker compose down
```

Do not use `docker compose down -v` unless the intention is to delete the isolated development database volume and its data.
