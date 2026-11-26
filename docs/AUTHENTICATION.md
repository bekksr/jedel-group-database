> Current visibility: guests can browse allowlisted product/category names, supplier names and order summaries. Registered User and Purchasing Employee accounts have private business read, order creation and Jedel AI access.

# Authentication and application roles

Current policy: new registrations are immediately active and signed in as **User**. No administrator approval is required to create a normal account. Existing inactive accounts are unchanged and must still be reviewed manually. The previous pending-registration policy is historical.

## Registration and sessions

Angular's Account button opens /auth with Log in selected. /auth?mode=register selects Register; old /login and /register links remain safe compatibility redirects. One shared responsive form handles both modes.

POST /api/auth/register/ requires and validates name, username, email and password, checks optional confirmation, and rejects client role/staff/superuser fields. Username is stored separately from email; existing accounts are not renamed. PostgreSQL duplicate checks are serialized with an advisory transaction lock, including email/username collision checks so a new account cannot make an existing account's identifier ambiguous. Passwords use Django hashing. Within one database transaction Django creates an active nonstaff/nonsuperuser, assigns User (or an empty legacy Basic User group when that is all an existing deployment has provisioned), calls Django login and explicitly persists the database session. Session creation failure rolls back the account/membership. No fake success is returned.

Angular then fetches /api/auth/me/ from the real server, updates its one authentication state, shows "Account created successfully. Welcome to Jedel.Group!" and redirects Home. A late anonymous restoration response cannot overwrite the new account. If profile retrieval fails after confirmed creation, the UI asks the user to try logging in rather than register again. Password fields clear on success; valid input remains on ordinary validation failure.

Session cookies are HttpOnly and SameSite=Lax; HTTPS production enables Secure flags. CSRF remains enabled: GET /api/auth/csrf/ obtains csrftoken, Angular sends X-CSRFToken, and anonymous login/registration explicitly enforce it. All ordinary Angular requests use the same browser origin and relative /api proxy. No password/session credential is stored in localStorage and no shared bearer entry is required. Login supports case-insensitive email and exact legacy usernames; ambiguous old identifiers fail closed. Logout invalidates the server session and clears client identity/private workspace data.

Both login and registration use independent 10/minute IP cache buckets, including requests from authenticated users. This is local per-process rate limiting, not a distributed production guarantee; production workers need a reviewed shared cache/proxy configuration. Repeated browser submissions are also blocked while requests are in flight.

## Role matrix

| Role | Own profile/password | Business reads | Catalog edits | Pending orders | Approve/deliver/cancel | Eligible catalog deletes | Security/admin |
|---|---|---|---|---|---|---|---|
| User (registration default) | yes | yes | yes | no | no | no | no |
| Purchasing Employee (existing role) | yes | yes | yes | no | no | no | no |
| Basic User (legacy alias) | yes | yes | yes | no | no | no | no |
| System Administrator | yes | yes | yes | yes | yes | yes | trusted administration; Staff explicitly required for Django Admin |
| Purchasing Manager | yes | yes | yes | yes | yes | no | no |
| Purchasing Employee | yes | yes | yes | yes | no | no | no |
| Security Administrator | yes | no | no | no | no | no | limited employee/analyst activation/suspension |
| Analyst / Tester | yes | yes | no | no | no | no | no |

User, Purchasing Employee and legacy Basic User have equivalent read, catalog management, order creation and Jedel AI capabilities. They cannot approve orders or administer accounts. Guest views return allowlisted product/category names, supplier names, and order summaries with item names and quantities; private supplier contacts, prices, stock and other purchasing fields are omitted. Authorization is enforced by Django independently of navigation.

Group membership persists in auth_user_groups and capability policy is defined in accounts.py. setup_roles provisions application role groups without assigning users or setting Staff/Superuser. Existing Basic User memberships are retained and interpreted as User capabilities; the policy does not rewrite accounts or memberships.

## Existing inactive accounts and privileged assignments

An authorized administrator can open Django Admin ? Users, filter Registration review / inactive nonstaff accounts, inspect each account, assign an appropriate group, and explicitly activate it or use "Approve assigned nonstaff accounts". Assign User for a normal business account, or a business role only when authorized. "Reject / suspend" keeps records but disables access. Existing inactive users are not auto-approved by the new registration policy. Existing active accounts and their roles remain valid.

The initial administrator is bootstrapped only by an explicit local `python manage.py createsuperuser` command after schema readiness. Normal signup never grants Staff, Superuser, Purchasing Manager, approval/delivery or Security Administrator rights. Trusted System Administrators can manage users/groups when explicitly granted Staff. Business Admin catalog forms reuse API validation; stock is read-only, business deletion is denied there, and order transitions use existing atomic services. There is no automatic Django Admin link for new users in the website profile menu.

## Public navigation and Account menu

Logged out: Home, Products, Suppliers, Orders, Account. Analytics and Jedel AI are hidden. Account defaults to the Log in mode, with Register selectable inside the card.

Logged in: the five public navigation sections plus an avatar/name/actual-role menu with My Profile, Settings and Log out. Menu selection closes it; logout restores Account. My Profile and Settings use the existing account settings screen. No duplicate authentication page was added.

Guests can browse allowlisted product, supplier and order summary records; they cannot use AI or analytics. Analytics and Jedel AI navigation and routes require the read capability. Order writes and transitions remain capability protected.

## Database state and verification

No new schema is needed for this policy. The `setup_roles --confirm` command provisions the User role group; registration also supports an existing Basic User group with only the reviewed User permissions. User and group records are not rewritten automatically. Disposable tests use a marked temporary PostgreSQL cluster.

See [the current report](AUTO_REGISTRATION_REPORT.md) for exact test counts, changed files and manual verification. Historic migration plans/reports describe the earlier missing-schema state; do not replay them blindly against an already initialized database.

## Public product catalog versus business read

/api/catalog/products/ and its detail route are explicit public GET/HEAD/OPTIONS-only projections of product_id, product_name and category. /api/catalog/categories/ returns only category names. Anonymous, Basic User, User, Purchasing Employee and Security Administrator accounts can use these without internal purchasing permission. Private columns are excluded both from serialization and ORM selection. Search uses only product_name/category, and ordering/filtering cannot target prices or stock.

/api/products/, suppliers, orders, dashboard and analytics require the appropriate business capability. User and Purchasing Employee have read and create_orders; approvals remain limited to higher roles. Browser code chooses allowlisted public pages for guests and private pages for authorized readers. No schema change is required.

Historical Viewer maps to Analyst / Tester, Buyer to Purchasing Employee, Approver to Purchasing Manager, Admin to System Administrator. Purchasing Manager intentionally combines preparation/catalog maintenance and transitions. PostgreSQL has one restricted `erp_app` service account; browser users never select database roles. `database/roles.sql` is now documentation-only because the old SQL login hierarchy did not match Django permissions and bypassed application workflows. Django Groups and API permissions are the source of truth; direct SQL grants are not substituted for service authorization. Guests can browse public product/category names, supplier names and order summaries; private fields remain omitted. User and Purchasing Employee can access the private purchasing workflow and AI.

## All five navigation sections

Guests can open Home, Products, Suppliers and Orders. Analytics and Jedel AI appear only for authenticated accounts with read access. Public lists use safe fields only. See [all-section verification](ALL_SECTIONS_REPORT.md) for the current role matrix and test results.

Role setup now defaults to a dry-run; live changes require explicit approval and the --confirm flag. See [RBAC report](RBAC_REPORT.md) for grants, conflict handling and account safeguards.
