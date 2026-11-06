# Jedel.Group ERP — Business Concept and System Requirements

**Author:** Bekarys Toktar (System Analysis & Requirements)
**Date:** 6 November 2026
**Status:** DRAFT for team review. Nothing in this document has been applied to the code or to `jedel_group_db`.

## 1. Purpose and scope

This document describes the business concept "a supplier can find a customer and vice versa", lists the functional and non-functional requirements for it, and proposes the smallest set of additions to the existing system. It is a proposal: under [database/MIGRATION_PLAN.md](../database/MIGRATION_PLAN.md) any change to the existing database needs a separate review and explicit team approval.

**Assumption to confirm:** Jedel.Group acts as an intermediary. Customers place orders, suppliers fulfil them, and Jedel.Group staff approve and track the orders. A marketplace where suppliers and customers deal directly would need a different design (see section 9).

## 2. Current state of the system (verified from the repository)

- Stack: Angular frontend, Django REST Framework backend, PostgreSQL database `jedel_group_db`.
- Tables: `suppliers`, `products`, `purchase_orders`, `purchase_order_items`. Django models are unmanaged (`managed = False`).
- Order statuses: Pending → Approved → Delivered, with Cancelled possible from Pending or Approved. Delivery increases product stock atomically and cannot be repeated.
- Access: shared bearer tokens with four roles (viewer, buyer, approver, admin). These are not named user accounts.
- Data validation (Amir): unique email, NOT NULL rules, optional address, non-negative prices and quantities, 78 passing tests on a disposable PostgreSQL instance.

**Gaps relevant to this concept:**

- There is no customer entity: orders belong to a supplier only.
- Products have no link to a supplier. A supplier is attached to an order, not to a product, so a supplier cannot yet "publish" its own catalog.
- There are no user accounts, registration or login.
- There is no history of who changed what (audit trail).

## 3. Business concept

### 3.1 Actors

| Actor | Description |
| --- | --- |
| Supplier | A company that offers products and fulfils orders. |
| Customer | A company or person that browses suppliers and products and places orders. |
| Manager / Approver | Jedel.Group staff who approve, deliver or cancel orders. |
| Administrator | Manages users, roles and reference data. |

### 3.2 Main process

1. A supplier registers and publishes the products it offers, with prices.
2. A customer registers and browses suppliers and detailed product pages.
3. The customer selects a supplier and places an order with one or more products.
4. The manager reviews the order and approves or cancels it.
5. The supplier fulfils an approved order; on delivery the stock is updated automatically (existing behavior).
6. The customer and the supplier can each see the status of their own orders.

"Supplier finds customer and vice versa" is covered by: customers discovering suppliers through the catalog (steps 2–3) and suppliers seeing incoming orders and customer contact details for their own orders (step 6).

## 4. Functional requirements

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-01 | Manage suppliers (create, view, edit, delete unreferenced). | Must | Exists |
| FR-02 | Manage products and read stock quantities. | Must | Exists |
| FR-03 | Create purchase orders with several items; item prices are snapshots. | Must | Exists |
| FR-04 | Order status workflow with atomic stock update on delivery. | Must | Exists |
| FR-05 | Role-based access (viewer, buyer, approver, admin). | Must | Exists (shared tokens) |
| FR-06 | Register and manage customers (name, unique email, phone, optional address). | Must | New |
| FR-07 | Link every order to a customer. | Must | New |
| FR-08 | Link products to the supplier that offers them, with a supplier-specific price. | Must | New |
| FR-09 | Customer can browse suppliers and product details. | Must | New (frontend: Aslan) |
| FR-10 | Customer can place an order and track its status. | Must | New |
| FR-11 | Supplier can view orders addressed to it. | Should | New |
| FR-12 | Named user accounts with registration and login, mapped to roles. | Should | New |
| FR-13 | Audit history of order and status changes. | Could | New |

## 5. Non-functional requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-01 | Data integrity | Database constraints (PK, FK, UNIQUE, NOT NULL, CHECK) remain the final authority; new tables follow the same conventions. |
| NFR-02 | Validation | New inputs follow the existing policy: trimmed strings, valid email, non-negative amounts, sanitized HTTP 400 errors. |
| NFR-03 | Security | Server-side role enforcement regardless of what the frontend shows; no credentials in source code or the Angular bundle; customers see only their own orders, suppliers only orders addressed to them. |
| NFR-04 | Consistency | Order creation and status changes stay atomic (all or nothing). |
| NFR-05 | Compatibility | Existing endpoints, tables and the 78 existing tests must keep working. Changes are additive only. |
| NFR-06 | Testability | Every new rule has an automated test on a disposable PostgreSQL database, never on `jedel_group_db`. |
| NFR-07 | Usability | Customer pages are usable on desktop and mobile browsers and show clear error messages. |
| NFR-08 | Maintainability | Changes go through feature branches and pull requests; documentation is updated together with the code. |

## 6. Proposed additions to the data model (pending approval)

These are proposals only. They follow the additive approach required by the migration policy: no replacement of existing business tables.

| Change | Purpose |
| --- | --- |
| New table `customers` (customer_id, customer_name, email UNIQUE, phone, address) | FR-06 |
| New nullable column `customer_id` on `purchase_orders` (FK to `customers`) | FR-07. Nullable so existing orders stay valid. This alters an existing table and needs explicit review. |
| New table `supplier_products` (supplier_id, product_id, supplier_price, UNIQUE(supplier_id, product_id)) | FR-08 |
| User accounts linked to a supplier or a customer, using Django auth tables | FR-12; see item 3 of the migration policy |

## 7. How this affects the team's tasks

| Member | Task from the plan | Dependency on this concept |
| --- | --- | --- |
| Amir | Validation, backend | New endpoints and validation for customers and supplier products. |
| Aslan | Frontend: registration, ordering, product details, supplier choice | Needs FR-06, FR-08, FR-09, FR-10 to exist in the API. |
| Yerbolat | Roles: administrator, manager, employees; test all of them | Roles must map to the actors in section 3.1. |
| Kamshat | Test scenarios, find errors, e.g. data = null | Test cases for each new requirement. |
| Bekarys | GitHub, system analysis, business concept | This document; repository workflow. |

## 8. Rollout plan

1. Team reviews this document and answers the open questions below.
2. Agree on one schema owner and confirm the final tables (migration policy, steps 1–2).
3. Prepare the additive schema plan and review the generated SQL (steps 3, 5).
4. Implement and test on a disposable PostgreSQL database first.
5. Back up `jedel_group_db`, verify the restore, and obtain explicit approval before applying anything to it (step 6).
6. Merge through a pull request after the tests pass.

## 9. Open questions

1. Is Jedel.Group an intermediary (assumed here) or a direct marketplace between suppliers and customers?
2. Does a customer order from one supplier per order (as the current model implies), or from several?
3. Who owns the database schema and applies approved changes?
4. Is named login required in this semester's scope, or are shared role tokens acceptable for the demonstration?
5. Is the supplier contact data in the SQL dump confirmed as approved educational data before the repository is shared further?
