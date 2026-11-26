# Jedel.Group ERP System Documentation

**Scope:** Purchasing Management  
**Architecture:** Angular, Django REST Framework and PostgreSQL  
**Status:** Implemented system documentation

## 1. Introduction and System Purpose

Jedel.Group ERP is an educational supplier and purchasing system. It provides purchasing users with a catalog of suppliers and products, purchase-order preparation and status management, warehouse-stock updates, dashboards and role-based access.

The documented scope concerns:

- supplier and product records;
- purchase orders and purchase order items;
- purchase-order approval, cancellation and delivery;
- inventory quantities;
- purchasing reports and account security;
- session-based user authentication.

Customer sales, invoicing, payments, partial delivery, returns and an AI Assistant are outside this document.

## 2. System Scope

The system supports two types of catalog access:

- public product browsing, which exposes only product ID, name and category;
- private purchasing workspaces, which expose supplier contact data, product prices and stock, purchase orders and reports to authorized accounts.

The implemented purchasing lifecycle is:

1. a Buyer or authorized user creates a Purchase Order;
2. the ERP stores the order as `Pending`;
3. the order can be amended while it remains `Pending`;
4. an Approver or Administrator approves or cancels the order;
5. an Approved order can be delivered once or cancelled;
6. successful delivery changes the order to `Delivered` and increases stock atomically.

The system does not implement a supplier portal, customer portal, sales-order module, named approval history or Rejected status.

## 3. System Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Angular, TypeScript, HTML, SCSS | Forms, capability-aware navigation, data display and API calls |
| API | Django REST Framework | Authentication, authorization, validation, transaction services and JSON responses |
| Database | PostgreSQL 17 | Suppliers, products, Purchase Orders, items and database constraints |

Angular communicates with the Django API. Django serializers validate request data, permissions authorize operations, services enforce lifecycle rules and PostgreSQL stores the resulting records. The application models map directly to existing unmanaged business tables.

The Django models set `managed = False`; therefore, Django migrations do not create or alter the four purchasing tables. The existing schema is defined and reviewed separately in `database/dumps/jedel_group_db.sql` and `database/SCHEMA_REVIEW.md`.

## 4. System Modules

### 4.1 Authentication and Account Management

The system provides registration, login, logout, current-profile retrieval, profile-name update and password change. It also exposes restricted account activation for designated security administrators.

Relevant implementation:

- `backend/apps/purchasing/auth_views.py`
- `backend/apps/purchasing/account_serializers.py`
- `backend/apps/purchasing/security_views.py`
- `frontend/src/app/auth.ts`

### 4.2 Supplier Management

Authorized users can view suppliers and create or update validated supplier records. System Administrators can delete only suppliers that are not referenced by existing Purchase Orders.

### 4.3 Product and Inventory Management

Authorized catalog users can view, create and update product name, category and unit price. Stock quantity is not writable through catalog APIs or catalog forms.

Stock changes only through successful full receipt of an Approved Purchase Order.

### 4.4 Purchase Order Management

The system provides:

- Purchase Order creation;
- Purchase Order listing and detail retrieval;
- Pending-order amendment through the backend API;
- approval;
- full delivery;
- cancellation.

The Angular orders page can create and transition orders but does not provide an amendment form.

### 4.5 Dashboard and Reporting

Authorized users can view:

- supplier, product and Purchase Order counts;
- purchasing commitment value;
- Delivered-order value;
- order-status distribution;
- current stock units and low-stock products;
- supplier spending based on captured item prices;
- recent Purchase Orders.

`Purchased spending` and purchasing commitments are procurement values, not payment or invoice records.

## 5. User Roles and Permissions

Roles are implemented as Django Groups. A superuser receives every capability, and disabled accounts receive none. Capabilities are combined when a user belongs to multiple groups.

| Role | Read private purchasing data | Manage supplier/product catalog | Create/amend Purchase Orders | Approve/deliver/cancel | Delete records | Account activation |
|---|---:|---:|---:|---:|---:|---:|
| Basic User | No | No | No | No | No | No |
| Purchasing Employee (Buyer) | Yes | Yes | Yes | No | No | No |
| Purchasing Manager (Approver) | Yes | Yes | Yes | Yes | No | No |
| Analyst / Tester (Viewer) | Yes | No | No | No | No | No |
| System Administrator (Admin) | Yes | Yes | Yes | Yes | Yes | Trusted scope |
| Security Administrator | No | No | No | No | No | Delegated scope |

The authoritative capability mapping is in `backend/apps/purchasing/accounts.py`:

- `read`
- `manage_catalog`
- `create_orders`
- `transition_orders`
- `delete_records`

### 5.1 Role Descriptions

**Purchasing Employee**

Can read private purchasing data, maintain supplier and product catalogs, create Purchase Orders and amend eligible Pending orders through the backend.

**Purchasing Manager**

Has all Purchasing Employee capabilities and can approve, cancel and confirm full delivery. A Purchasing Manager is not a separate named approver identity.

**Analyst / Tester**

Has read-only access to private purchasing records and reports. The role cannot create, amend or transition orders and cannot maintain catalogs.

**System Administrator**

Has read, catalog, Purchase Order creation/amendment and transition capabilities. It also has delete capability. Delete operations remain protected by catalog and database constraints.

**Security Administrator**

Has no purchasing data capability by role alone. It can list and activate/deactivate eligible ordinary accounts. It cannot change roles, staff flags or superuser flags through this endpoint.

**Basic User**

Is an authenticated low-privilege role. It receives no private purchasing capability and can use only public catalog and own-account functionality.

## 6. Functional Requirements

### FR-01 Supplier Management

The system shall display supplier records and allow authorized catalog users to create or update valid supplier data. A supplier email shall be valid, normalized and unique at the API level. Referenced suppliers shall not be deleted.

### FR-02 Product Management

The system shall maintain product name, category and unit price. Stock quantity shall be read-only through catalog operations and shall change only when a full Purchase Order delivery succeeds.

### FR-03 Purchase Order Creation

Authorized users shall be able to create a Pending Purchase Order with one existing supplier and one or more valid, distinct product lines.

### FR-04 Purchase Order Amendment

Authorized users shall be able to replace an eligible Pending order's supplier, dates or complete item list through the backend `PATCH` API. The Angular frontend does not expose this operation.

### FR-05 Approval

An authorized transition role shall be able to change a nonempty Pending order to `Approved`. Approval shall not change stock.

### FR-06 Delivery

An authorized transition role shall be able to change an Approved order to `Delivered`. The operation shall increment every product line quantity once and commit stock/status together.

### FR-07 Cancellation

An authorized transition role shall be able to cancel Pending or Approved orders without changing stock.

### FR-08 Read and Reporting

Authorized readers shall be able to view private purchasing records, captured prices, stock information and defined dashboard/report values.

## 7. Business Rules and Validations

### 7.1 Supplier Rules

- supplier name and email are required;
- email is trimmed and normalized to lowercase;
- supplier email uniqueness is checked case-insensitively by the API;
- phone is optional and limited to 20 characters;
- address is optional and limited to 255 characters;
- a supplier referenced by a Purchase Order cannot be deleted.

### 7.2 Product Rules

- product name is required;
- category is optional;
- unit price is nonnegative and limited to two decimal places;
- stock quantity is nonnegative;
- stock cannot be submitted through create/update catalog operations;
- a product with stock or purchase-order references cannot be deleted.

### 7.3 Purchase Order Rules

- the order references an existing supplier;
- at least one order item is required;
- item lists are limited to 500 entries;
- a product can appear only once in an order;
- quantities must be positive 32-bit integers;
- item prices are nonnegative, decimal-safe values;
- expected delivery date is optional and cannot precede order date;
- captured item prices remain associated with the order if catalog prices change;
- omitted item price uses the current catalog price.

### 7.4 Status Rules

| Current status | Allowed operation | Result |
|---|---|---|
| Pending | Approve | Approved |
| Pending | Cancel | Cancelled |
| Approved | Confirm full delivery | Delivered |
| Approved | Cancel | Cancelled |
| Delivered | Approve/deliver/cancel | Rejected |
| Cancelled | Approve/deliver/cancel | Rejected |

The status transition matrix is implemented in `backend/apps/purchasing/services.py`. The frontend mirrors it in `frontend/src/app/core/data/models.ts`.

There is no separate rejection state or action.

## 8. Purchase Order Lifecycle

### 8.1 Creation

The frontend submits supplier ID, order date, optional delivery date and item product/quantity pairs. The backend validates references and values before creating the parent and items in one transaction.

A successful creation creates:

- `PurchaseOrder.status = Pending`;
- Purchase Order items for each submitted product;
- captured item unit prices.

No inventory quantity is changed during creation.

### 8.2 Amendment

Only a Pending order can be amended. Amendment is an atomic operation that replaces the complete item list and updates supplier/delivery fields. A delivered or cancelled order cannot be reopened or amended.

### 8.3 Approval

Approval requires an authorized caller and a nonempty Pending order. Successful approval sets status to `Approved`; stock remains unchanged.

### 8.4 Cancellation

Cancellation requires transition permission and a Pending or Approved order. Successful cancellation sets status to `Cancelled` and leaves stock unchanged.

### 8.5 Delivery

Delivery requires:

- transition permission;
- status `Approved`;
- at least one order item;
- valid product references and quantities;
- inventory values that do not overflow the 32-bit integer limit.

The system increments stock and saves `Delivered` inside one transaction. Failed stock writes or status writes roll back the operation. A repeated concurrent delivery request is rejected because it no longer starts from `Approved`.

## 9. Database Design and Entity Relationships

### 9.1 Core Tables

| Table | Primary attributes | Key relationships |
|---|---|---|
| `suppliers` | supplier ID, name, email, phone, address | referenced by Purchase Orders |
| `products` | product ID, name, category, unit price, stock quantity | referenced by Purchase Order items |
| `purchase_orders` | order ID, supplier, date, status, expected delivery date | contains items |
| `purchase_order_items` | item ID, order, product, quantity, captured unit price | links each order to a product |

### 9.2 Relationships

- Supplier has zero or more Purchase Orders.
- Purchase Order belongs to one Supplier.
- Purchase Order has one or more items.
- Purchase Order Item belongs to one Purchase Order.
- Purchase Order Item references one Product.
- Product has zero or more Purchase Order items.

Foreign-key deletion uses protective behavior. The combination of `order_id` and `product_id` is unique.

### 9.3 Constraints

The schema and models include constraints for:

- positive item quantities;
- nonnegative product stock;
- nonnegative unit prices;
- valid delivery dates;
- allowed Purchase Order statuses;
- unique suppliers by email;
- unique product-line combinations.

The Django models are unmanaged mappings rather than migration-owned schema definitions.

## 10. API Documentation

The canonical private business API base is `/api/`. `/api/v1/` is a legacy alias. Authentication uses `/api/auth/`.

### 10.1 Authentication APIs

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/auth/csrf/` | Anonymous |
| POST | `/api/auth/register/` | Anonymous, throttled |
| POST | `/api/auth/login/` | Anonymous, throttled |
| POST | `/api/auth/logout/` | Authenticated |
| GET | `/api/auth/me/` | Authenticated |
| PATCH | `/api/auth/profile/` | Authenticated |
| POST | `/api/auth/password/` | Authenticated |

### 10.2 Public Catalog APIs

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/catalog/products/` | Public |
| GET | `/api/catalog/products/{id}/` | Public |
| GET | `/api/catalog/categories/` | Public |

Public responses expose only product ID, name and category.

### 10.3 Supplier APIs

| Method | Endpoint | Capability |
|---|---|---|
| GET | `/api/suppliers/` | `read` |
| GET | `/api/suppliers/{id}/` | `read` |
| POST | `/api/suppliers/` | `manage_catalog` |
| PATCH | `/api/suppliers/{id}/` | `manage_catalog` |
| DELETE | `/api/suppliers/{id}/` | `delete_records` |

### 10.4 Product APIs

| Method | Endpoint | Capability |
|---|---|---|
| GET | `/api/products/` | `read` |
| GET | `/api/products/{id}/` | `read` |
| POST | `/api/products/` | `manage_catalog` |
| PATCH | `/api/products/{id}/` | `manage_catalog` |
| DELETE | `/api/products/{id}/` | `delete_records` |

Catalog payloads do not accept `stock_quantity` as an editable field.

### 10.5 Purchase Order APIs

| Method | Endpoint | Capability |
|---|---|---|
| GET | `/api/orders/` | `read` |
| GET | `/api/orders/{id}/` | `read` |
| POST | `/api/orders/` | `create_orders` |
| PATCH | `/api/orders/{id}/` | `create_orders` |
| POST | `/api/orders/{id}/approve/` | `transition_orders` |
| POST | `/api/orders/{id}/deliver/` | `transition_orders` |
| POST | `/api/orders/{id}/cancel/` | `transition_orders` |

The three transition endpoints accept an empty JSON body. Direct status changes are not accepted by order write serializers.

### 10.6 Dashboard and Security APIs

| Method | Endpoint | Access/capability |
|---|---|---|
| GET | `/api/dashboard/` | `read` |
| GET | `/api/analytics/supplier-spending/` | `read` |
| GET | `/api/analytics/order-status/` | `read` |
| GET | `/api/access/` | Authenticated |
| GET | `/api/security/accounts/` | Security or System Administrator |
| PATCH | `/api/security/accounts/{id}/` | Security or System Administrator |

## 11. Authentication and Security

The private API uses Django session authentication and CSRF protection. Login and registration obtain CSRF tokens and enforce independent IP throttles. Registration creates an active Basic User and no privileged role.

The backend permission class `ReadOrWriteAccess`:

- denies unauthenticated requests;
- allows safe methods only for `read`;
- applies `manage_catalog` to supplier/product writes;
- applies `create_orders` to Purchase Order creation and amendment;
- applies `transition_orders` to approve/deliver/cancel;
- applies `delete_records` to record deletion.

Frontend route guards improve usability but do not replace server authorization.

The account activation API is separate from role assignment. Delegated security users can activate/deactivate only eligible accounts that meet the implemented eligibility rules. They cannot modify their own account or privileged/security accounts.

## 12. Frontend Functionality

The Angular application provides:

- public product catalog browsing;
- private supplier, product, order and analytics workspaces;
- capability-dependent create/edit/delete controls;
- Purchase Order creation;
- Purchase Order status filtering and detail display;
- approve, deliver and cancel buttons for transition-authorized users;
- login, registration, profile and password operations;
- role-based route guards.

The Angular Orders page exposes no Pending-order edit form. Although the backend supports a `PATCH` amendment operation, the frontend function is not present in the current user interface.

Catalog forms edit only name/category/price or supplier fields. They do not expose stock quantity. Delete buttons are shown only when `delete_records` is available; management buttons are shown only when `manage_catalog` is available.

## 13. Error Handling

| HTTP status | Use |
|---|---|
| 400 | Invalid input or malformed data |
| 401 | Missing or expired session |
| 403 | Authenticated account lacks permission |
| 404 | Missing resource |
| 409 | Invalid lifecycle transition or protected/duplicate constraint |
| 413 | Request body exceeds allowed size |
| 429 | Login or registration throttled |
| 500 | Unexpected server failure |
| 503 | Database or setup unavailable |

Invalid Purchase Order data does not create partial parent/item records. Delivery stock and status updates use atomic transactions; failure rolls back the delivery. Database constraints are mapped to safe validation or conflict responses where possible.

After an ambiguous write response, the caller should refresh the current order state before retrying. A server-confirmed write must not be assumed to have failed solely because a subsequent read refresh failed.

## 14. System Limitations and Known Gaps

- The Angular application has no Pending Purchase Order amendment form.
- The implementation has no named creator/approver audit trail.
- It has no `Rejected` status or rejection record.
- Partial delivery is not implemented.
- Cancellation does not store a reason or actor.
- Delivered inventory has no reversal or return workflow.
- Direct stock adjustment is not exposed.
- Customer sales, invoicing, payments and taxes are outside the purchasing scope.
- PostgreSQL direct-role privileges are separate from API RBAC and are not equivalent to an application role assignment.
- Live browser and live database behavior were not runtime-verified as part of this documentation.

## 15. Traceability to UML Diagrams and Use Cases

| Artifact | Documented behavior |
|---|---|
| `docs/uml/purchase_order_activity.puml` | Creation, validation, Pending amendment, approval, cancellation, delivery and stock update |
| `docs/uml/activity_diagram_analysis.md` | Implemented versus unsupported lifecycle behavior and assumptions |
| `docs/uml/jedel_group_use_case.puml` | Actors, system boundary, purchasing/catalog/inventory use cases |
| `docs/uml/use_case_specifications.md` | Use case preconditions, success scenarios and alternative flows |
| `docs/bekarys/purchase-order-lifecycle.md` | Lifecycle state-transition matrix and technical failure behavior |

The UML documents represent Purchasing Management only. They do not add customer sales or AI functionality.

## 16. Glossary

| Term | Meaning |
|---|---|
| Activity Diagram | UML behavior diagram showing the workflow and decisions of Purchase Order processing |
| Admin | Conceptual label for the `System Administrator` role |
| Approved | Purchase Order state following successful approval |
| Buyer | Conceptual label for the `Purchasing Employee` role |
| Cancelled | Terminal Purchase Order state that does not change inventory |
| Catalogue/Category | Product classification fields used for browsing |
| Delivered | Terminal Purchase Order state after successful full receipt and stock increment |
| Purchase Order | Supplier procurement request containing items and captured prices |
| Purchase Order Item | Product, quantity and captured unit price within an order |
| Pending | Initial Purchase Order state |
| Approver | Conceptual label for the `Purchasing Manager` role |
| Viewer | Conceptual label for the `Analyst / Tester` role |
| RBAC | Role-Based Access Control through Django Groups and server capabilities |
| Stock quantity | Current warehouse inventory units for a Product |
| Transition | Authorized change from one Purchase Order status to another |
| Use Case | UML description of an actor interaction with a system function |

## Source References

- `backend/apps/purchasing/models.py`
- `backend/apps/purchasing/services.py`
- `backend/apps/purchasing/api/serializers.py`
- `backend/apps/purchasing/api/views.py`
- `backend/apps/purchasing/api/permissions.py`
- `backend/apps/purchasing/api/catalog.py`
- `backend/apps/purchasing/accounts.py`
- `backend/apps/purchasing/auth_views.py`
- `backend/apps/purchasing/security_views.py`
- `backend/apps/purchasing/api/exceptions.py`
- `backend/config/urls.py`
- `frontend/src/app/routes.ts`
- `frontend/src/app/pages/orders.ts`
- `frontend/src/app/pages/orders.html`
- `frontend/src/app/pages/products.ts`
- `frontend/src/app/pages/suppliers.ts`
- `frontend/src/app/auth.ts`
- `frontend/src/app/core/data/models.ts`
- `frontend/src/app/core/data/api-data.service.ts`
- `database/dumps/jedel_group_db.sql`
- `database/SCHEMA_REVIEW.md`
