# UI visual regression repair — 12 November 2026

## Confirmed cause

The integrated stylesheet no longer defined `.stats`, `.stats article`,
`.stats strong` or `.stats span`, although Home and Analytics still used those
elements. Before-capture browser evidence shows a block container and inline
values/labels. This caused concatenation; the API calculations were unaffected.
Report panels also lacked consistent section spacing.

## Changes and display policy

- Shared `StatCard` separates numeric value, optional unit, label and description.
  Counts use locale-aware integer grouping; money uses two decimal places and
  a separate KZT label. Calculations and persisted values remain unchanged.
- Zero and negative values render correctly. Missing/nonfinite values show
  Unavailable rather than a fabricated zero. Loading hides stale values.
- KPI grids use three columns from 1024px, two from 600px and one below 600px.
  Long values and labels wrap; cards use existing light/dark theme tokens.
- Home and Analytics use the component and consistent section gaps. Low-stock
  names, quantities and units have separate layout elements.
- Analytics uses semantic status summaries, explicit report definitions,
  right-aligned numeric columns and a keyboard-focusable horizontally scrollable
  supplier table on narrow screens. Monthly activity calculations are unchanged.
- Settings/Profile fields and security panels have explicit spacing.
- Empty workspace-status hosts no longer create extra dashboard grid gaps.
- Accessible metric labels, loading state, table headers and overflow-region
  labeling are retained or added. Skeletons have no motion.

## Files

| File | Change |
| --- | --- |
| `frontend/src/app/components/stat-card.ts` | Shared component and display constants |
| `frontend/src/app/components/stat-card.scss` | Metric card layout and responsive styles |
| `frontend/src/app/components/stat-card.spec.ts` | Five formatting/state tests |
| `frontend/src/app/pages/home.ts` | Dashboard cards, stock rows, section spacing |
| `frontend/src/app/pages/analytics.ts` | Report presentation and shared cards |
| `frontend/src/app/pages/analytics.scss` | Report spacing, columns and table layout |
| `frontend/src/app/pages/connection.ts` | Settings/Profile spacing |
| `frontend/src/app/pages/workspace-status.ts` | Empty-host layout correction |
| `frontend/src/styles.scss` | Shared KPI grid and stock-list styles |
| `frontend/e2e/visual-regression.spec.ts` | Viewport checks and screenshots |
| `backend/apps/purchasing/test_browser.py` | Isolated visual fixtures and targeted test selection |
| `docs/UI_VISUAL_REGRESSION.md` | This report |

No dependencies or production Django files changed.

## Executed verification

Windows, Chromium, real Angular/Django APIs and disposable PostgreSQL 17:

| Check | Result |
| --- | --- |
| Angular full suite | 101 passed, 0 failed, 0 skipped; 13 files |
| TypeScript `--noEmit` | Exit 0 |
| Angular production build | Exit 0; initial bundle 461.17 kB |
| Full Chromium suite | 9 passed, 0 failed, 0 skipped |
| Django browser integration wrapper | 1 passed, 0 failed, 0 skipped |
| Django system check in isolated runner | No issues |
| Targeted before and after captures | Each 1 browser test passed |

Browser coverage includes anonymous and all six roles across the five main
sections, registration/session restoration, forbidden requests, backend failure,
Copilot, catalog writes, Pending amendments and delivery. The new visual test
checks Home/Analytics KPI columns and overflow at 1440, 1280, 768, 390 and 375px.
It also checks Manager Products, Suppliers, Orders, Copilot and Settings at those
widths, plus narrow dark Analytics. Existing role scenarios cover desktop and
390px; this is not every role at every viewport.

Artifacts are local and ignored, under `backend/.runtime/visual-regression/`:

- `before/`: Home and Analytics at all five widths; computed layout JSON.
- `after/`: matching isolated before/after fixture captures and dark Analytics.
- `regression/`: final full-suite captures, including final KZT display on Home.

The paired before/after captures use the same synthetic database fixture setup.
Full-suite captures can include records created by earlier browser scenarios.
Desktop Home and mobile Analytics screenshots were visually inspected. These
screenshots are evidence, not pixel-baseline comparison tests.

An initial targeted capture exposed post-workflow assertions that assumed the
registration/CRUD scenarios had also run. Targeted mode now omits only those
unrelated postconditions; the full suite retains and passes all of them.
One sandboxed cluster launch was denied; the authorized isolated rerun passed.

## Reproduce on Windows

From the repository root:

```powershell
npm.cmd test --prefix frontend -- --watch=false
node frontend/node_modules/typescript/bin/tsc -p frontend/tsconfig.app.json --noEmit
npm.cmd run build --prefix frontend
cd backend
$env:JEDEL_BROWSER_TESTS='1'
$env:JEDEL_VISUAL_PHASE='regression'
Remove-Item Env:JEDEL_E2E_GREP -ErrorAction SilentlyContinue
python scripts/test_postgres.py apps.purchasing.test_browser
```

The browser runner requires existing Node dependencies and Playwright Chromium.
The PostgreSQL runner creates a separate temporary cluster and tears it down;
do not substitute a live database test configuration.

For manual review, start the normal documented backend and frontend, open Home
and Analytics as an authorized existing user, and resize to the five widths.
Check separate values/units/labels, keyboard scrolling in the supplier table,
light/dark themes and long low-stock names. As Basic User or anonymous, check
public previews and confirm private metrics remain absent.

## Safety and limitations

No live records, migrations, permissions, purchasing calculations, authentication
or production service logic were changed. No paid provider calls were made.
No commit, staging, push or merge was performed. Changes remain unstaged on
`feature/fullstack-integration-auth`; there was no open merge at task start.

The complete standalone backend regression suite was not rerun for this visual
change; the real-browser purchasing/session regressions passed. macOS, Safari,
Firefox, screen-reader output and a formal automated contrast/WCAG audit were
not verified. Supplier tables intentionally scroll internally on small screens.
