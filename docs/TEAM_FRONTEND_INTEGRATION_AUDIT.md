# Team frontend integration: pre-merge audit and approval gate

Status: BLOCKED ON PRESERVATION COMMIT APPROVAL. No merge or source integration has been performed. This report records read-only review plus a private source snapshot, not an integrated/tested result.

## Git state and incoming history

- Current branch: feature/fullstack-integration-auth. No upstream is configured for this integration branch.
- HEAD/local main: 892ecb7feb63857465b07b05fdcf82ab4baa2243.
- Local commits not on any remote: 0. HEAD is an ancestor of origin/main, behind by 3 commits.
- Before audit: 38 modified tracked files, 94 untracked files, 0 staged files; no in-progress merge. Local auth/RBAC/AI/infrastructure work exists as working-tree changes, not unpublished commits.
- git fetch origin completed successfully without changing working files. origin/main = 0d0fe0f538d02b7beacda1f489fd88962b730759. origin/frontend = 7ab2378361a0766b03a4a9c00beb8fca2da93218.

| Incoming commit | Branch/source | Contribution |
|---|---|---|
| 7ab2378361a0766b03a4a9c00beb8fca2da93218 | origin/frontend; already included in origin/main | Aslan: Improve purchasing workspace and responsive layout |
| 7cc8a94 | origin/erp-app-testing; already merged into main | Yerbolat: Add erp_app application role |
| 0d0fe0f | origin/main | Merge PR #4 from erp-app-testing |

Other remote branches: bekarys-business-logic (bd6fce2), docs/business-concept (05f1276), roles-security (12633bf). Bekarys business-logic and original roles-security work are already in the local baseline. docs/business-concept is not part of this requested frontend delta; it will not be blindly merged as an unrelated branch.

## Local preservation and secret controls

All 132 initial modified/untracked source files were copied byte-for-byte and SHA256-verified in this private Git-ignored directory:

`D:\BIS_project\jedel-group-database\backend\.runtime\integration-preservation\20261112T173039Z`

Its manifest.json records the exact file list, checksums, initial branch/HEAD and incoming revisions. A fresh comparison after the review confirms all original 132 working files remain byte-identical. Private snapshots are filesystem preservation, not a substitute for a reviewable Git commit. No stash, reset, checkout, staging or blanket conflict choice was used.

backend/.env, root .env, virtual environments, node_modules, build outputs, backups, runtime logs and browser artifacts are excluded from candidate files by the existing ignore rules. git ls-files found no tracked .env/backups/virtual-environment/node_modules/browser-output artifacts in the checked patterns. A targeted API-key-pattern scan found 0 candidate hits; this is not a comprehensive credential audit. Existing test credentials/placeholders and fictional CSV input are test data, not real accounts. No real credentials were printed or copied into the source snapshot. The real .env and ignored runtime directories remain in place, untouched.

The exact proposed preservation commit list is [INTEGRATION_COMMIT_CANDIDATES.txt](INTEGRATION_COMMIT_CANDIDATES.txt): **134 files** (the original 132 plus these two audit/list documents). This list is for review only; nothing is staged. Recompute and recheck it if any source changes before approval.

## Incoming frontend review

The frontend commit changes 16 files, including one new demo-registration service; there are no deletions/renames. Package.json, lockfile, Angular config, API proxy, routes and main HTTP bootstrap are unchanged by that incoming commit. There are no new frontend dependencies to reconcile from upstream, but the local Playwright/dependency additions must be preserved.

| Area | Incoming change | Classification / integration requirement |
|---|---|---|
| App shell / navigation | New branded header, workspace bar, persisted light/dark preference, query-insensitive active links | Requires integration: retain current Auth restore/logout/profile menu, unified Account, capability navigation and AI Assistant; theme-only localStorage is acceptable |
| Global styles | Broad responsive design and CSS variable rewrite | Potentially breaking: adapt styles for public previews, auth card/profile menu, Admin links, analytics and Copilot; verify keyboard/mobile/dark contrast |
| Home | Purchasing workspace overview, shortcuts and manual demo/connect actions | Conflicting: preserve anonymous public introduction and protected real dashboard; never replace unavailable PostgreSQL with demo metrics |
| Products | Search/category cards, expandable optional descriptions, supplier history derived from noncancelled orders | Requires integration: preserve public-safe catalog, authorized CRUD/delete, stock/price privacy; supplier history is private historical association, not current offers |
| Suppliers | Directory cards, contact/address search and order links | Conflicting: incoming component omits local authorized create/edit/delete forms; retain safe public preview and private CRUD/address filter |
| Orders | New layout, reactive query-param prefilling, keyboard focus for details, date validation and workflow controls | Conflicting: preserve Pending amendments, capability checks, conflict handling and existing service-backed transitions; do not create a second receipt implementation |
| Register | Session-memory demo profiles with duplicate-email form feedback | Obsolete for production authentication: retain real unified /auth registration/session workflow; adopt useful presentation/validation only, never demo success |
| API adapter and test | Explicit product write-field whitelist | Compatible in intent; clean text preview. Preserve session/CSRF/profile lifecycle and existing typed API handling; do not send optional descriptions to unsupported backend fields |
| Models/demo seed | Optional product description and sample descriptions | Demo-only optional field; actual PostgreSQL/API has no description. Show honest missing-data state in live mode, no fabricated descriptions or schema changes |
| Tests / docs | Reactive query-param and demo-registration coverage, new UI/readme | Requires integration: preserve existing full auth/RBAC/AI/e2e suite; replace obsolete token/demo onboarding and adapt assertions to final UI |
| Analytics / AI / auth guards | No incoming implementations/changes | Preserve current local routes/services/permissions completely; incoming shell has no AI or analytics link |

Upstream still documents manual bearer tokens and memory-only registration. The local system has individual Django sessions, CSRF, six roles and real account registration. These are different application generations: visual improvement must be ported onto the integrated behavior, not treated as an interchangeable replacement. Incoming Products/Suppliers are read-oriented and cannot replace local management screens wholesale.

## Read-only conflict preview

A git merge-file -p preview compared current local files with HEAD as common base and origin/main as incoming. CRLF was normalized only in temporary preview copies. No preview output was applied to the working tree or index. Actual Git conflict boundaries can differ after committing/normalization; this is a prediction, not a completed merge.

| Overlapping file | Predicted conflict hunks |
|---|---:|
| frontend/README.md | 2 |
| frontend/src/app/app.ts | 2 |
| frontend/src/app/core/data/api-data.service.spec.ts | 0 |
| frontend/src/app/core/data/api-data.service.ts | 0 |
| frontend/src/app/pages/home.ts | 1 |
| frontend/src/app/pages/orders.html | 3 |
| frontend/src/app/pages/orders.ts | 5 |
| frontend/src/app/pages/pages.spec.ts | 3 |
| frontend/src/app/pages/products.ts | 2 |
| frontend/src/app/pages/register.ts | 1 |
| frontend/src/app/pages/suppliers.ts | 2 |

Summary: 11 overlapping tracked paths, 9 with textual conflicts, 21 predicted conflict hunks. No incoming-added/local-untracked path collision. The two API adapter files preview cleanly but remain subject to semantic review. Actual merge conflicts found/resolved: none yet, because no merge has started.

## PostgreSQL contribution and safety

origin/main also changes database/roles.sql to create an erp_app LOGIN role inheriting role_manager and grant DELETE on purchase_order_items. This is an upstream SQL-file contribution, not Django Group provisioning. Preserve it in the eventual source merge and review its operator instructions/idempotency separately. Do not execute it or change live connection credentials as part of this integration. No migrations, SQL scripts, database reads/writes, stock changes or delivery replay occurred in this audit.

## Approval required before integration

Direct merging is unsafe with overlapping uncommitted files. At user instruction, stop here instead of stashing, overwriting or merging around them. Recommended next approved operation: stage only the 134 reviewed candidates and make one preservation commit on feature/fullstack-integration-auth. Proposed message:

`Preserve integrated ERP authentication, RBAC, public pages and procurement Copilot`

After that approval and successful commit, merge origin/main into the existing integration branch with --no-ff --no-commit; manually adapt/resolve the listed conflicts, preserving both the incoming design and local functionality. That merge does not merge into main and does not authorize its final merge commit or publication. Before each commit, show its staged diff and obtain the required approval. No separate merge of origin/frontend is needed because main already includes that exact commit.

## Verification and publication plan (NOT executed)

After source integration, run Django system checks, full isolated PostgreSQL backend tests, all frontend tests/build and all Chromium scenarios, including public/Basic/Manager/Admin/Copilot and privacy checks. Preserve deterministic quote arithmetic, no-key local tools and optional provider disabled for tests. Run no live writes. Verify theme/mobile changes against public previews and every protected operation. Validate dependency lock/config and Compose; report macOS as unverified unless actually tested on macOS.

No application/backend/browser tests were run in this audit: there is no integrated application yet. Prior testability results are historical baseline evidence, not post-merge passes. No source/backend functionality was changed, so preservation is evidenced by the 132 matching file hashes, not a fabricated integration test result.

Future commands only after the corresponding approvals and completed verification:

```powershell
# After approval: create the source preservation commit on the current branch.
# After that commit: begin the reviewed merge, leaving its final commit uncreated.
git merge --no-ff --no-commit origin/main
# After resolving/reviewing/testing and separate commit approval: create final merge commit.
# After explicit push approval:
git push -u origin feature/fullstack-integration-auth
# If GitHub CLI is available, after publication approval:
gh pr create --base main --head feature/fullstack-integration-auth --title "Integrate team frontend with ERP sessions, RBAC and Copilot" --body-file <reviewed-pr-description-file>
```

Main is not checked out or merged locally. Use a reviewed PR/branch protection for any eventual main merge; no force push is proposed. Real database migration/SQL-role application and paid AI smoke tests require separate approvals, not implied by Git integration.
