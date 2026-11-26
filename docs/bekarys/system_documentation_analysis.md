# Jedel.Group ERP System Documentation Analysis

> Status: analysis report only. This document is the source basis for future system documentation. Existing application code, database files and UML deliverables are not modified.

## 1. System Overview

Jedel.Group ERP is an educational supplier and purchasing system built around suppliers, products, purchase orders and purchase order items. The verified scope includes:

- catalog maintenance for suppliers and products;
- purchase-order preparation and amendment;
- approval, cancellation and full delivery;
- inventory updates on successful delivery;
- purchasing dashboard and supplier/status reports;
- session-based authentication and role-based access;
- restricted account activation for eligible accounts.

The project is also configured with a separate AI Assistant, public catalog and development tooling, but AI Assistant behavior is excluded from this purchasing system documentation as requested.

The primary business purpose is to maintain purchasing records, prevent invalid or duplicate operations and keep Delivered receipts synchronized with product stock. This is procurement, not customer sales management.

## 2. Scope and Architecture

| Layer | Verified implementation |
|---|---|
| Frontend | Angular, TypeScript, HTML and SCSS routes/pages/components in `frontend/src/app/` |
| API | Django and Django REST Framework in `backend/apps/purchasing/` |
| Database | PostgreSQL 17 business tables |
| Authentication | Django session authentication, CSRF and server-side account profiles |
| Main boundary | Purchasing, catalog, inventory and account-security operations |

The frontend uses Angular services and the Store abstraction. API mode loads data from Django; public catalog mode exposes only public product fields without private purchasing authentication.

### 2.1 Modules

1. **Authentication and account management**
   - registration, login, logout;
   - profile and password operations;
   - account capabilities and role profile;
   - restricted activation/deactivation.

2. **Supplier management**
   - list, retrieve, create, update and delete suppliers;
   - validate and normalize supplier fields.

3. **Product/catalog management**
   - list, retrieve, create and update catalog fields;
   - stock is read-only through catalog APIs;
   - protected deletion rules.

4. **Purchase Order management**
   - create and view orders;
   - amend only Pending orders;
   - approve, cancel and deliver.

5. **Inventory and reporting**
   - stock is updated only by successful full delivery;
   - dashboard totals;
   - supplier spending;
   - order status distribution;
   - low-stock overview.

### 2.2 Architecture flow

Angular pages/services call Django REST endpoints. Django permissions select capabilities, serializers validate input, and atomic service functions apply database business rules. PostgreSQL stores authoritative business records and constraints.

`Django` models in `backend/apps/purchasing/models.py` use `managed = False` for four business tables. This means application migrations do not own or alter those tables; the database schema is treated as an existing manually reviewed mapping.

## 3. Modules and Functional Requirements

| Area | Implemented capabilities |
|---|---|
| Authentication | CSRF, login, registration, logout, current profile, profile name update, password change |
| Public catalog | Product id/name/category browsing and category browsing |
| Private suppliers | View; authorized create/update/delete |
| Private products | View; authorized create/update/delete; stock read-only |
| Purchase Orders | View/list/retrieve/create/Patch amendment/approve/delivery/cancellation |
| Inventory | Stock increment on full Approved-to-Delivered transition |
| Dashboard | Counts, purchasing commitment, delivered value, stock, recent orders, status distribution |
| Account security | Restricted list and activation/deactivation of eligible ordinary accounts |

The Angular orders page can create orders and request status transitions. It does not expose a Pending-order amendment form, even though `PATCH /api/orders/{id}/` exists in the backend.

## 4. Roles and Permissions

Roles originate from Django Groups and active superuser status. The authoritative application capability set is in `accounts.py`.

| Role/capability | Read private data | Manage catalog | Create/amend orders | Transition orders | Delete records | Account activation |
|---|---:|---:|---:|---:|---:|---:|
| Basic User | No | No | No | No | No | No |
| Purchasing Employee (Buyer) | Yes | Yes | Yes | No | No | No |
| Purchasing Manager (Approver) | Yes | Yes | Yes | Yes | No | No |
| Analyst / Tester (Viewer) | Yes | No | No | No | No | No |
| System Administrator (Admin) | Yes | Yes | Yes | Yes | Yes | Trusted scope |
| Security Administrator | No | No | No | No | No | Delegated scope |
| Active superuser | Yes | Yes | Yes | Yes | Yes | Trusted scope |

Exact role capabilities:

- `Basic User`: no purchasing capability.
- `Purchasing Employee`: `read`, `manage_catalog`, `create_orders`.
- `Purchasing Manager`: `read`, `manage_catalog`, `create_orders`, `transition_orders`.
- `Analyst / Tester`: `read`.
- `Security Administrator`: no purchasing capabilities; can activate eligible ordinary accounts.
- `System Administrator`: all five purchasing capabilities.

A user can belong to multiple roles; capabilities are unioned. Disabled accounts have no capabilities. The system does not establish a named creator or named approver identity. The same authenticated credential can prepare and transition an order.

## 5. Purchase Order Lifecycle

### 5.1 States

The only implemented states are `Pending`, `Approved`, `Delivered` and `Cancelled`.

| From status | Allowed target |
|---|---|
| Pending | Approved or Cancelled |
| Approved | Delivered or Cancelled |
| Delivered | No transition |
| Cancelled | No transition |

There is no `Rejected` status. Cancellation is not a rejection/audit workflow.

### 5.2 Creation

Creation requires:

- an existing supplier;
- at least one item;
- no more than 500 items;
- unique product IDs within the order;
- positive 32-bit integer quantities;
- valid dates;
- an expected delivery date that is null or not before the order date;
- optional unit prices no greater than 99999999.99, nonnegative and limited to two decimal places.

Omitted item price uses the current catalog price. A valid order begins in `Pending`, and the parent/order items are created atomically.

### 5.3 Amendment

Only Pending orders can be amended. Amendment replaces the complete item list, not individual item rows. Existing captured item prices are retained unless explicitly changed in the amendment payload.

The backend supports `PATCH`, but Angular has no amendment form. Frontend edit-only behavior is absent.

### 5.4 Approval

Approval is valid only for a nonempty Pending order. It changes status to `Approved` and does not change stock.

### 5.5 Cancellation

Cancellation is valid for Pending or Approved orders. It changes status to `Cancelled` and does not change stock. There is no cancellation reason or cancellation actor/time field.

### 5.6 Delivery

Delivery is valid only from `Approved`. The service locks the order and products, validates line quantities and integer inventory overflow, increments stock using database expressions, then sets `Delivered`.

Stock increments and status save are committed together. Any failure rolls back stock/status changes. Concurrent delivery is serialized through the order lock and a repeat request conflicts.

## 6. Business Rules and Validations

| Rule | Enforcement |
|---|---|
| Supplier exists | Service foreign-key/reference validation |
| Supplier email nonblank, normalized and unique | Serializer and database constraints |
| Supplier phone and address limits | Serializer and database columns |
| Product exists | Service reference validation |
| Product unit price nonnegative | Serializer and CHECK constraint |
| Product stock cannot be edited through catalog API | Read-only field and strict serializer |
| Order item list nonempty | Serializer/service |
| Maximum 500 items | Serializer |
| Distinct product per order | Service and UNIQUE constraint |
| Quantity positive 32-bit integer | Serializer/service/CHECK |
| Item price nonnegative and decimal-safe | Serializer/service/CHECK |
| Expected delivery is null or after order date | Serializer/service/CHECK |
| Pending-only amendment | Service conflict |
| Pending/Approved cancellation | Transition service |
| Approved-only full delivery | Transition service |
| Terminal Delivered/Cancelled states | Transition service and status CHECK |
| Referenced supplier/product deletion protection | ORM PROTECT and API/database checks |
| Cancelled orders excluded from purchasing/supplier report totals | Report SQL logic |

## 7. Data Model

Business models and the dump confirm four core tables.

### Supplier

| Attribute | Database/ORM definition |
|---|---|
| `supplier_id` | integer primary key, identity |
| `supplier_name` | required varchar(100) |
| `email` | required unique varchar(100) |
| `phone` | optional varchar(20) |
| `address` | optional varchar(255) |

### Product

| Attribute | Database/ORM definition |
|---|---|
| `product_id` | integer primary key, identity |
| `product_name` | required varchar(100) |
| `category` | optional varchar(50) |
| `unit_price` | required numeric(10,2), nonnegative |
| `stock_quantity` | integer, default 0, nonnegative |

### PurchaseOrder

| Attribute | Database/ORM definition |
|---|---|
| `order_id` | integer primary key, identity |
| `supplier_id` | required foreign key to Supplier |
| `order_date` | date, defaults to application local date |
| `status` | varchar(30), Pending/Approved/Delivered/Cancelled |
| `expected_delivery_date` | optional date, not before order date |

### PurchaseOrderItem

| Attribute | Database/ORM definition |
|---|---|
| `item_id` | integer primary key, identity |
| `order_id` | required foreign key to PurchaseOrder |
| `product_id` | required foreign key to Product |
| `quantity` | positive integer |
| `unit_price` | captured purchase price, numeric(10,2), nonnegative |

Relationships:

- Supplier 1-to-many PurchaseOrder;
- PurchaseOrder 1-to-many PurchaseOrderItem;
- Product 1-to-many PurchaseOrderItem;
- the `(order_id, product_id)` pair is unique.

Deletion uses protected relationships. Django and PostgreSQL prevent referenced supplier/product deletion.

## 8. API Overview

All private routes use session authentication and `ReadOrWriteAccess` unless explicitly noted. Public routes do not share private serializers or fields.

### 8.1 Authentication and accounts

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/api/auth/csrf/` | AllowAny | issue CSRF token |
| POST | `/api/auth/register/` | AllowAny, CSRF/throttle | create active Basic User |
| POST | `/api/auth/login/` | AllowAny, CSRF/throttle | establish Django session |
| POST | `/api/auth/logout/` | IsAuthenticated | end session |
| GET | `/api/auth/me/` | IsAuthenticated | current profile/capabilities |
| PATCH | `/api/auth/profile/` | IsAuthenticated | change display name |
| POST | `/api/auth/password/` | IsAuthenticated | change password |

### 8.2 Public catalog

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/api/catalog/products/` | AllowAny | public product id/name/category list |
| GET | `/api/catalog/products/{id}/` | AllowAny | public product retrieve |
| GET | `/api/catalog/categories/` | AllowAny | distinct categories |

No private product price or stock is returned through public catalog endpoints.

### 8.3 Private supplier/product APIs

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/suppliers/`, `/api/suppliers/{id}/` | `read` |
| POST | `/api/suppliers/` | `manage_catalog` |
| PATCH | `/api/suppliers/{id}/` | `manage_catalog` |
| DELETE | `/api/suppliers/{id}/` | `delete_records` |
| GET | `/api/products/`, `/api/products/{id}/` | `read` |
| POST | `/api/products/` | `manage_catalog` |
| PATCH | `/api/products/{id}/` | `manage_catalog` |
| DELETE | `/api/products/{id}/` | `delete_records` |

### 8.4 Purchase Orders

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/orders/` | `read` |
| GET | `/api/orders/{id}/` | `read` |
| POST | `/api/orders/` | `create_orders` |
| PATCH | `/api/orders/{id}/` | `create_orders`, only Pending in service |
| POST | `/api/orders/{id}/approve/` | `transition_orders` |
| POST | `/api/orders/{id}/deliver/` | `transition_orders` |
| POST | `/api/orders/{id}/cancel/` | `transition_orders` |

Status transition endpoints require an empty JSON request body.

### 8.5 Dashboard and security

| Method | Endpoint | Permission |
|---|---|---|
| GET | `/api/access/` | IsAuthenticated |
| GET | `/api/dashboard/` | `read` |
| GET | `/api/analytics/supplier-spending/` | `read` |
| GET | `/api/analytics/order-status/` | `read` |
| GET | `/api/security/accounts/` | Security Administrator or System Administrator |
| PATCH | `/api/security/accounts/{id}/` | Security Administrator or System Administrator |
| GET | `/health/` | AllowAny |

The health view is public and reports service availability; database readiness has a separate Django health endpoint.

## 9. Security and Error Handling

### 9.1 Authentication

The implemented private API authentication is Django session authentication, not bearer authentication. CSRF is explicit for login and registration and enforced for authenticated session writes.

Login is throttled, registration is independently throttled and inactive accounts cannot authenticate normally. Registration always assigns Basic User and explicitly rejects default role configuration when that role has permissions.

### 9.2 Authorization

Server-side `ReadOrWriteAccess` checks capabilities for protected operations. Frontend guards improve navigation but do not replace API enforcement.

### 9.3 Error categories

| HTTP status | Meaning |
|---|---|
| 400 | Invalid serializer, validation or malformed request |
| 401 | Unauthenticated protected request |
| 403 | Authenticated account lacks capability |
| 409 | State conflict, protected reference or constraint conflict |
| 413 | Request body exceeds parser limit |
| 500 | Unexpected server error |
| 503 | Database/setup unavailable |

Database integrity exceptions are mapped to safe field-oriented 400/409 responses. Unexpected failures do not disclose SQL details.

## 10. Backend and Frontend Differences

| Feature | Backend | Angular frontend |
|---|---|---|
| Public product catalog | Implemented with id/name/category only | Implemented public workspace |
| Private supplier/product CRUD | Implemented | Supplier/product pages expose capability-dependent controls |
| Stock write | No direct API stock write | No direct stock-edit control |
| Create order | Implemented | Implemented |
| Amend Pending order | Implemented via PATCH | No amendment UI |
| Approve/deliver/cancel | Implemented action endpoints | Buttons shown by transition capability |
| Dashboard | Implemented API reports | Implemented analytics/home views |
| Account activation | Implemented security API | Account/connection UI exposes for authorized roles |
| Authentication | Django session | Session/CSRF-aware Angular auth |

The frontend models an older `authentication: "shared_bearer_token"` field in `frontend/src/app/core/data/api-contracts.ts`, while the backend access response and authentication implementation return/use Django session authentication. This is a documentation and type-contract inconsistency, not evidence of an implemented bearer mechanism.

## 11. Limitations and Gaps

1. No Pending amendment form in Angular.
2. No named creator/approver audit identity.
3. No rejection status or rejection audit workflow.
4. No partial delivery or individual-line receipt.
5. No cancellation reason or terminal-state audit.
6. No returns or reversal of delivered inventory.
7. No direct stock adjustment use case.
8. No customer/sales order module.
9. No invoice, payment or tax module.
10. Shared credential groups do not establish named personal responsibility.
11. PostgreSQL direct-role behavior is separate from API capabilities and requires deployment verification.
12. Live browser behavior and live database operation are not independently verified by this documentation task.
13. Public and private product representations intentionally differ.

## 12. Documentation Inconsistencies

- The UML actor mapping correctly uses existing role names, but `Purchasing Manager` also has catalog and order-create capabilities according to `accounts.py`, not only approval/delivery.
- `System Administrator` has delete capability; supplier/product delete UI is additionally conditioned on frontend `deleteRecords`.
- `Security Administrator` has no private purchasing read capability, but is modeled separately for account activation.
- `Basic User` is a distinct Django Group and should not be described as a Viewer.
- The use-case spec correctly excludes a Rejected state and Angular amendment UI, but future interface work should not be presented as implemented.
- `docs/bekarys/purchase-order-lifecycle.md` is consistent with service transitions and terminal-state rules.
- `docs/bekarys/business-requirements.md` distinguishes `Amend` as partial because Angular lacks the edit UI; this remains consistent with the implementation.
- The activity diagram's Approver/Admin swimlane is consistent with `transition_orders`; it should not imply named-person separation.
- The use-case diagram's catalog include/update relationships should remain only as implemented create/update services, not generic CRUD assumptions.
- README statements about "manage stock" require clarification: ordinary catalog operations cannot change stock; only delivery changes stock.

## 13. Source Code References

### Models and services

- `backend/apps/purchasing/models.py`: Supplier, Product, PurchaseOrder, PurchaseOrderItem.
- `backend/apps/purchasing/services.py`: date/item validation, atomic creation/amendment, transitions and stock updates.
- `backend/apps/purchasing/api/serializers.py`: strict input fields and order write/read serializers.
- `backend/apps/purchasing/api/fields.py`: strict text/email/address validation.
- `backend/apps/purchasing/api/reports.py`: totals and distribution calculations.

### API and security

- `backend/apps/purchasing/api/urls.py`: private router endpoints.
- `backend/apps/purchasing/api/views.py`: CRUD viewsets, transition actions and dashboard endpoints.
- `backend/apps/purchasing/api/permissions.py`: `ReadOrWriteAccess`.
- `backend/apps/purchasing/api/catalog.py`: public product allowlist.
- `backend/apps/purchasing/auth_views.py`: authentication and account operations.
- `backend/apps/purchasing/security_views.py`: account activation operations.
- `backend/apps/purchasing/accounts.py`: role capabilities and profile output.
- `backend/apps/purchasing/api/exceptions.py`: safe HTTP error mapping.
- `backend/config/urls.py`: top-level route registration.
- `backend/config/settings.py`: session authentication and DRF permission defaults.

### Frontend

- `frontend/src/app/routes.ts`: Angular routes and capability guards.
- `frontend/src/app/pages/public-workspace.ts`: public versus private workspace behavior.
- `frontend/src/app/pages/suppliers.ts`: supplier UI and capability controls.
- `frontend/src/app/pages/products.ts`: product UI, catalog filters and stock display.
- `frontend/src/app/pages/orders.ts`: order create/transition UI.
- `frontend/src/app/pages/orders.html`: order controls and Pending-only edit condition.
- `frontend/src/app/core/data/api-data.service.ts`: API calls and capability refresh.
- `frontend/src/app/core/data/api-contracts.ts`: API response/interface types.
- `frontend/src/app/core/data/models.ts`: statuses and frontend transition matrix.

### Database and existing documentation

- `database/dumps/jedel_group_db.sql`: four-table schema and constraints.
- `database/SCHEMA_REVIEW.md`: reviewed model mapping and constraint summary.
- `docs/bekarys/business-requirements.md`: scope, rules and exclusions.
- `docs/bekarys/purchase-order-lifecycle.md`: verified transition behavior.
- `docs/bekarys/gap-analysis-and-acceptance.md`: implementation gaps and acceptance boundaries.
- `docs/uml/purchase_order_activity.puml`: purchase-order activity diagram.
- `docs/uml/activity_diagram_analysis.md`: activity assumptions and implementation gaps.
- `docs/uml/jedel_group_use_case.puml`: purchasing use-case relationships.
- `docs/uml/use_case_specifications.md`: use-case specifications and permission matrix.
