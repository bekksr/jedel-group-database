# Jedel.Group — System Roles and Role-Based Access Control Report

**Document type:** System Analysis / Security and Authorization  
**Prepared by:** Toktar Bekarys  
**Project:** Jedel.Group ERP  
**Date:** 13 November 2026  
**Scope:** Application roles, permissions, authorization boundaries and role verification  
**Excluded from this report:** AI Copilot implementation.

---

## 1. Executive Summary

Role-Based Access Control (RBAC) defines which users may access information and perform operations in the Jedel.Group ERP system. The system uses Django authentication, Django Groups and model permissions, together with application-level capability checks and protected API views.

The key security principle is that authentication and authorization are separate:

- Authentication establishes the identity of the user.
- A role describes the user's assigned application responsibilities.
- Permissions and server-side business rules determine which operations the user may perform.
- Frontend navigation and button visibility improve usability but do not replace backend authorization.

The documented application setup provisions six named roles:

1. Basic User
2. Purchasing Employee
3. Purchasing Manager
4. System Administrator
5. Security Administrator
6. Analyst / Tester

The roles are designed around least privilege. A user should receive only the permissions needed for their assigned responsibilities.

## 2. RBAC Objectives

The RBAC design aims to:

- Restrict private business data to authorized users.
- Separate purchasing preparation from approval and delivery.
- Prevent ordinary users from changing stock directly.
- Separate business administration from delegated account security tasks.
- Keep read-only analyst access separate from write permissions.
- Prevent role assignment through public registration or ordinary profile updates.
- Enforce authorization on the backend for every protected operation.
- Make frontend navigation reflect server-provided capabilities.

## 3. Security Concepts

### 3.1 Authentication

Authentication verifies a user's credentials and establishes a session. A successful login does not automatically grant access to all application features.

### 3.2 Application roles

Django Groups represent application-level roles. A user may be associated with one or more groups according to the system's assignment policy.

### 3.3 Model permissions

Django model permissions control supported operations such as viewing, adding, changing and deleting model records. These permissions are not the same as PostgreSQL connection roles.

### 3.4 Staff and superuser flags

The `is_staff` flag permits access to Django Admin entry points, subject to the configured Admin permissions. It does not itself grant every business permission.

The `is_superuser` flag is a separately trusted, highly privileged Django setting. It must not be granted as a shortcut for ordinary application roles.

### 3.5 Database connection roles

PostgreSQL roles and grants are independent of browser application roles. Logging into the web application does not change database connection credentials. SQL database roles must be reviewed and provisioned through a separate controlled database-administration process.

## 4. Role Definitions

### 4.1 Basic User

**Purpose:** Default low-privilege application user.

Responsibilities and allowed access:
- Access own profile and account-related information.
- Access approved public catalog previews.
- View only explicitly public product fields.
- Use public registration/login flows where enabled.

Restrictions:
- No private purchasing data.
- No supplier contact directory.
- No private prices or stock information through the public catalog.
- No order creation or amendment.
- No approval, delivery or cancellation.
- No product/supplier administration.
- No security-account administration.
- No Django Admin privileges by default.

A newly registered Basic User must not be made staff or superuser and must not receive privileged groups through a public profile field.

### 4.2 Purchasing Employee

**Purpose:** Operational purchasing user who prepares purchasing records.

Allowed capabilities:
- Read private purchasing data needed for work.
- View suppliers, products and purchase orders.
- Add and edit eligible supplier/product catalog information.
- Create purchase orders.
- Prepare and amend eligible Pending orders.

Restrictions:
- Cannot approve orders.
- Cannot deliver orders.
- Cannot cancel orders where the transition requires manager authority.
- Cannot arbitrarily change inventory stock.
- Cannot assign application roles or manage privileged accounts.

### 4.3 Purchasing Manager

**Purpose:** Supervisory purchasing role responsible for workflow decisions.

Allowed capabilities:
- Read private purchasing information.
- Perform purchasing employee operations.
- Approve eligible Pending orders.
- Deliver eligible Approved orders.
- Cancel orders when the business workflow permits the transition.
- Access relevant purchasing dashboards and analytics.

Restrictions:
- Cannot bypass workflow state validation.
- Cannot repeat delivery to apply inventory receipt more than once.
- Cannot arbitrarily edit historical prices or stock.
- Does not automatically receive superuser status.

### 4.4 System Administrator

**Purpose:** Trusted application administrator responsible for supported system administration.

Allowed capabilities:
- Manage supported business records through authorized application services.
- Access supported Django Admin functionality when the account is staff and has the required model permissions.
- Manage ordinary application groups and accounts through the trusted administration process.
- Perform supported deletion operations subject to business constraints.

Restrictions and controls:
- Staff status alone is not sufficient for every operation.
- Admin deletion remains subject to application constraints.
- Historical prices and stock are not editable through ordinary Admin workflows.
- Privileged role assignment must not be exposed through public registration or self-service profile updates.
- Superuser status remains a separate trusted decision.

### 4.5 Security Administrator

**Purpose:** Delegated, low-privilege account-security role.

Allowed capabilities:
- View the eligible accounts exposed by the security-account interface.
- Activate/deactivate eligible ordinary employee or analyst accounts where policy permits.
- Perform the narrowly scoped security operation supported by the API.

Restrictions:
- No private purchasing data by virtue of this role.
- No supplier, product or order management.
- No raw Django group editor.
- No role assignment or privilege escalation.
- Cannot change staff/superuser flags through the delegated account endpoint.
- Cannot activate itself or privileged accounts excluded by the eligibility policy.

### 4.6 Analyst / Tester

**Purpose:** Read-only business analysis and testing role.

Allowed capabilities:
- Read suppliers, products, purchase orders and order items where authorized.
- Review business information needed for analysis and testing.
- Access read-only views and reports exposed to the role.

Restrictions:
- No create, edit or delete operations.
- No order approval, delivery or cancellation.
- No inventory mutation.
- No account or role administration.

## 5. Permission Matrix

The following matrix summarizes the documented intended policy.

| Capability | Basic User | Purchasing Employee | Purchasing Manager | System Administrator | Security Administrator | Analyst / Tester |
|---|---:|---:|---:|---:|---:|---:|
| Own profile | Yes | Yes | Yes | Yes | Yes | Yes |
| Public catalog preview | Yes | Yes | Yes | Yes | Yes | Yes |
| Private purchasing read | No | Yes | Yes | Yes | No | Yes |
| Supplier/product management | No | Yes | Yes | Yes | No | No |
| Create purchase order | No | Yes | Yes | Yes, supported path | No | No |
| Amend eligible Pending order | No | Yes | Yes | Yes, supported path | No | No |
| Approve eligible order | No | No | Yes | Yes, validated path | No | No |
| Deliver eligible order | No | No | Yes | Yes, validated path | No | No |
| Cancel eligible order | No | No | Yes | Yes, validated path | No | No |
| Read-only analytics | No | As authorized | Yes | Yes | No | As authorized |
| Manage eligible account activation | No | No | No | Trusted administration | Limited delegated scope | No |
| Assign application roles | No | No | No | Trusted administration | No | No |
| Django Admin access | No | No | No by default | Staff + required model permissions | No raw group editor | No |

**Important:** The matrix describes application policy. Exact endpoint behavior must be confirmed against the current backend permissions, service functions and tests. The frontend must not be treated as the enforcement layer.

## 6. Role Provisioning

The application initialization command provisions six named Django Groups and attaches the configured permissions. The Docker startup output showed the six groups being prepared in the isolated development schema:

- Basic User
- System Administrator
- Purchasing Manager
- Purchasing Employee
- Security Administrator
- Analyst / Tester

The initialization output also stated that user assignments, passwords and staff/superuser flags were unchanged.

This is an important distinction: creating role groups and permissions is not the same as assigning every existing user to a role. User assignment is a separate controlled administrative action.

### 6.1 Provisioning principles

1. Review the role definition before provisioning.
2. Use the approved initialization/provisioning command.
3. Inspect the role permissions after provisioning.
4. Assign test users only in an isolated environment.
5. Do not bulk-promote pending registrations.
6. Do not grant superuser status to make a test pass.
7. Do not execute database-role SQL merely because application Groups were created.
8. Re-authenticate or refresh the session after role assignment so the frontend retrieves current capabilities.

## 7. Authorization Enforcement

### 7.1 Backend enforcement

The backend is the authoritative enforcement point. Every private endpoint must verify the authenticated user and the required role/capability before returning sensitive data or executing a mutation.

Examples:
- Anonymous requests to private endpoints should be rejected.
- Basic User requests to private purchasing endpoints should be denied.
- Analyst write requests should be denied.
- Employee approval/delivery requests should be denied.
- Manager workflow requests should still be checked against the order's current state.
- Security Administrator requests must be restricted to the delegated account fields and eligible targets.

### 7.2 Frontend capability handling

Angular should retrieve the user's actual profile and server-provided capability flags. It may use those values to:
- Display or hide Administration navigation.
- Display or hide Security navigation.
- Disable or omit unavailable workflow controls.
- Preserve public preview pages.
- Show meaningful error states when profile or security API requests fail.

Frontend controls are usability features only. A user must not gain access by manually constructing an HTTP request.

### 7.3 Registration boundary

Public registration creates a Basic User. It must not accept a user-supplied role, group, staff flag or superuser flag. Privileged account changes require an authorized administrative process.

## 8. API Security Boundaries

The documented security-related endpoints include:

| Endpoint | Purpose | Security expectation |
|---|---|---|
| `GET /api/auth/me/` | Current user profile | Authenticated session |
| `GET /api/access/` | Purchasing capabilities | Protected; Basic User uses profile/public routes |
| `GET /api/security/accounts/` | Eligible account list | Designated Security Administrator access |
| `PATCH /api/security/accounts/{id}/` | Restricted account activation update | Only approved field(s), no role escalation |
| `GET /api/catalog/products/` | Public product list | Allowlisted public fields only |
| `GET /api/catalog/products/{id}/` | Public product detail | No private prices or stock |
| `GET /api/catalog/categories/` | Public category list | No private purchasing information |

The public catalog is read-only. Its documented public product fields are `product_id`, `product_name` and `category`. Unsupported filters or private-field ordering should be rejected rather than silently exposing additional information.

## 9. Expected Authorization Responses

The application documents the following general HTTP status semantics:

| Status | Meaning |
|---|---|
| 400 | Invalid input, duplicate data or invalid credentials |
| 401 | Anonymous request or expired/invalid session |
| 403 | CSRF failure or role/permission denial |
| 404 | Record not found |
| 405 | Method not allowed, such as a write to a read-only public catalog |
| 409 | Workflow or deletion conflict |
| 413 | Request too large |
| 429 | Rate limit exceeded |
| 503 | Database/session/default-role infrastructure unavailable |

The exact status should be verified per endpoint and error condition.

## 10. RBAC Test Scenarios

The following scenarios define the expected role behavior. They should be executed using isolated test accounts and disposable test data.

| ID | Scenario | Expected result |
|---|---|---|
| RBAC-01 | Anonymous user requests private supplier list | 401 or equivalent unauthenticated rejection |
| RBAC-02 | Basic User requests private supplier list | 403 |
| RBAC-03 | Basic User requests public product catalog | 200 with approved public fields only |
| RBAC-04 | Basic User attempts product creation | 403 |
| RBAC-05 | Purchasing Employee creates an eligible purchase order | Allowed |
| RBAC-06 | Purchasing Employee attempts approval | 403 |
| RBAC-07 | Purchasing Employee attempts delivery | 403 |
| RBAC-08 | Purchasing Manager approves eligible Pending order | Allowed |
| RBAC-09 | Purchasing Manager attempts delivery of non-Approved order | Rejected as workflow conflict |
| RBAC-10 | Purchasing Manager delivers eligible Approved order | Allowed; inventory receipt occurs once |
| RBAC-11 | Analyst reads permitted purchasing records | Allowed |
| RBAC-12 | Analyst attempts to edit a product | 403 |
| RBAC-13 | Security Administrator views eligible accounts | Allowed |
| RBAC-14 | Security Administrator attempts to assign a role | 403 / unsupported operation |
| RBAC-15 | Security Administrator attempts to activate a privileged account | Rejected |
| RBAC-16 | Basic User submits a role field during registration | Field ignored or rejected; account remains Basic User |
| RBAC-17 | Ordinary staff user without required model permissions opens protected Admin model | Denied |
| RBAC-18 | User is deactivated and reuses an existing session | Session/API access rejected according to account policy |
| RBAC-19 | User role changes and profile is refreshed | New capability state is reflected |
| RBAC-20 | User sends a direct API request despite a hidden frontend button | Backend independently enforces authorization |

## 11. Verification Evidence and Interpretation

The project documentation records RBAC-focused automated tests and browser checks in the earlier verification environment. The recorded results include:
- A full isolated PostgreSQL backend suite of 126 passed, 0 failed and 0 skipped.
- Five Chromium scenarios passed within that suite.
- A focused RBAC/Admin regression of 9 passed, 0 failed and 0 skipped; these tests overlap the full suite and must not be added as unique coverage.
- Angular unit regression of 80 passed, 0 failed and 0 skipped across 11 files.
- A Django system check reported no issues.
- A read-only role provisioning dry run was reported successful in the earlier verification record.

These are historical results recorded in the project's RBAC verification documentation. They should not be represented as a new test execution performed by the 13 November Docker startup session.

The current Docker startup log independently confirms that the six role groups were prepared in the isolated development schema and that existing user assignments and privilege flags were not changed.

## 12. Operational and Security Recommendations

- Apply least privilege to every new account.
- Keep role assignment separate from public registration.
- Review group permissions after code changes.
- Use isolated test accounts for role testing.
- Do not test destructive actions against real business data.
- Keep PostgreSQL roles separate from Django application groups.
- Do not grant superuser as a workaround.
- Log and investigate repeated 401/403 responses where appropriate.
- Re-check the server-side policy whenever frontend navigation changes.
- Review the public catalog serializer whenever product fields are added.
- Keep account activation narrowly scoped.
- Re-run backend and frontend regression tests after RBAC changes.

## 13. Conclusion

The Jedel.Group RBAC model separates ordinary users, purchasing operators, purchasing managers, system administrators, security administrators and read-only analysts. The design separates authentication, application roles, Django model permissions, staff/superuser flags and PostgreSQL connection privileges.

The core security requirement is that authorization remains server-enforced. Frontend capability flags provide a consistent user experience, while the backend protects the actual data and operations. The six role groups were initialized in the isolated Docker development schema without changing existing user assignments or privilege flags.

This report documents the role model and its verification expectations. Production role assignment and any live database privilege changes must follow the project's approval and operational procedures.
