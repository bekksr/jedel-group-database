# Gap analysis and acceptance plan

This is a decision and acceptance specification, not a new implementation or test-results report. Scope and status vocabulary are defined in [the BRS](business-requirements.md) and [index](README.md).

## Prioritized gaps

| ID / priority | Observation | Safe next step / proposed owner | Schema impact and status |
| --- | --- | --- | --- |
| GAP-01 / P1 | Requirements/process decisions were scattered rather than formally traceable | Bekarys reviews and maintains this package with team sign-off | None; documentation delivered for review |
| GAP-02 / P1 | API Viewer/Buyer/Approver/Admin differ from SQL admin/manager/employee; bearer roles do not select DB roles | Bekarys and Yerbolat agree a mapping or document intentional separation; verify credentials/grants on an isolated setup | Analysis first; no security change authorized |
| GAP-03 / P1 | `database/roles.sql` gives manager direct UPDATE over stock, status and captured prices, outside API lifecycle safeguards | Define allowed direct-SQL operational use and review privilege design with Yerbolat | Existing behavior documented; scripts untouched |
| GAP-04 / P1 | Presence of role SQL does not prove successful deployment; `database/test_roles.sql` has write/delete attempts | Run a separately approved isolated role suite; never treat that script as live read-only diagnostics | NOT VERIFIED; do not run against business data |
| GAP-05 / P2 | Pending order PATCH exists but Angular does not provide amendment UI | Optional future frontend task reusing the existing PATCH operation, only after approval | No schema change expected; MISSING UI, existing API preserved |
| GAP-06 / P2 | Report label 'spending' can imply paid invoices but includes non-cancelled commitments | Explain exact calculation to users/evaluator; decide separately whether labels should change | No code change in this contribution |
| GAP-07 / P2 | Shared role credentials cannot establish creator/approver identity; all API readers can see contact/pricing fields, unlike SQL employee grants | Record current scope; obtain explicit confidentiality and identity requirements | Any named-user/audit schema proposal needs separate approval |
| GAP-08 / P2 | Case-insensitive API email check sits over case-sensitive DB UNIQUE | Document direct-writer/legacy mixed-case race limitation; retain constraints | DB uniqueness redesign deferred; requires separate approval |
| GAP-09 / P2 | Creation has no client idempotency key; uncertain responses require reconciliation | Document refresh-before-retry, preserving existing Angular handling | Persistent idempotency proposal deferred if schema-dependent |
| GAP-10 / P3 | No partial receipt, return, reversal or trustworthy historical receipt ledger | Keep full delivery only; never reconstruct/replay historical stock automatically | FUTURE SCOPE; separate approval required |
| GAP-11 / P2 | Current live integration and browser operation not independently verified by this package | Schedule secure read-only checks and isolated browser demo after review | NOT VERIFIED; no live writes authorized |

No gap is permission to modify application code, run SQL, change role settings or apply migrations. First priority is policy clarity and evidence, not rewriting implemented services.

## Given/When/Then acceptance scenarios

These scenarios map to the existing implementation and tests in [traceability](requirements-traceability.md). 'Existing evidence' means inspected test code, not a new pass result. Additional coverage should be proposed only after checking the current suite.

| ID / requirements | Given | When | Then | Existing evidence / remaining check |
| --- | --- | --- | --- | --- |
| AC-01 / FR-01, BR-13 | Authorized Buyer/Admin and a valid distinct email | A valid supplier is submitted | 201; normalized email and persisted supplier | T01 and supplier CRUD test |
| AC-02 / FR-01, BR-13 | Existing supplier email or missing/invalid required identity | Duplicate or invalid supplier input is submitted | 400; no unintended record | T02–T05 |
| AC-03 / FR-01, BR-14 | Optional address input | Omitted/null/empty, valid text, whitespace, wrong type or too-long text is submitted | Documented preservation/NULL/trim policy or 400; failed PATCH preserves value | T06–T08; `AmirFieldValidationTests.test_optional_address_policy_and_invalid_types_without_database` |
| AC-04 / FR-02, BR-15 | A product catalog operation | Negative price or any stock write is submitted | 400; catalog edit cannot overwrite receipt stock | T09/T10; `test_catalog_edit_does_not_overwrite_concurrent_inventory_value` |
| AC-05 / FR-03, BR-03–BR-06 | Existing supplier/products and valid dates, prices, unique lines | Buyer/Admin submits the order | 201 Pending; parent/items committed together; stock unchanged | Creation, totals and complete authenticated workflow tests |
| AC-06 / FR-03 | Invalid reference, duplicate product, bad date or nonpositive quantity | Order creation is attempted | 400 and no partial order/items | T11–T14; invalid-order test |
| AC-07 / FR-04, BR-02, BR-07 | Pending order with captured price | Catalog price changes and Pending quantities are amended without explicit line repricing | Captured price retained; computed total changes with quantity | Pending PATCH test; optional Angular amendment UI remains a proposal |
| AC-08 / FR-05 | Nonempty Pending order and Approver/Admin | Approval is requested | Approved; no receipt stock change; repeat approval conflicts | Status-action test; Approver role test |
| AC-09 / FR-06, BR-08–BR-09 | Approved order; initial stocks 5 and 2; quantities 2 and 3 | Delivery succeeds | Delivered; stocks 7 and 5 | T15/T16 |
| AC-10 / FR-06, BR-11–BR-12 | Delivered order | Delivery is requested again | 409; stock unchanged | T17 |
| AC-11 / FR-07 | Pending or Approved order | Approver/Admin cancels | Cancelled; stock unchanged; further delivery rejected | T18, cancellation and Approver-role tests |
| AC-12 / FR-06, NFR-02 | Approved order with multiple lines | A later stock update or final status save fails | Every stock increment rolled back; order remains Approved | T19; both delivery rollback tests |
| AC-13 / FR-06, NFR-02 | Approved order and two concurrent authorized requests | Both attempt delivery | One success and one conflict; one receipt only | T20 and duplicate-delivery race test |
| AC-14 / FR-07, NFR-02 | Approved order | Cancellation races delivery | One terminal winner; no cancelled receipt | Cancellation-race test |
| AC-15 / FR-08–FR-09, BR-16 | One delivered and one cancelled fixture order, each initially valued 28.00 | Reports load | Purchasing/delivered values 28.00; cancelled value excluded; status counts correct | Reporting test; exact fixture assertions remain authoritative |
| AC-16 / FR-10 | Missing/invalid credential or insufficient API capability | Protected read/write/action is requested | 401 for authentication failure; 403 for a valid insufficient role | API access tests and `CredentialRoleTests` |
| AC-17 / FR-11 | API mode and a backend/network/validation error | Loading or mutation fails | Helpful error, no hidden demo fallback or false success; uncertain writes require state refresh | Angular API adapter tests |
| AC-18 / FR-11 | Server-confirmed mutation followed by failed refresh | UI handles response | Confirmed-but-refresh-failed warning; do not ask user to resubmit | Angular confirmed-write/refresh-failure test |
| AC-19 / FR-05–FR-07 | Each of the four states and an appropriately authorized caller | Each approval/delivery/cancellation action is attempted | Only the lifecycle matrix permits transitions; forbidden actions preserve stock/state | Existing individual cases inspected; systematic full action/state coverage review proposed, not claimed complete |
| AC-20 / GAP-02–GAP-04 | Separately approved isolated PostgreSQL roles setup | Each DB role attempts permitted/forbidden operations | Privileges match an agreed DB policy, distinguished from API tests | NOT VERIFIED; do not execute teammate role script on live data |

T01–T19 are methods on `AmirValidationAndDeliveryTests`; T20 is on `AmirConcurrentDeliveryTests`, both in `backend/apps/purchasing/test_amir_assignment.py`. Exact functional test names and source paths are in the traceability matrix. No new Bekarys runtime test suite is claimed.

## Review and demonstration gates

1. Bekarys reviews requirement IDs, process/lifecycle diagrams and implementation references; confirms existing contributor credit.
2. Team signs off cancellation, full-receipt and permission-boundary descriptions. Changes to business behavior require a separate reviewed proposal.
3. Check links/symbols, API mapping, identifier coverage and `git diff --check`. Documentation validation is distinct from executing application tests.
4. If runtime evidence is needed, run only approved isolated tests. The existing helper normally initializes temporary test schema/auth tables; review its behavior before use where migration execution is prohibited. Do not run migrations or role scripts as part of this documentation task.
5. Demonstrate requirements and existing test scenarios without delivering or cancelling live orders. Existing Delivered orders must not be reset.
6. Bekarys personally approves the final diff and commits only his reviewed documentation under his own verified identity. Publication is a separate action, not performed automatically.
