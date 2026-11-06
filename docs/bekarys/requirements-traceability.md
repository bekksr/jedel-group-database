# Requirements traceability matrix

Requirement definitions: [BRS](business-requirements.md). Status meanings and evidence limitations: [index](README.md). All paths below are repository-relative. Exact symbols identify implementation rather than line numbers that may drift. Tests listed here already exist; they are neither created nor rerun by this contribution.

## Source and evidence index

| Key | Exact path / symbols |
| --- | --- |
| M | `backend/apps/purchasing/models.py`: `Supplier`, `Product`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseOrder.total`, `PurchaseOrderItem.line_total` |
| S | `backend/apps/purchasing/services.py`: `validate_dates`, `prepare_items`, `create_order`, `amend_order`, `transition_order` |
| V | `backend/apps/purchasing/api/views.py`: `AtomicResourceViewSet`, `SupplierViewSet`, `ProductViewSet`, `OrderViewSet`, `DashboardView`, `SupplierSpendingView`, `OrderStatusView`, `AccessView` |
| I | `backend/apps/purchasing/api/serializers.py`: `SupplierSerializer`, `ProductSerializer`, `OrderWriteSerializer`, `OrderItemWriteSerializer`, `OrderReadSerializer`, `StrictInputMixin` |
| F | `backend/apps/purchasing/api/fields.py`: `StrictTextField`, `StrictEmailField`, `OptionalAddressField` |
| R | `backend/apps/purchasing/api/reports.py`: `line_expression`, `purchasing_total`, `supplier_spending`, `status_distribution` |
| A | `backend/apps/purchasing/api/authentication.py`: `ApiPrincipal.capabilities`, `EnvironmentTokenAuthentication.authenticate`; `backend/apps/purchasing/api/permissions.py`: `ReadOrWriteAccess.has_permission` |
| U | `backend/apps/purchasing/api/urls.py`: router registration/actions and reporting paths; `backend/config/urls.py`: `/api/` and `/api/v1/` mounts |
| UI | `frontend/src/app/features/purchase-orders/purchase-orders.page.ts`: `PurchaseOrdersPage.save`, `PurchaseOrdersPage.confirmTransition`; `frontend/src/app/core/data/api-data.service.ts`: `ApiDataService.createOrder`, `ApiDataService.transitionOrder`, `ApiDataService.write` |
| W | `frontend/src/app/core/data/workspace-data.service.ts`: `WorkspaceDataService.useDemo`; `frontend/src/app/core/data/models.ts`: `allowedTransitions` |
| B | `backend/apps/purchasing/tests.py`: `BusinessApiTests`, `ConcurrentDeliveryTests`, `ApiAccessTests` |
| T | `backend/apps/purchasing/test_amir_assignment.py`: `AmirValidationAndDeliveryTests`, `AmirConcurrentDeliveryTests`, `AmirFieldValidationTests` |
| P | `backend/apps/purchasing/test_security.py`: `CredentialRoleTests`, `SecurityBoundaryTests` |
| H | `frontend/src/app/core/data/api-data.service.spec.ts`; `frontend/src/app/app.routes.spec.ts` |

## Functional requirements

| Requirement / purpose | Existing implementation | API endpoint | Exact existing test evidence | Status | Remaining gap |
| --- | --- | --- | --- | --- | --- |
| FR-01 Supplier quality | I `SupplierSerializer`; F `OptionalAddressField`; V `SupplierViewSet` | GET/POST `/api/suppliers/`; GET/PATCH/DELETE `/api/suppliers/{id}/` | B `test_supplier_crud_search_sort_and_unique_email`; T `test_T07_whitespace_only_address` | IMPLEMENTED | Current live behavior not verified |
| FR-02 Safe catalogs | I `ProductSerializer`; V `ProductViewSet.perform_destroy` | GET/POST `/api/products/`; GET/PATCH/DELETE `/api/products/{id}/` | B `test_product_crud_filters_price_validation_and_inventory_protection`; T `test_T10_negative_stock_quantity` | IMPLEMENTED | Direct DB writers are a different boundary |
| FR-03 Atomic order creation | S `create_order`, `prepare_items`; I `OrderWriteSerializer` | POST `/api/orders/` | B `test_all_invalid_order_data_is_rejected_without_partial_records`; `test_creation_and_amendment_rollback_after_partial_item_insert` | IMPLEMENTED | No creation idempotency key |
| FR-04 Pending-only amendments | S `amend_order`; V `OrderViewSet.partial_update` | PATCH `/api/orders/{id}/` | B `test_pending_patch_preserves_captured_prices_and_revalidates_full_items` | PARTIAL | Angular amendment form missing |
| FR-05 Authorized approval | S `transition_order`; V `OrderViewSet.approve` | POST `/api/orders/{id}/approve/` | B `test_delivery_status_actions_and_duplicate_protection`; P `test_buyer_can_manage_catalog_and_orders_but_cannot_approve_or_delete` | IMPLEMENTED | No named-person separation of duties |
| FR-06 Exactly-once receipt | S `transition_order`; UI `ApiDataService.transitionOrder` | POST `/api/orders/{id}/deliver/` | T `test_T16_stock_increased_by_correct_quantities`, `test_T19_atomic_rollback_on_simulated_delivery_failure`, `test_T20_concurrent_delivery_does_not_double_count` | IMPLEMENTED | Browser/live receipt not verified; do not replay historical orders |
| FR-07 Controlled cancellation | S `transition_order`; V `OrderViewSet.cancel` | POST `/api/orders/{id}/cancel/` | B `test_cancelled_orders_never_update_inventory`; `test_cancel_racing_delivery_has_one_winner` | IMPLEMENTED | No reason/history record |
| FR-08 Monetary history | M totals/line totals; S `prepare_items`; I `OrderReadSerializer` | GET `/api/orders/`; GET `/api/orders/{id}/` | B `test_order_creation_totals_and_historical_price_snapshot`; `test_pending_patch_preserves_captured_prices_and_revalidates_full_items` | IMPLEMENTED | Draft estimates are not authoritative |
| FR-09 Purchasing insight | R functions; V reporting views | GET `/api/dashboard/`; GET `/api/analytics/supplier-spending/`; GET `/api/analytics/order-status/` | B `test_reports_use_decimal_derived_values_and_all_statuses` | IMPLEMENTED | Values mean commitments, not payments |
| FR-10 Server authorization | A; V `AccessView` | GET `/api/access/`; all protected business endpoints | B `ApiAccessTests.test_all_business_endpoints_deny_anonymous_access_before_database_queries`; P `test_viewer_can_read_but_cannot_write`, `test_approver_can_approve_deliver_and_cancel_but_cannot_edit_catalog` | IMPLEMENTED at API | PostgreSQL deployment/mapping NOT VERIFIED |
| FR-11 Honest outcomes | UI `ApiDataService.write`; W mode delegation; API exceptions | All above integration calls | H `does not fall back to demo mode when database loading fails`; `treats a confirmed write followed by refresh failure as confirmed, not as a request to resubmit` | IMPLEMENTED in source/tests | Live browser outcome NOT VERIFIED |

U defines canonical API routes; `/api/v1/` aliases the same implementation. Status actions accept an empty request body or `{}`, not arbitrary status/item edits. Collection responses are paginated. Stock/identity/derived total fields are not writable through catalog/order input.

## Business rules

| Rule IDs | Implementation / existing evidence | Boundary or gap |
| --- | --- | --- |
| BR-01, BR-02 | S `create_order`, `amend_order`; I `StrictInputMixin`; B Pending amendment test above | New Pending state; no frontend amendment form |
| BR-03, BR-04 | S `prepare_items`; M FK/unique/CHECK metadata; T `test_T11_zero_or_negative_order_item_quantity`, `test_T12_nonexistent_supplier_foreign_key`, `test_T13_duplicate_product_in_one_order` | DB constraints remain final authority; API 500-line cap is not a DB constraint |
| BR-05, BR-07 | S `prepare_items`; M totals; B historical-price and Pending amendment tests | Pending explicit repricing allowed |
| BR-06 | S `validate_dates`; T `test_T14_expected_delivery_before_order_date` | Optional expected date; no future-order-date ban |
| BR-08, BR-09 | S `transition_order`; T T16/T19/T20 exact methods above; B `test_stock_overflow_rejects_delivery_without_partial_updates` | Service-level receipt; no DB stock trigger implied |
| BR-10, BR-11, BR-12 | S `transition_order`; T `test_T17_second_delivery_rejected_without_stock_changes`, `test_T18_cancelled_order_cannot_be_delivered`; B race tests | No reopening/reversal; historical balances not reconstructed |
| BR-13 | I `SupplierSerializer.validate_email`; F strict fields; T `test_T02_duplicate_supplier_email`, `test_T03_missing_supplier_name`, `test_T04_missing_supplier_email`, `test_T05_invalid_email_format` | DB email UNIQUE is case-sensitive; email syntax is API-only |
| BR-14 | F `OptionalAddressField.run_validation`; T `test_T06_valid_optional_address_and_patch_policy`, `test_T07_whitespace_only_address`, `test_T08_address_longer_than_255` | Syntactic validation only |
| BR-15 | V `ProductViewSet.perform_destroy`; M protected relationships; B supplier/product CRUD tests above | Stock read-only API; direct SQL privileges separate |
| BR-16 | R `purchasing_total`, `supplier_spending`; B reporting test above | Cancelled excluded; no payment ledger |

## Non-functional requirements

| Requirement | Source / existing evidence | Status and limitation |
| --- | --- | --- |
| NFR-01 | M unmanaged models; `database/dumps/jedel_group_db.sql`; B `test_database_constraints_and_identity_columns_are_preserved`, `test_inspectdb_confirms_the_manual_legacy_mappings` | IMPLEMENTED schema-preservation design; current live drift NOT VERIFIED |
| NFR-02 | S atomic services; B `test_delivery_rolls_back_product_updates_if_status_save_fails`, `test_two_orders_for_same_products_do_not_lose_updates`; T T19/T20 | IMPLEMENTED; this task does not rerun tests |
| NFR-03 | A; `backend/config/settings.py`; `backend/apps/purchasing/api/exceptions.py::exception_handler`; P `test_default_configuration_fails_closed_without_production_secret` | PARTIAL overall: shared credentials, no individual audit; DB grants NOT VERIFIED |
| NFR-04 | This package's BRS, matrix and acceptance scenarios | IMPLEMENTED analysis artifact; personal/team approval pending |
| NFR-05 | `frontend/src/app/core/layout/app-shell.ts`; shared UI; H `associates invalid controls with visible error text and required semantics` | PARTIAL: source/unit evidence, no current real-browser sign-off |
| NFR-06 | `backend/config/test_runner.py::assert_isolated`; `backend/scripts/test_postgres.py`; P `test_missing_isolation_marker_cannot_start_destructive_database_tests` | IMPLEMENTED test safeguards; helper is not a live role deployment test |

Customer sales has no current API, implementation or passing-test claim and remains future scope. `database/roles.sql` is teammate work to review separately; no bearer-to-DB-role switch is implemented by this documentation.
