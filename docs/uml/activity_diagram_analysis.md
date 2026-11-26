# Purchase Order Activity Diagram Analysis

## Scope

This document accompanies `purchase_order_activity.puml`. It describes the purchase order lifecycle verified against the current Django models, services, API, frontend and role configuration.

## Quality review update

The final diagram was reviewed and refined to make control-flow decisions explicit:

- authentication failure is separate from authorization failure;
- invalid submission and amendment data are rejected before commit;
- a Buyer may retry a corrected submission;
- approval and cancellation are separate decisions with explicit success and failure branches;
- cancellation is terminal and does not continue to delivery;
- invalid approval or cancellation returns a conflict and ends the transition attempt;
- delivery is attempted only after successful approval;
- unauthorized delivery and invalid delivery state are separate terminal failures;
- successful delivery and stock update are shown as a single committed outcome.

## Current implementation

The implemented order states are `Pending`, `Approved`, `Delivered` and `Cancelled`.

The normal lifecycle is:

1. An authenticated user with `create_orders` creates an order.
2. The ERP validates the supplier, order date, expected delivery date, product references and item quantities.
3. A valid order is committed atomically with at least one item and starts in `Pending`.
4. The application permits a Pending order to be amended through `PATCH /api/orders/{id}/`.
5. A user with `transition_orders` approves or cancels the order.
6. An Approved order may be fully delivered or cancelled.
7. Full delivery atomically increments captured product quantities and changes the order to `Delivered`.

## UML interpretation

- **Buyer / Purchasing Employee** represents the role that prepares and creates purchase orders.
- **Approver / Purchasing Manager or Admin** represents the only application roles that have `transition_orders`.
- **ERP System** represents Angular validation, Django serializers/services and PostgreSQL transaction behavior.
- **Initial and final nodes** mark the start and terminal workflow outcomes.
- Decision nodes cover authentication, authorization, validation, amendment, approval/cancellation and delivery success.
- Cancelled and Delivered are terminal states; the current implementation does not reopen or reverse them.

## Implemented amendment distinction

The backend supports Pending order amendment through `PATCH /api/orders/{id}/`. The current Angular orders page provides no amendment form, although the gap analysis identifies an optional future UI. The diagram therefore uses the decision "Amend before approval? [Yes - API available]" to document actual backend behavior without implying that the browser UI currently exposes it.

## Unsupported or absent requirements

- There is no `Rejected` status and no reject API action.
- Cancellation is the implemented alternative to approval; it does not represent rejection with a separate audit state.
- There is no partial delivery.
- There is no delivery receipt ledger, approval history, cancellation reason or named creator/approver audit trail.
- There is no direct stock adjustment in the purchase order workflow. Stock changes only occur through successful full delivery.
- There is no return or reversal operation.
- The same authorized credential may approve and deliver an order; the implementation does not separate named employees or require a second approver.
- Angular amendment UI is not implemented.
- The live browser and live database are outside the scope of this documentation artifact.

## Failure behavior

Create and amendment validation is checked before any invalid order or item data is committed. Invalid data returns the validation error to the Buyer, who may correct it and resubmit.

Authentication and authorization are separate outcomes:

- unauthenticated requests are rejected with HTTP 401;
- authenticated callers without the required capability are rejected with HTTP 403;
- a caller with transition permission receives HTTP 409 when the requested status transition or delivery precondition is invalid.

Approval and cancellation fail without changing state. Approval only succeeds for a nonempty Pending order. Cancellation only succeeds for a Pending or Approved order. Successful cancellation ends the process and never proceeds to delivery.

Delivery is attempted only after successful approval and only when the order is still Approved and contains valid lines. Successful full delivery and inventory increase are committed together. A stock or status failure rolls back the delivery. An ambiguous network response after a server commit requires refreshing the order before retrying.

## Technical implementation boundaries

The primary diagram intentionally keeps database details concise. The implementation uses:

- atomic create, amendment and transition transactions;
- row locks for the order and consistently ordered product locks;
- guarded database stock increments;
- rollback for failed delivery writes;
- conflict protection against repeated or racing delivery requests.

These technical details support the diagram's validation, failure and inventory branches but are documented as implementation evidence rather than exposed as separate business decisions.

## Assumptions and business questions

The following decisions require team confirmation:

1. Should "Buyer" be a named role, or should the existing Purchasing Employee role remain the preparation role?
2. Should a second approver be required, or is one Purchasing Manager/Superuser/Administrator acceptable?
3. Should cancelled orders require a recorded reason and actor?
4. Should a separate `Rejected` status replace or supplement cancellation for pending orders?
5. Is full receipt the correct physical operation, or should partial delivery be supported by a future schema change?
6. Should Pending amendment be added to the Angular UI?
7. Should direct PostgreSQL privileges continue to allow operations outside the API lifecycle safeguards, or should SQL role policy match the API policy?

## Source references

- `backend/apps/purchasing/models.py`
- `backend/apps/purchasing/services.py`
- `backend/apps/purchasing/api/views.py`
- `backend/apps/purchasing/api/serializers.py`
- `backend/apps/purchasing/api/permissions.py`
- `backend/apps/purchasing/accounts.py`
- `frontend/src/app/pages/orders.ts`
- `frontend/src/app/pages/orders.html`
- `frontend/src/app/core/data/models.ts`
- `frontend/src/app/core/data/api-data.service.ts`
- `docs/bekarys/purchase-order-lifecycle.md`
