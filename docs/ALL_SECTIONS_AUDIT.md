# Five-section audit before this task

Branch: feature/fullstack-integration-auth; existing working-tree changes preserved. Read current components/routes/guards/API adapters, account capability policy, protected serializers/report endpoints, Bekarys business requirements and Yerbolat roles.sql.

| Section | Anonymous before | Basic User before | Employee | Manager | Analyst | System Administrator |
|---|---|---|---|---|---|---|
| Home | Public introduction | Public introduction | Real dashboard | Real dashboard | Real dashboard | Real dashboard |
| Products | Safe live catalog | Safe live catalog | Business fields/actions | Business fields/actions | Business read-only | Business administration |
| Suppliers | Short generic intro/login prompt | Generic Access Denied | CRUD except deletion | CRUD except deletion | Read-only | CRUD with protected deletion |
| Orders | Short generic intro/login prompt | Generic Access Denied | Read/create/amend Pending | Read/create/amend + eligible transitions | Read-only | Authorized lifecycle |
| Analytics | Short generic intro/login prompt | Generic Access Denied | Real basic reports | Real basic reports | Real basic reports | Real basic reports |

Cause: PublicWorkspacePage has one fallback branch for all non-business readers. Products was explicitly separated, but the remaining sections still fell through to a generic permission alert. No separate public supplier/financial classification exists. Authorized analytics renders only spending/status; Home does not explain all navigation sections and its primary CTA ignores create permission. Orders can display an empty state during loading/error; supplier search lacks contact/address filtering; backend failures rely on a global error plus inconsistent per-page states.

Decision: no new public supplier/order/analytics records or aggregates. Provide substantive static previews and a clear access-guidance page, not a fake request-submission flow. Preserve the existing public product projection and role checks. Enrich authorized reports using existing dashboard/spending/status endpoints and real dated order counts. Do not infer payments from procurement commitments or add AI/sales workflows. No migration or GRANT change is required.

Final behavior and exact verification will be recorded in ALL_SECTIONS_REPORT.md.
