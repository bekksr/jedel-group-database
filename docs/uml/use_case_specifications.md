# Jedel.Group ERP Use Case Specifications

## Scope and actor mapping

This specification describes the current purchasing scope. The implementation names application roles differently from the conceptual stakeholder labels:

| Diagram actor | Current implementation role/capability |
|---|---|
| System Administrator (Admin) | `System Administrator` group or active superuser |
| Purchasing Employee (Buyer) | `Purchasing Employee` group |
| Purchasing Manager (Approver) | `Purchasing Manager` group |
| Analyst / Tester (Viewer) | `Analyst / Tester` group |
| Security Administrator | `Security Administrator` group |
| Basic User | `Basic User` or unassigned authenticated account |

The same credential can hold multiple groups. The implementation does not enforce named creator/approver identity or separation of duties.

## Verified permission mapping

| Capability | Basic User | Purchasing Employee (Buyer) | Purchasing Manager (Approver) | Analyst / Tester (Viewer) | System Administrator (Admin) | Security Administrator |
|---|---:|---:|---:|---:|---:|---:|
| Read private purchasing data | No | Yes | Yes | Yes | Yes | No |
| Manage suppliers | No | Yes | Yes | No | Yes | No |
| Manage products | No | Yes | Yes | No | Yes | No |
| Create purchase orders | No | Yes | Yes | No | Yes | No |
| Amend Pending purchase orders | No | Yes | Yes | No | Yes | No |
| Approve purchase orders | No | No | Yes | No | Yes | No |
| Cancel purchase orders | No | No | Yes | No | Yes | No |
| Confirm full delivery | No | No | Yes | No | Yes | No |
| Manage eligible account activation | No | No | No | No | Yes, trusted scope | Yes, delegated scope |

The mapping comes from `ROLES` and `ReadOrWriteAccess`. A protected mutation is also blocked by the server even if hidden from the frontend. Basic User is a distinct named application role and receives no purchasing capability.

Authorization is a cross-cutting permission check performed for every protected business operation. It is not modeled as a mandatory login step.

## UC-AUTH-01 Authenticate User

1. **Use Case ID:** UC-AUTH-01
2. **Use Case Name:** Authenticate User
3. **Primary Actor:** Any authenticated ERP user
4. **Preconditions:** The account exists and is active.
5. **Main Success Scenario:** The user logs in through the session authentication flow; the server creates an authenticated Django session and returns access profile information.
6. **Alternative Flows:** Invalid credentials are rejected; inactive accounts receive no application capabilities.
7. **Postconditions:** The user may call protected endpoints permitted by server-side capabilities.
8. **Related Business Rules:** Authentication and authorization are separate. Frontend visibility does not replace backend permission checks.

## UC-CAT-01 Manage Supplier Information

1. **Use Case ID:** UC-CAT-01
2. **Use Case Name:** Manage Supplier Information
3. **Primary Actor:** Purchasing Employee (Buyer), Purchasing Manager or System Administrator
4. **Preconditions:** The actor is authenticated and has `manage_catalog`.
5. **Main Success Scenario:** The actor creates or updates a supplier using validated name, email, phone and optional address fields. A valid request is persisted.
6. **Alternative Flows:** Invalid or duplicate email input returns 400. The System Administrator may delete only an unreferenced supplier; an invalid deletion is rejected.
7. **Postconditions:** Valid supplier data is available to authorized purchasing users.
8. **Related Business Rules:** Supplier email is normalized and unique checks are case-insensitive at the API level. Referenced suppliers are protected.

## UC-CAT-02 Manage Product Information

1. **Use Case ID:** UC-CAT-02
2. **Use Case Name:** Manage Product Information
3. **Primary Actor:** Purchasing Employee (Buyer), Purchasing Manager or System Administrator
4. **Preconditions:** The actor is authenticated and has `manage_catalog`.
5. **Main Success Scenario:** The actor creates or updates product name, category and unit price.
6. **Alternative Flows:** Negative prices or stock writes are rejected. Product deletion is rejected while stock is positive or the product is referenced.
7. **Postconditions:** The catalog is updated; stock quantity is unchanged unless delivery processing performs an inventory receipt.
8. **Related Business Rules:** Stock is read-only through catalog operations. Direct catalog edits cannot overwrite concurrent receipt stock.

## UC-PO-01 Create Purchase Order

1. **Use Case ID:** UC-PO-01
2. **Use Case Name:** Create Purchase Order
3. **Primary Actor:** Purchasing Employee (Buyer)
4. **Preconditions:** The actor has `create_orders`; an existing supplier and existing products are available.
5. **Main Success Scenario:** The Buyer selects a supplier, adds 1–500 distinct product lines, enters positive quantities and valid dates, then submits the order. Validation succeeds; the parent order and items commit in one transaction with status `Pending`.
6. **Alternative Flows:** Invalid supplier, dates, duplicate products or quantities return 400 and no partial order. Insufficient capability returns 403.
7. **Postconditions:** A Pending order and captured item prices are persisted.
8. **Related Business Rules:** Expected delivery is null or not earlier than order date. Unit prices and quantities use server-side limits. Status is assigned by the service, not by the client.

### Mandatory included use cases

- **UC-PO-02 Select Existing Supplier**
- **UC-PO-03 Add Products and Quantities**
- **UC-PO-04 Validate Purchase Order**

## UC-PO-05 Amend Pending Purchase Order

1. **Use Case ID:** UC-PO-05
2. **Use Case Name:** Amend Pending Purchase Order
3. **Primary Actor:** Purchasing Employee (Buyer)
4. **Preconditions:** The actor has `create_orders`, and the order status is `Pending`.
5. **Main Success Scenario:** The actor submits a valid PATCH for supplier, dates or the complete item list. The amendment commits atomically and retains `Pending`.
6. **Alternative Flows:** Invalid data returns 400; amendment of Delivered or Cancelled orders returns 409.
7. **Postconditions:** The Pending order reflects the approved amendment.
8. **Related Business Rules:** Only Pending orders may be amended. Captured prices are retained for unchanged lines unless explicitly revised.

> Current Angular UI limitation: the backend amendment API exists, but the current Orders page does not expose an amendment form.

## UC-PO-06 Approve Purchase Order

1. **Use Case ID:** UC-PO-06
2. **Use Case Name:** Approve Purchase Order
3. **Primary Actor:** Purchasing Manager (Approver)
4. **Preconditions:** The actor has `transition_orders`; the order is Pending and contains at least one item.
5. **Main Success Scenario:** The actor requests approval. The server atomically changes status to `Approved` without changing inventory.
6. **Alternative Flows:** Missing capability returns 403. Invalid status or an empty order returns 409. Approval does not proceed to delivery.
7. **Postconditions:** The order is Approved.
8. **Related Business Rules:** Approval does not receive goods or create an approval audit record.

## UC-PO-07 Cancel Purchase Order

1. **Use Case ID:** UC-PO-07
2. **Use Case Name:** Cancel Purchase Order
3. **Primary Actor:** Purchasing Manager (Approver)
4. **Preconditions:** The actor has `transition_orders`; the order is Pending or Approved.
5. **Main Success Scenario:** The actor requests cancellation. Status becomes `Cancelled`; stock is unchanged.
6. **Alternative Flows:** Missing capability returns 403. Cancelling a Delivered or already Cancelled order returns 409.
7. **Postconditions:** The order is terminally Cancelled.
8. **Related Business Rules:** Cancellation has no reason or actor-audit fields in the current schema.

## UC-PO-08 Confirm Full Delivery

1. **Use Case ID:** UC-PO-08
2. **Use Case Name:** Confirm Full Delivery
3. **Primary Actor:** Purchasing Manager (Approver)
4. **Preconditions:** The actor has `transition_orders`; the order is Approved and contains valid items.
5. **Main Success Scenario:** The actor confirms full delivery. The system atomically increments each captured product quantity and changes status to `Delivered`.
6. **Alternative Flows:** Missing capability returns 403. Wrong status, invalid lines or stock overflow returns 409. A concurrent repeat is rejected. Any stock/status write failure rolls back the delivery.
7. **Postconditions:** The order is Delivered and stock is increased exactly once.
8. **Related Business Rules:** Only Approved-to-Delivered and full receipt are implemented. Partial delivery, returns and reversals do not exist.

### Mandatory included use case

- **UC-INV-02 Update Product Stock:** On successful delivery, the ERP increases each product's stock quantity in the same atomic transaction that sets the order status to `Delivered`. The use case is not exposed as a direct catalog stock-edit operation.

## UC-INV-01 View Inventory and Purchasing Information

1. **Use Case ID:** UC-INV-01
2. **Use Case Name:** View Inventory and Purchasing Information
3. **Primary Actor:** Any authorized reader: Buyer, Approver, Viewer or Admin
4. **Preconditions:** The actor is authenticated and has private purchasing read capability.
5. **Main Success Scenario:** The actor views products, current stock and dashboard totals.
6. **Alternative Flows:** Unauthorized actors cannot view private purchasing data. Catalog writes cannot directly mutate stock.
7. **Postconditions:** The actor receives current inventory and reporting information.
8. **Related Business Rules:** Stock changes only through successful full delivery. Low-stock thresholds are report parameters, not automatic purchase actions. No separate autonomous inventory-monitoring use case is implemented.

## UC-SEC-01 Manage Eligible Account Activation

1. **Use Case ID:** UC-SEC-01
2. **Use Case Name:** Manage Eligible Account Activation
3. **Primary Actor:** Security Administrator or System Administrator
4. **Preconditions:** The administrator is authenticated and authorized.
5. **Main Success Scenario:** An eligible ordinary account is activated or deactivated through the dedicated security API.
6. **Alternative Flows:** Privileged accounts, staff/superuser accounts and the current administrator cannot be modified. Invalid requests return 400 or 403.
7. **Postconditions:** Only eligible account activation changes.
8. **Related Business Rules:** Role assignment is not exposed through public profile or activation APIs. Role provisioning is a trusted setup/admin function.

## Scope exclusions and proposed requirements

The following items are not modeled as implemented use cases:

- customer/sales order management;
- supplier portal or direct supplier login;
- named Buyer/Approver audit identity;
- rejection of a Purchase Order with a `Rejected` state;
- partial or individual-line delivery;
- direct product stock editing;
- payment, invoice or tax use cases;
- role assignment through the public or activation API.

Purchasing role names and formal stakeholder names are mapped only for analysis. If the team introduces named users or separate approval/receipt duties, that is a proposed requirement requiring separate authorization and schema review.
