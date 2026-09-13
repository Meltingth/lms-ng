# LMS-NG mandate execution — milestone 01

Date: 2026-09-14, Asia/Bangkok. Branch: codex/frontend-hud.

PASS: The immediate authorized work is implemented: independent QA harness and the first operational HUD using only local SIMULATED fixtures. This report is for System Architect review.

BLOCKED: G-A remains WAITING_FOR_G-A / BLOCKED_ON_POSTGRES_EXECUTION_EVIDENCE. G-U and the other gates remain unapproved. Deployment recommendation: DO_NOT_DEPLOY. NextAllowedAction: WAIT_FOR_ARCHITECT.

## filesChanged

Full inventory: [files-changed.txt](files-changed.txt).

- apps/web: Vite/React/TypeScript shell, five shafts and cars, status/detail/event/analytics panels, local scenario controls, runtime schema validation, realtime store, local fixtures, model/motion helpers, 66 tests and reproducible browser QA.
- packages/ui-kit: shared HUD tokens, frames, badges and numeric/heading components.
- package.json/package-lock.json/.gitignore: frontend workspaces, local scripts and locked dependencies; Node minimum >=22.12.
- scripts/audit, tests/audit, docs/audit: independent exact-SHA evidence harness, safe current-worktree contract wrapper, templates/instructions and captured findings.
- docs/design and docs/frontend: architecture/acceptance/analytics boundaries, screenshots, final logs and this delivery report.

PASS: Frozen contracts/, database/, tests/contract/, packages/contracts/, existing docs/evidence/ and WORKFLOW_STATE.json are unchanged. WhizdomLift remains on its original branch and unchanged; the user's mandate file remains untracked there. Operational logs and Capture were not accessed or altered.

## commitsCreated

| Commit | Purpose |
| --- | --- |
| 04b2096587110807e465c2e394a85be02df53e31 | test(qa): independent exact-commit audit harness |
| 296ed875e8e429d3d1837f45f6df6d951c51554c | feat(hud): SIMULATED operations frontend and tests |
| Delivery documentation commit containing this report | Resolve with git log -1 --format=%H -- docs/frontend/MILESTONE_01_REPORT.md |

Local commits only. No push, merge to main, approval tag, external site registration or deployment.

## testsRun

| Check | Result | Evidence |
| --- | --- | --- |
| Frontend Vitest suite | PASS — 66/66 tests, 6 files, 8.35s | evidence/frontend-tests.txt |
| TypeScript + production frontend build | PASS — 354 modules, Vite build 9.85s | evidence/frontend-build.txt |
| Actual local browser QA | PASS — 10 grouped checks, Chrome 153.0.8010.36 | evidence/browser-qa.json; evidence/browser-run.txt |
| Independent QA harness | PASS — 17/17 tests, 51.266s | ../audit/evidence/HARNESS_2026-09-14.tests.txt |
| Frozen candidate identity / recorded gates | PASS — 38 included files, exact pin | evidence/frozen-final.json |
| Existing C01-C08 contract checks | FAIL — 7 PASS / 1 FAIL | ../audit/evidence/LOCAL_CONTRACT_2026-09-14_FINAL.json |
| npm dependency audit | FAIL — 1 pre-existing moderate root AJV advisory | evidence/dependency-audit.json |
| PostgreSQL execution | BLOCKED — mandate prerequisite remains outstanding | unchanged WORKFLOW_STATE.json |
| Backend/live end-to-end, security/auth/ACL, field faults, deployment | NOT_RUN | local TEST scope only |

Runtime: Node 24.15.0, npm 11.12.1, Python 3.14.4 for QA harness, Windows workstation. The existing .venv launcher refers to unavailable C:\Python312; the wrapper used compatible installed Python dependencies without changing that environment. Final frontend tests/build/browser checks preceded only BOM/trailing-newline cleanup; no behavior changed afterward.

## screenshots/evidence

- [Desktop operations HUD](evidence/hud-desktop.png)
- [Unknown/uncalibrated detail](evidence/hud-uncalibrated.png)
- [Stale telemetry](evidence/hud-stale.png)
- [DEMO session](evidence/hud-demo.png)
- [Mobile / W-04 service state](evidence/hud-mobile.png)

PASS: Desktop and mobile captures were visually inspected. Browser tests exercise actual CSS intermediate positions, stopping at the confirmed anchor, stale transition cancellation, endpoint containment, keyboard selection, alarms, reconnect/gap recovery, DEMO exit, reduced motion, and mobile overflow. No page errors or external resource requests occurred.

These are review screenshots, not an approved pixel-regression baseline. FPS, memory growth, CPU and production latency remain NOT_RUN. The internal browser automation runtime failed to initialize; the same local preview was successfully verified using an isolated headless Chrome session via the committed Playwright script.

Local preview: http://127.0.0.1:5173/ while npm run dev is running. The local development server was left available for review.

## knownIssues

FAIL: Legacy C01 hard-codes the missing WhizdomLift-wt/feature-lms-ng-revise-v2 baseline path. It records FAIL and returns without an assertion, allowing pytest to falsely appear successful. The new wrapper retains FAIL. A matching filename at the current WhizdomLift path is not sufficient proof of baseline-byte identity. Recommended owner/Architect correction: configure and verify the intended baseline, then make missing input fail consistently. Original tests were not silently patched.

NOT_RUN: Legacy C07 does not assert the complete 44-code service uncalibrated set and is static SQL-text validation only. The new frontend fixture tests cover raw codes 3..46 as UNCALIBRATED/null-anchor responses, but do not supply database execution evidence.

FAIL: npm audit reports one moderate advisory for the existing root validator Ajv 8.17.1 (GHSA-2g4f-4pwh-qvx6, conditional on $data usage). Root contract-validator dependency was preserved; frontend uses Ajv 8.20.0 and patched Vitest 4.1.11. Upgrade/reverify the old validator in its own authorized correction; no exploit or production security claim is made here.

NOT_RUN: The main frontend JavaScript chunk is 523.11 kB / 161.34 kB gzip; Vite warns above 500 kB. This is a measured artifact size, not a runtime-performance result. Revisit validator precompilation or splitting after the Architect approves the generated-contract/tooling boundary.

BLOCKED: Frozen ui-enums.yaml reports draft.1 while the release manifest/version pin is draft.2. This existing metadata discrepancy is recorded for review without altering frozen bytes.

BLOCKED: Production snapshot ordering, gateway revision baselines, heartbeat shape, anchor units and freshness policy need Architect decisions. The TEST preview must not be treated as ready for LIVE integration.

## contractAssumptions

ContractVersion: 2.0.0-draft.2
ContractHash: sha256:ed2414fb8e830a9c281499c9a5cff8ba441668acb5b98fbb2265a6da5e4d18b3

Backend owns floorDisplay/floorKind/floorProfileVersion/displayAnchor. Frontend never computes floorRaw minus an offset. Literal passenger fixture tuples align with database/seeds/whz.sql; W-05 known labels remain 1->B1, 2->1, 47->44, with 3..46 uncalibrated. Fixture coordinates are normalized 0..1 schematic values only.

Local assumptions: 12-second stale threshold, 15-second resnapshot interval, conservative contiguous-revision gap detection, mandatory mock envelope identities, and one explicitly identified mock gateway. These do not amend the frozen contract. Detailed decisions are in [HUD_SPEC_V2.md](../design/HUD_SPEC_V2.md).

## backendDependencies

BLOCKED: Authorized TEST Platform with scoped REST /api/v2 and /ws authentication, snapshot/buffer/watermark ordering, server/dataset/subscription lifecycle, gateway-to-lift association, authoritative floor profiles and freshness/clock quality, alarm/event API and approved historical analytics definitions. The frozen GatewayStatus snapshot does not supply an initial gateway revision. The future PlatformAdapter is a documented seam; no network implementation exists in this milestone.

## nextFrontendMilestone

WAIT_FOR_ARCHITECT: Review the operational HUD and local assumptions, assign minimum corrections, and approve the next frontend scope. A subsequent authorized TEST milestone can add the PlatformAdapter, confirmed event/alarm integration and measured analytics after backend/gate dependencies are satisfied. Presentation/map polish, G-U approval, field canary and deployment remain separate decisions.

## auditHarnessStatus

PASS: Scaffold captures an explicitly supplied full commit SHA and comparison-base SHA, its diff/changed files/dependencies/source identities, independent frozen pin/gate records, and a complete PASS/FAIL/BLOCKED/NOT_RUN audit template. It refuses overwrite and does not execute reviewed code. Synthetic tests verify its safety boundaries.

BLOCKED: No new functional Claude submission SHA/base was supplied for this milestone. No actual Claude audit or approval was fabricated. Future functional reviews must use codex/audit-<phase>-<claude-sha> in a separate checkout. Harness preparation was kept in its own local commit on this foundation branch and contains no backend changes.

STOP: Work is handed back for System Architect review. No gate is self-approved.
