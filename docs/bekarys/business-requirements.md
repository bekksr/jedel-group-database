# Business Requirements Specification

Owner for analysis/review: Bekarys Toktar. Status: project-derived review draft; implementation attribution remains with the existing team. See [evidence boundaries](README.md) and [traceability](requirements-traceability.md).

## Purpose, objectives and scope

Jedel.Group ERP supports reliable supplier purchasing: maintain catalogs, prepare orders, authorize them, receive goods once, and report purchasing/stock information in KZT. Objectives are to reduce inconsistent order data, prevent duplicate inventory receipts, preserve captured purchase prices and make responsibilities and failures understandable.

Current scope includes suppliers, products, purchase orders and order items; Angular purchasing screens; Django REST operations; existing PostgreSQL constraints; shared API credential roles; and documented PostgreSQL role scripts. The existing database name remains `jedel_group_db`.

Success means each requirement has an implementation/gap classification and acceptance evidence, not merely a screen or README claim. No unsupported completion percentage or performance promise is assigned.

## Stakeholders and responsibilities

| Stakeholder | Business responsibility | Current technical representation |
| --- | --- | --- |
| Purchasing staff | Maintain catalogs and prepare/amend Pending orders | Buyer API capability |
| Purchasing approver/receiving operator | Approve, cancel, confirm full receipt | Approver API capability; approval and receipt are not separate roles |
| Reader | Review purchasing and stock information | Viewer API credential; currently can read contact/price information |
| System administrator | Supported administration and protected deletion | Admin API credential |
| Database/security maintainer | Provision DB access and review deployment privileges | Separate PostgreSQL roles/connection identity; not mapped automatically from bearer credentials |
| Team members | Maintain implementation, tests, documentation and contribution integrity | Individual Git contributions, not application user accounts |
| University evaluator | Assess requirements, process reasoning and evidence | Demonstration/review, no special runtime role |

These are functional responsibilities, not proof of named users or separation of duties. A holder of multiple shared credentials can act in multiple roles. Bekarys formalizes analysis; existing code is not attributed to him by this specification.

## Functional requirements

| ID | Requirement and observable outcome | Current status |
| --- | --- | --- |
| FR-01 | Authorized staff shall create/update valid suppliers; Admin may delete only unreferenced suppliers | IMPLEMENTED |
| FR-02 | Authorized staff shall maintain valid product catalog fields; catalog APIs shall not directly edit stock; protected deletion shall preserve references/inventory | IMPLEMENTED |
| FR-03 | Buyer/Admin shall create a Pending order with one existing supplier and 1–500 valid, distinct product lines in one transaction | IMPLEMENTED |
| FR-04 | Buyer/Admin shall amend supplier, dates or complete item lists only while Pending | PARTIAL: API exists; Angular amendment form absent |
| FR-05 | Approver/Admin shall approve a nonempty Pending order without changing inventory | IMPLEMENTED |
| FR-06 | Approver/Admin shall receive an Approved order in full once; status and stock changes shall commit together | IMPLEMENTED |
| FR-07 | Approver/Admin shall cancel Pending/Approved orders without inventory changes; final orders shall reject further transitions | IMPLEMENTED |
| FR-08 | Authorized readers shall see order details, captured item prices and authoritative totals; catalog price changes shall not rewrite history | IMPLEMENTED |
| FR-09 | Authorized readers shall receive supplier/order/stock aggregates with documented definitions | IMPLEMENTED |
| FR-10 | Protected operations shall enforce current API capabilities independently of frontend visibility | IMPLEMENTED at API; database-role alignment NOT VERIFIED |
| FR-11 | API mode shall report failures and uncertain outcomes without fabricated results, optimistic success or hidden demo fallback | IMPLEMENTED; current live browser behavior NOT VERIFIED |

## Business rules

| ID | Rule | Enforcement boundary |
| --- | --- | --- |
| BR-01 | Newly created API orders start Pending; clients cannot submit status/identity/derived totals | API serializer and service; DB defaults/identity |
| BR-02 | Only Pending orders may be amended; PATCH item lists replace the full list, not individual lines | Atomic amendment service |
| BR-03 | Every order references an existing supplier; every line references an existing product | Service validation and DB FKs |
| BR-04 | Lines are nonempty, at most 500, unique by product, with positive 32-bit integer quantities | API/service; DB uniqueness and positive-quantity CHECK |
| BR-05 | Catalog/item prices are nonnegative, at most 99999999.99 with two decimals; totals use captured price times quantity | Decimal validation/calculation; numeric(10,2)/CHECK |
| BR-06 | Optional expected delivery is null or on/after order date; order_date defaults to local application date when omitted | Serializer/service and DB date CHECK |
| BR-07 | Omitted item price snapshots catalog price. Retained amended lines preserve captured prices unless explicitly repriced while Pending | Existing creation/amendment service |
| BR-08 | Only Approved orders can become Delivered; nonempty lines and stock-overflow safety are preconditions | Locked transition service |
| BR-09 | Receipt increments stock once using database-side updates in the same atomic transaction as Delivered status | Transition service; DB nonnegative stock CHECK is not a receipt state machine |
| BR-10 | Cancellation changes status only; Pending/Approved may cancel, never Delivered/Cancelled | Transition service |
| BR-11 | Delivered/Cancelled are terminal; no repeated action, reopening or direct API status edit | Transition service and strict serializer |
| BR-12 | Historical deliveries must not be replayed or stock automatically reconstructed from them | Existing final-state protection; operational policy |
| BR-13 | Supplier name/email are required nonblank strings; API validates email, trims/lowercases it and checks duplicates case-insensitively | API; DB NOT NULL and case-sensitive UNIQUE only |
| BR-14 | Address is optional: missing POST/null/exact empty string stores NULL; missing PATCH preserves; whitespace-only/non-string input rejects; trimmed text max 255 | API address field and DB varchar length; no external verification |
| BR-15 | Catalog stock starts at zero through the API; referenced suppliers/products cannot be deleted; products with stock cannot be deleted | API views and existing DB references |
| BR-16 | Reporting excludes Cancelled orders from purchasing/supplier values; Pending and Approved commitments remain included | Existing report functions; not payment accounting |

Historical prices are stable against catalog changes, but Pending purchase-price amendments are intentionally supported. Do not misstate this as unconditional price immutability.

## Non-functional requirements

| ID | Requirement | Current evidence / limitation |
| --- | --- | --- |
| NFR-01 | Preserve existing business schema, identity/FK/UNIQUE/NOT NULL/CHECK constraints and live records | Unmanaged models; this contribution changes documentation only |
| NFR-02 | Maintain atomicity and correct receipt behavior under failures/concurrent requests | Atomic service, row locks, F increments; existing rollback/race tests |
| NFR-03 | Protect credentials and enforce server-side authorization with safe errors | Environment credentials, bearer permissions, sanitized exception handling; shared-role identity limitations remain |
| NFR-04 | Make requirements traceable to code/APIs and explicit acceptance evidence | This package; references are not new test executions |
| NFR-05 | Provide English/KZT UI, clear errors, usable states and responsive/keyboard-accessible controls | Existing Angular implementation/tests; actual browser verification outstanding |
| NFR-06 | Make verification reproducible without destructive live tests | Existing guarded isolated PostgreSQL helper; no tests/migrations run for this documentation task |

## Explicit exclusions and future scope

Customer management, sales orders, fulfilment/stock issue, invoicing, payments, tax/discount calculations, partial receipts, returns, reversals, warehouse transfers, named-user accounts and audit/receipt ledgers are not implemented by this contribution. Customer sales is [FUTURE SCOPE](business-processes.md#future-scope--customer-sales), not an additional purchasing requirement. Schema-dependent changes need separate approval before design/implementation. No SQL role scripts are applied here.
