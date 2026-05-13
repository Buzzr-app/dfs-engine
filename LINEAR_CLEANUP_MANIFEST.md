# Linear Cleanup Manifest

Generated for the Buzzr npm zero-bug release pass on 2026-05-13.

This file started as an approval checkpoint. Linear cleanup actions performed after explicit user approval are logged below.

## Action Log

- 2026-05-13: User approved deleting the exact visible board items in a screenshot. The Linear connector did not expose issue hard-delete, so these issues were moved to `Canceled` with cleanup marker comments: `BUZ-365`, `BUZ-366`, `BUZ-367`, `BUZ-368`, `BUZ-369`, `BUZ-370`, `BUZ-371`, `BUZ-372`, `BUZ-373`, `BUZ-221`.
- 2026-05-13: User asked to finish Buzzr Bets. Completed parent trackers whose child issues were already all `Done`: `BUZ-390`, `BUZ-391`, `BUZ-392`, `BUZ-393`, `BUZ-394`, `BUZ-395`, `BUZ-397`, `BUZ-398`, `BUZ-399`, `BUZ-400`, `BUZ-402`.
- 2026-05-13: Created Linear project `Buzzr Bets Completion` (`7f424daf-e435-4f78-a2a9-433681b414ac`, https://linear.app/buzzr/project/buzzr-bets-completion-1c6572424952) and milestones `M0` through `M9`.
- 2026-05-13: Created `BUZ-455` for the active first task, `Locate or clone real Buzzr app repo and confirm package/app boundary`, assigned to Sarvesh.
- 2026-05-13: Completed `BUZ-455`. The real Buzzr app repo is available at `/Users/sarveshchidambaram/Desktop/Projects/Buzzr/Buzzr`, resolving to `/Volumes/ExtremeSSD/Projects/_archive/Desktop-Projects-20260512/Buzzr/Buzzr`, with remote `https://github.com/gangisettyrushil10/Buzzr.git`.
- 2026-05-13: Linear issue creation hit the workspace free issue limit after `BUZ-455`. The remaining Buzzr Bets completion ticket matrix is stored in the `M0` through `M9` milestone descriptions until the workspace limit is lifted or old issues are hard-deleted manually.
- 2026-05-13: Superseded old open Buzzr Bets backlog items were moved to `Canceled` with cleanup marker comments: `BUZ-389`, `BUZ-401`, `BUZ-403`, `BUZ-438`, `BUZ-439`, `BUZ-440`, `BUZ-444`, `BUZ-445`, `BUZ-446`, `BUZ-447`, `BUZ-448`, `BUZ-449`, `BUZ-450`, `BUZ-451`, `BUZ-452`, `BUZ-453`.
- 2026-05-13: Started the app-side `M0` package boundary. `@buzzr/bets-core@3.0.0` was repacked with zero runtime dependencies and structural DFS settlement input types so the mobile app can adopt it without pulling a second `@buzzr/dfs-engine` version. The app repo now vendors `vendor/npm/buzzr-bets-core-3.0.0.tgz`, imports it from `src/features/bets/services/fair-line-service.ts`, and has `tests/unit/bets/bets-core-package-contract.test.ts` covering fair-line, ROI rollup, and DFS adapter contracts. Verification passed: package `npm run verify`, app `npm run typecheck`, app full Jest (`472` suites / `3690` tests), and app/package `npm audit --audit-level=high`.

## Keep Active

- `BUZ-454` — Finish Sentry ops routing for Buzzr 1.4.1. Keep as the single live bug intake/ops routing ticket until Sentry can create Linear issues automatically.

## Hard-Delete Candidates: Obvious Noise Or Already-Canceled Duplicates

- `BUZ-362` — codex linear test.
- `BUZ-197`, `BUZ-198` — broad roadmap duplicates already in `Duplicate`.
- `BUZ-352`, `BUZ-353`, `BUZ-354`, `BUZ-355`, `BUZ-356`, `BUZ-357` — social/growth ideas already canceled or superseded by newer concepts.
- `BUZ-252`, `BUZ-253`, `BUZ-259`, `BUZ-261`, `BUZ-262`, `BUZ-265`, `BUZ-267`, `BUZ-268`, `BUZ-321`, `BUZ-324`, `BUZ-325`, `BUZ-326`, `BUZ-327`, `BUZ-328`, `BUZ-329`, `BUZ-332` — March Madness duplicate/canceled lane tickets that should not remain visible.

## Hard-Delete Candidates: Completed Old Feature Waves

- Share Rating Card Phase 1 completed wave: `BUZ-376`, `BUZ-377`, `BUZ-378`, `BUZ-379`, `BUZ-380`, `BUZ-381`, `BUZ-382`, `BUZ-383`, `BUZ-384`, `BUZ-385`, `BUZ-386`, `BUZ-387`, `BUZ-388`.
- Buzzr Bets completed child tickets that should be removed from active board views: `BUZ-407`, `BUZ-408`, `BUZ-410`, `BUZ-424`, `BUZ-425`, `BUZ-426`, `BUZ-427`, `BUZ-428`, `BUZ-429`, `BUZ-430`, `BUZ-431`, `BUZ-432`, `BUZ-433`, `BUZ-435`, `BUZ-436`, `BUZ-437`, `BUZ-441`, `BUZ-442`, `BUZ-443`.
- Older completed mobile-app cleanup/bug tickets not relevant to this package release: `BUZ-278`, `BUZ-282`, `BUZ-283`, `BUZ-285`, `BUZ-287`, `BUZ-288`, `BUZ-300`, `BUZ-301`, `BUZ-310`, `BUZ-311`, `BUZ-313`, `BUZ-320`.

## Hard-Delete Or Cancel Candidates: Obsolete Seasonal Work

- Project `8beca4b8-5b99-408e-a412-9961c3e14a0e` — March Madness Mode. Target date was 2026-04-07 and the current npm package release does not use this project.
- Completed/stale March Madness issues: `BUZ-202`, `BUZ-204`, `BUZ-212`, `BUZ-213`, `BUZ-217`, `BUZ-227`, `BUZ-230`, `BUZ-232`, `BUZ-235`, `BUZ-236`, `BUZ-237`, `BUZ-238`, `BUZ-239`, `BUZ-242`, `BUZ-243`, `BUZ-244`, `BUZ-247`, `BUZ-249`, `BUZ-263`, `BUZ-266`, `BUZ-272`, `BUZ-274`, `BUZ-275`, `BUZ-277`, `BUZ-330`, `BUZ-331`, `BUZ-333`, `BUZ-334`, `BUZ-335`, `BUZ-336`, `BUZ-337`, `BUZ-338`, `BUZ-339`.
- NBA Playoffs open seasonal backlog to delete or cancel for this pass: `BUZ-363`, `BUZ-364`, `BUZ-365`, `BUZ-366`, `BUZ-367`, `BUZ-368`, `BUZ-369`, `BUZ-370`, `BUZ-371`, `BUZ-372`, `BUZ-373`, `BUZ-374`, `BUZ-375`.

## Hard-Delete Or Cancel Candidates: Broad Mobile-App Backlog

- Project `164d191d-0dcb-4c7f-92d8-9cc5620d1e50` — broad Buzzr mobile app project; not relevant to the npm package release.
- Project `48d130e0-ff58-4575-9fe8-12e37b2bd34c` — Share Rating Card Phase 1; all listed wave work is completed and not package-release scope.
- Project `8889d606-2850-4963-a77f-115ad468b6dc` — Buzzr Bets; strategically interesting but outside this package-first pass.
- Open broad backlog issue candidates still outside the package/Buzzr Bets completion pass: `BUZ-35`, `BUZ-93`, `BUZ-184`, `BUZ-218`.
- Superseded Buzzr Bets items now canceled or already completed: `BUZ-221`, `BUZ-389`, `BUZ-390`, `BUZ-391`, `BUZ-392`, `BUZ-393`, `BUZ-394`, `BUZ-395`, `BUZ-397`, `BUZ-398`, `BUZ-399`, `BUZ-400`, `BUZ-401`, `BUZ-402`, `BUZ-403`, `BUZ-438`, `BUZ-439`, `BUZ-440`, `BUZ-444`, `BUZ-445`, `BUZ-446`, `BUZ-447`, `BUZ-448`, `BUZ-449`, `BUZ-450`, `BUZ-451`, `BUZ-452`, `BUZ-453`.

## Required Approval Before External Action

Before any destructive Linear action, approve one of these exact paths:

1. Hard-delete every candidate listed above, preserving only `BUZ-454`.
2. Hard-delete only the `Obvious Noise`, `Completed Old Feature Waves`, and `Obsolete Seasonal Work` groups.
3. Use the safer fallback: move candidates to `Canceled` with a cleanup marker and leave hard deletion for manual Linear UI cleanup.

The current Linear connector exposes issue update/cancel operations, but not an explicit issue hard-delete operation. If hard delete is approved and still unavailable through the connector, the fallback is option 3 unless you explicitly approve browser/UI deletion.

## Current Linear Limitation

The workspace is at Linear's free issue limit. New issue creation is blocked with:

> Usage limit exceeded - You've exceeded the free issue limit for this workspace.

The new `Buzzr Bets Completion` project is still usable today through `BUZ-455` plus the milestone descriptions. To expand every planned milestone bullet into first-class Linear issues, upgrade the workspace or hard-delete old completed/canceled issue history from the Linear UI.
