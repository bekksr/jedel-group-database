# Jedel.Group API

Canonical business base: /api/. The legacy /api/v1/ business alias remains. Account endpoints use /api/auth/. Angular proxies relative /api requests to Django; normal users never supply a shared bearer token. All sensitive APIs enforce session authentication and capabilities on the server.

| Method | Path | Behavior |
|---|---|---|
| GET | /api/auth/csrf/ | Retrieve CSRF cookie/token; anonymous allowed |
| POST | /api/auth/register/ | name, username, email, password, optional password_confirm; persist active User and server session; 201 with detail and user |
| POST | /api/auth/login/ | password and exactly one identifier, username or email; case-insensitive email/exact legacy username; CSRF required |
| GET | /api/auth/me/ | Current identity, role, capabilities, can_administer; 401 means anonymous/expired |
| POST | /api/auth/logout/ | Invalidate the current session; CSRF required |
| PATCH | /api/auth/profile/ | Own name only; no role/staff/email escalation |
| POST | /api/auth/password/ | current_password, new_password, and new_password_confirm; validates and hashes; verifies current password |
| POST | /api/auth/password-reset/ | email; always returns the same acknowledgement; sends a single-use email link only for one active account match |
| POST | /api/auth/password-reset/confirm/ | uid, token, new_password, new_password_confirm; validates a non-expired single-use token and password |
| GET | /api/catalog/products/ | Public paginated IDs/names/categories; search/category/page/public-field ordering only |
| GET | /api/catalog/products/{id}/ | Public safe detail; no purchasing price or inventory |
| GET | /api/catalog/categories/ | Public distinct category names; no prices, stock or contacts |
| GET | /api/access/ | Protected purchasing workspace capabilities; use /auth/me/ for the current user's capabilities |
| GET/POST | /api/suppliers/ | Protected list/create |
| GET/PATCH/DELETE | /api/suppliers/{id}/ | Protected read/edit/eligible deletion |
| GET/POST | /api/products/ | Protected list/create; stock server-controlled |
| GET/PATCH/DELETE | /api/products/{id}/ | Protected catalog operations, never arbitrary stock changes |
| GET/POST | /api/orders/ | Protected list/Pending creation |
| GET/PATCH | /api/orders/{id}/ | Details or eligible Pending amendment |
| POST | /api/orders/{id}/approve/ | Empty body; permitted Pending ? Approved transition |
| POST | /api/orders/{id}/deliver/ | Empty body; Approved ? Delivered with atomic stock receipt exactly once |
| POST | /api/orders/{id}/cancel/ | Empty body; eligible cancellation |
| GET | /api/dashboard/ | Private purchasing/inventory metrics |
| GET | /api/analytics/supplier-spending/ | Private spending using captured prices, excluding Cancelled |
| GET | /api/analytics/order-status/ | Private order status counts |
| GET | /api/security/accounts/ | Designated security administrators list eligible assigned employees/analysts |
| PATCH | /api/security/accounts/{id}/ | Restricted is_active only; no role escalation |
| GET | /health/ | Database and required-table readiness, generic 200/503 |
| GET | /api/health/ | Liveness only; explicitly does not verify the database |
| GET | /api/docs/, /api/schema/ | Endpoint descriptions and minimal OpenAPI reference |

Registration returns "Account created successfully. Welcome to Jedel.Group!" only after account and database session persistence. User is immediately active with read access, catalog management, order creation and Jedel AI access; order approval and security/admin permissions remain restricted. New registrations use the User group when provisioned, with a compatibility fallback to an empty legacy Basic User group. Existing Purchasing Employee accounts retain their group and receive equivalent capabilities through policy. No account gets Staff/Superuser flags. The transaction rolls back if initial session persistence fails. Client profile retrieval must succeed before Angular announces welcome/redirects Home. Existing inactive accounts remain inactive and require manual authorized review.

Password confirmation/strength and duplicate email checks are server enforced. Email/username namespace collisions are rejected on signup; ambiguous historical identifiers fail closed during login. Both login and registration have independent 10/minute IP cache buckets, including authenticated requests. Passwords/session secrets are never returned or stored in browser localStorage.

HTTP errors: 400 invalid input/duplicate/invalid credentials, 401 anonymous/expired session, 403 CSRF/role denial, 404 missing record, 409 workflow/delete conflict, 413 oversized input, 429 throttled, 503 database/session/default-role infrastructure failure. Existing missing-schema handling remains safe, but current jedel_group_db diagnostics show its 18 auth/admin/session migrations already applied. No migration was applied by this task.

Money uses decimal strings and captured item prices; delivery and cancellation use the original purchasing services. Never retry an uncertain delivery without checking current state. See AUTHENTICATION.md and AUTO_REGISTRATION_REPORT.md for the current policy, exact tests and manual verification.

## Public catalog policy

Public catalog and record endpoints are explicitly allowlisted and read-only. Anonymous users may browse product/category names, supplier names and order summaries with line item names and quantities. Supplier contact details, prices, stock and other private fields are omitted. These public endpoints accept no writes (405) and reject unrecognized filters/field-selection parameters. Authenticated users use protected endpoints according to their capabilities; User and Purchasing Employee can read business data and create orders, while approval remains restricted to higher roles.

No AI search endpoint exists in the inspected application. This catalog implements ordinary keyword/category search only, with no model/provider calls or exposure of purchasing data to an AI service. Any later public AI endpoint must use the same approved-field boundary.
