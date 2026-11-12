# Jedel.Group Angular frontend

From this folder: `npm ci`, then `npm start` (PowerShell may use `npm.cmd`). Run tests with `npm test -- --watch=false` and production build with `npm run build`.

Public navigation is Home / Products / Suppliers / Orders / Analytics / Account. Account opens /auth with Log in selected. Register switches the same responsive card; /login and /register still redirect safely.

Successful registration uses the real Django API, creates a least-privileged active Basic User, confirms the session via /api/auth/me/, displays a welcome notification and redirects Home. Refresh retains the session. The profile menu displays actual name/role, My Profile, Settings and Log out. No pending-approval message is shown for new signup. Existing inactive accounts remain subject to manual administrator review.

Basic User cannot view private contacts, stock, purchasing costs/orders or analytics, or perform catalog/purchasing/security administration. Account creation does not grant a business role. Protected actions require backend-enforced capabilities; insufficient roles see Access Denied. Public Home never forces login.

All API requests use the relative /api development proxy; no bearer credential entry or localStorage session secret is used. Errors never fall back to mock authentication. Follow the [current report](../docs/AUTO_REGISTRATION_REPORT.md) for exact tests, files and browser verification, and [authentication guide](../docs/AUTHENTICATION.md) for security/role details.

Products now renders a separate public-safe catalog for anonymous, Basic User and other accounts without private-business read. It shows IDs/names/categories with server-backed search, category facets, relative pagination, loading/empty/error/retry states and request cancellation. Authorized readers keep the business Products screen with prices/stock and capability-gated actions. [Current catalog/role verification](../docs/CATALOG_ACCESS_REPORT.md).

The AI Assistant navigation opens /ai-assistant. See [Copilot guide](../docs/AI_COPILOT.md) for safe search, quotations and optional AI configuration.
