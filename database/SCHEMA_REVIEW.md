# PostgreSQL schema review

Source: `dumps/jedel_group_db.sql`, dumped from PostgreSQL 17.6. The four mappings in `backend/apps/purchasing/models.py` are manually reviewed and `managed=False`.

| Table | Primary key / identity | Other constraints |
| --- | --- | --- |
| suppliers | supplier_id integer GENERATED ALWAYS | suppliers_email_key UNIQUE(email) |
| products | product_id integer GENERATED ALWAYS | products_unit_price_check >= 0; products_stock_quantity_check >= 0 |
| purchase_orders | order_id integer GENERATED ALWAYS | fk_purchase_order_supplier; chk_delivery_date; purchase_orders_status_check |
| purchase_order_items | item_id integer GENERATED ALWAYS | fk_item_order; fk_item_product; uq_order_product; quantity > 0; unit_price >= 0 |

IDs map to AutoField with explicit primary keys. Existing identity sequences and their values are untouched. FK column names are explicit; ORM PROTECT prevents accidental related deletions and matches the database's non-cascading FK behavior. Nullable category/phone/address/delivery date and numeric(10,2) prices are preserved. Existing constraints are described in model metadata for review, not installed through migrations.

## Read-only verification before deployment

An initial attempt without credentials failed. A later authenticated read-only inspection succeeded with both psql and Django and checked actual columns, identity/nullability, constraints and trigger presence; see [Amir's report](../docs/amir-data-validation-and-stock-updates.md). It found no non-internal triggers on the four business tables. The pre-push audit did not have credentials to repeat those live queries, so its fresh database verification is limited to the isolated dump-derived schema. Do not assume a service readiness probe verifies schema, grants or credentials.

After securely setting database credentials, inspect without redirecting into existing source files:

```powershell
cd backend
& .venv/Scripts/python.exe manage.py inspectdb suppliers products purchase_orders purchase_order_items
```

`inspectdb` reads schema metadata. Its output is only a starting point; compare IDs, column names, nullability, decimals, constraints, and FK deletion behavior manually. Isolated tests run inspectdb against the dump-derived schema but cannot verify live drift.

Alternatively execute this in an authenticated SQL session:

```sql
BEGIN READ ONLY;
SELECT current_database(), current_user;
SELECT table_name, column_name, data_type, is_nullable, column_default,
       is_identity, identity_generation
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('suppliers','products','purchase_orders','purchase_order_items')
ORDER BY table_name, ordinal_position;
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('public.suppliers'::regclass, 'public.products'::regclass,
                  'public.purchase_orders'::regclass, 'public.purchase_order_items'::regclass);
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';
SELECT event_object_table, trigger_name, action_statement
FROM information_schema.triggers WHERE trigger_schema = 'public';
ROLLBACK;
```

Confirm especially that no live stock trigger would duplicate the API's delivery increments. If live columns, constraints, or triggers differ, stop integration and review the mappings and inventory policy; do not repair the schema automatically.
