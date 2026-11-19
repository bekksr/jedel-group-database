# Proposed demo order synchronization

Status: implemented for explicitly isolated development databases. Existing databases require an explicit metadata migration and reviewed per-order bindings; no live business database is modified automatically.

## Why an identity registry is needed

The existing four business tables contain no durable demo-order key. Order IDs are generated independently in each database. Supplier, dates, status and line items are ordinary business fields that can be edited; order dates in the current seed depend on the day the database was initialized. A coincidental match on these values would not prove identity. Versioned fixture files cannot by themselves record which local ID was created in each database.

## Proposed isolated-development metadata

Subject to explicit approval, add two Django-managed metadata tables without altering the four business tables:

- `demo_order_binding`: a unique versioned fixture key and a unique nullable foreign key to a local purchase order.
- `demo_order_item_binding`: a unique versioned item key, a reference to its order binding, and a unique nullable foreign key to a local order item.

The foreign keys would use `ON DELETE SET NULL` so a deleted business row leaves a tombstone. A tombstone is reported for review, never automatically recreated. Versioned fixture keys must be permanent and independent of product names, dates and database-generated IDs. No customer, user, credential or contact data belongs in these tables.

Fresh isolated demo initialization would create each order, its lines and their bindings in one PostgreSQL transaction. No delivery transition is replayed; stock remains the opening-inventory snapshot. The sync command would default to preview and require an explicit apply flag, plus the existing `jedel_dev` and isolated-development guards. A transaction-scoped advisory lock and database uniqueness constraints would serialize runs. Conflicting bindings, duplicate products within an order, missing dependencies and deleted rows would be reported without overwriting business records.

Existing bindings are authoritative only for records created by this mechanism or explicitly reviewed and linked by the operator. Existing installations have no bindings. They must not be matched by supplier, date or line contents automatically. Explicit per-record review is required before binding local IDs. An unbound existing order is never presumed to be a demo order. A fixture key with no binding is not automatically recreated during adoption because it may represent a deleted or unbound order. An operator can explicitly record a reviewed-absent original fixture; this is distinct from a tombstone and permits creation only after every original identity has been reviewed.

For an already bound order, existing status, date, line quantities and prices remain unchanged. A new versioned line may be inserted only into a bound Pending order when its identity is known and no line for that product already exists. During explicit legacy binding, an operator may also identify an absent fixture line on a Pending order; this inserts only the new line. Existing lines and tombstones produce conflicts instead of updates. Approved, Delivered and Cancelled orders remain unchanged; changed or missing lines are reported. New versioned historical orders may be inserted with their initial fixture lines as an opening snapshot only under an explicit apply operation, without changing product stock; an adoption run must first resolve all ambiguous legacy order identities.

## Verification required before implementation is complete

Use only temporary isolated PostgreSQL clusters. Verify fresh initialization, exact counts, all foreign keys, concurrent and repeated sync, fixture additions, deletion tombstones, changed fields, duplicate ambiguity, unchanged stock, rollback on error and preservation of IDs. Run the backend and frontend regressions. Migration and data writes to an existing business database, including `jedel_group_db`, remain outside this proposal.
