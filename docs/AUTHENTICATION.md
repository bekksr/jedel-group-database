> Current product visibility: anonymous visitors and Basic Users may browse the safe catalog (ID/name/category only). Private business `read` remains false for Basic User. See [the catalog access report](CATALOG_ACCESS_REPORT.md).

# Authentication and application roles

Current policy: new registrations are immediately active and signed in as **Basic User**. No administrator approval is required to create a normal account. Existing inactive accounts are unchanged and must still be reviewed manually. The previous pending-registration policy is historical.

## Registration and sessions

Angular's Account button opens /auth with Log in selected. /auth?mode=register selects Register; old /login and /register links remain safe compatibility redirects. One shared responsive form handles both modes.

POST /api/auth/register/ validates name/email/password/confirmation and rejects client role/staff/superuser fields. PostgreSQL duplicate checks are serialized with an advisory transaction lock, including email/username collision checks so a new account cannot make an existing account's identifier ambiguous. Passwords use Django hashing. Within one database transaction Django creates an active nonstaff/nonsuperuser, assigns only Basic User, calls Django login and explicitly persists the database session. Session creation failure rolls back the account/membership. No fake success is returned.

Angular then fetches /api/auth/me/ from the real server, updates its one authentication state, shows "Account created successfully. Welcome to Jedel.Group!" and redirects Home. A late anonymous restoration response cannot overwrite the new account. If profile retrieval fails after confirmed creation, the UI asks the user to try logging in rather than register again. Password fields clear on success; valid input remains on ordinary validation failure.

Session cookies are HttpOnly and SameSite=Lax; HTTPS production enables Secure flags. CSRF remains enabled: GET /api/auth/csrf/ obtains csrftoken, Angular sends X-CSRFToken, and anonymous login/registration explicitly enforce it. All ordinary Angular requests use the same browser origin and relative /api proxy. No password/session credential is stored in localStorage and no shared bearer entry is required. Login supports case-insensitive email and exact legacy usernames; ambiguous old identifiers fail closed. Logout invalidates the server session and clears client identity/private workspace data.

Both login and registration use independent 10/minute IP cache buckets, including requests from authenticated users. This is local per-process rate limiting, not a distributed production guarantee; production workers need a reviewed shared cache/proxy configuration. Repeated browser submissions are also blocked while requests are in flight.

## Role matrix

| Role | Own profile/password | Business reads | Catalog edits | Pending orders | Approve/deliver/cancel | Eligible catalog deletes | Security/admin |
|---|---|---|---|---|---|---|---|
| Basic User (registration default) | yes | no | no | no | no | no | no |
| System Administrator | yes | yes | yes | yes | yes | yes | trusted administration; Staff explicitly required for Django Admin |
| Purchasing Manager | yes | yes | yes | yes | yes | no | no |
| Purchasing Employee | yes | yes | yes | yes | no | no | no |
| Security Administrator | yes | no | no | no | no | no | limited employee/analyst activation/suspension |
| Analyst / Tester | yes | yes | no | no | no | no | no |

Basic User intentionally has no business-data read capability, because the former Viewer/Analyst exposes internal contacts, costs and reports. Basic users can browse/search/filter safe product names/categories, edit their own profile/name/password and use other safe public previews. The permissions API for their account is /api/auth/me/, not protected purchasing endpoints. Authorization is enforced by Django independently of navigation.

Group membership persists in auth_user_groups and capability policy is defined in accounts.py. Basic User has no Django permissions. Registration refuses a pre-existing Basic User group with permissions instead of silently inheriting or rewriting unsafe grants. setup_roles creates six groups but assigns no users and never sets Staff/Superuser automatically. App groups are separate from PostgreSQL roles/GRANT scripts, which remain unchanged.

## Existing inactive accounts and privileged assignments

An authorized administrator can open Django Admin ? Users, filter Registration review / inactive nonstaff accounts, inspect each account, assign an appropriate group, and explicitly activate it or use "Approve assigned nonstaff accounts". Assign Basic User for a normal profile-only account, or a business role only when authorized. "Reject / suspend" keeps records but disables access. Existing inactive users are not auto-approved by the new registration policy. Existing active accounts and their roles remain valid.

The initial administrator is bootstrapped only by an explicit local `python manage.py createsuperuser` command after schema readiness. Normal signup never grants Staff, Superuser, Purchasing Manager, approval/delivery or Security Administrator rights. Trusted System Administrators can manage users/groups when explicitly granted Staff. Business Admin catalog forms reuse API validation; stock is read-only, business deletion is denied there, and order transitions use existing atomic services. There is no automatic Django Admin link for new users in the website profile menu.

## Public navigation and Account menu

Logged out: Home, Products, Suppliers, Orders, Analytics, Account. Account defaults to the Log in mode, with Register selectable inside the card.

Logged in: the five public navigation sections plus an avatar/name/actual-role menu with My Profile, Settings and Log out. Menu selection closes it; logout restores Account. My Profile and Settings use the existing account settings screen. No duplicate authentication page was added.

Home and safe section previews remain public. Anonymous or Basic User visitors never receive supplier contacts, inventory, purchase costs/orders or protected reports. Protected action routes send anonymous users through /auth with a safe local returnTo destination. Login resumes the operation only if its capability guard permits it. A registered Basic User is redirected Home and does not receive purchasing rights; direct protected actions show Access Denied.

## Database state and verification

Read-only diagnostics during this task found all ten Django tables and all 18 built-in migrations already applied in jedel_group_db, with no pending migrations. Two existing inactive nonstaff accounts were observed and left unchanged. No migration or live registration test was performed by the agent. No new schema is needed for this policy: Basic User is an ordinary Group row created during real registration (or explicit setup_roles). All disposable tests use a marked temporary PostgreSQL cluster.

See [the current report](AUTO_REGISTRATION_REPORT.md) for exact test counts, changed files and manual verification. Historic migration plans/reports describe the earlier missing-schema state; do not replay them blindly against an already initialized database.

## Public product catalog versus business read

/api/catalog/products/ and its detail route are explicit public GET/HEAD/OPTIONS-only projections of product_id, product_name and category. /api/catalog/categories/ returns only category names. Anonymous, Basic User and Security Administrator accounts can use these without internal purchasing permission. Private columns are excluded both from serialization and ORM selection. Search uses only product_name/category, and ordering/filtering cannot target prices or stock.

/api/products/, suppliers, orders, dashboard and analytics remain business-role-protected. Basic User's read capability remains false; that flag means private business read, not permission to see the public catalog. No application group assignment, PostgreSQL GRANT or schema change is required. Browser code selects the public catalog for accounts without business read and the existing purchasing Products screen for authorized readers. Product order-preparation links require create_orders; edit/delete actions retain their existing capabilities.

Historical Viewer maps to Analyst / Tester, Buyer to Purchasing Employee, Approver to Purchasing Manager, Admin to System Administrator. Purchasing Manager intentionally combines preparation/catalog maintenance and transitions. SQL role_employee has different column grants than the app Employee role; neither Django Groups nor browser sessions perform SET ROLE. The original scripts remain unchanged and direct-SQL grants are not substituted for service authorization.

## All five navigation sections

Home, Products, Suppliers, Orders and Analytics now open for anonymous visitors and Basic User. Only Products publishes live safe catalog fields. Other non-business views provide substantive workflow/report previews and access guidance, without confidential records. See [all-section verification](ALL_SECTIONS_REPORT.md) for the current role matrix and test results.

Role setup now defaults to a dry-run; live changes require explicit approval and the --confirm flag. See [RBAC report](RBAC_REPORT.md) for grants, conflict handling and account safeguards.
