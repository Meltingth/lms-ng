# Milestone 01 required freshness corrections — review packet

Correction verification: **PASS** for the local SIMULATED HUD. Next allowed action: **WAIT_FOR_ARCHITECT**. This report does not approve G-U, pixel fidelity, LIVE integration or deployment.

Environment: DEV. Repository: lms-ng. Branch: `codex/frontend-hud`. Comparison base: `76e75765f8659e558da6ff945baa9365b3d98736`. Implementation, tests and these review assets are committed together; the frontend commit is recorded in the delivery response and can be resolved with `git log -1 --format=%H -- docs/frontend/FRESHNESS_CORRECTION_REVIEW.md`.

Remote: none configured. Push status: **BLOCKED / REMOTE_UNAVAILABLE**; no remote was added or changed. The pre-existing untracked root `AGENTS.md` remains unmodified and excluded from the correction commit.

## Corrections implemented

Removed the local 12-second threshold from active code, tests and current usage/specification documentation. The historical Milestone 01 report is preserved as evidence.

The ViewModel now exposes separate `sourceFreshness`, `fieldTransportFreshness`, `gatewayHeartbeat` and `serverConnection`, alongside the unmodified server-reported `connectionState`. The HUD displays source freshness and field transport independently. A stale source can therefore coexist with reported transport OK. The source-freshness KPI no longer treats browser connectivity as source evidence.

SIM source becomes STALE at 30 seconds; REAL source becomes STALE at 90 seconds. The pure REAL valid-frame classifier implements OK below 75 seconds, AGING from 75 to below 90, and NO_RXTX from 90. Gateway heartbeat becomes OFFLINE at 30 seconds.

A WebSocket disconnect immediately projects SERVER_DISCONNECTED, removes car interpolation and door transitions, and preserves the last confirmed source observation and anchor. The local reconnect scenario now disconnects the active session, allowing browser QA to interrupt actual in-flight motion without resetting the fixture first.

Reconciliation remains every 15 seconds. Repeated snapshots, status updates, heartbeat updates, changed receipt timestamps, older observations and missing/restored evidence cannot restart a source clock. Source and heartbeat evidence retain independent monotonic age anchors, bounded by the current assets/session. Only a distinct valid observation can establish a new age baseline. Invalid future heartbeat evidence remains UNKNOWN and cannot prevent later valid recovery.

## Required boundary evidence

| Boundary | Result |
| --- | --- |
| SIM source 29.999s | PASS: FRESH |
| SIM source 30s | PASS: STALE |
| REAL valid frame 74.999s | PASS: OK |
| REAL valid frame 75s | PASS: AGING |
| REAL valid frame 89.999s | PASS: AGING |
| REAL valid frame 90s | PASS: NO_RXTX |
| REAL source ST 89.999s | PASS: VALID |
| REAL source ST 90s | PASS: STALE |
| Gateway heartbeat 29.999s | PASS: ONLINE |
| Gateway heartbeat 30s | PASS: OFFLINE |
| WS disconnect | PASS: immediate SERVER_DISCONNECTED and cancellation of both motion flags and actual CSS motion |

Machine-readable results: [boundary-tests.json](evidence/freshness-correction/boundary-tests.json), including 11 exact predicate cases plus store, adapter and UI integration evidence. REAL cases use explicit local test ages; no REAL connection was started.

## Validation

| Check | Result / evidence |
| --- | --- |
| Frontend tests | **131 PASS / 0 FAIL**, 9 test files: [JSON](evidence/freshness-correction/frontend-tests.json), [console](evidence/freshness-correction/frontend-tests.txt) |
| TypeScript / Vite build | **PASS**, 361 modules: [build output](evidence/freshness-correction/frontend-build.txt) |
| Freshness browser QA | **16 PASS / 0 FAIL**: [browser-qa.json](evidence/freshness-correction/browser-qa.json) |
| Display regression | **9 PASS / 0 FAIL**, including Full HD, 4K and 125/150/200% scaling: [verification.json](evidence/freshness-correction/display/verification.json) |
| Independent read-only review | Replay/renewal edge cases corrected and re-reviewed; no remaining scoped correctness findings |
| Visual review | All five final PNG files opened and visually inspected |
| Protected paths / findings | **PASS**: [preservation.json](evidence/freshness-correction/preservation.json) |

Browser: installed Chrome 153.0.8010.36 in isolated local contexts. The browser checks simulated-clock freshness/reconciliation, actual car and door transition cancellation, retained confirmed anchors, recovery snapshots, alarms, unknown positions, DEMO isolation, reduced motion, fullscreen and mobile. There were zero page errors and zero external requests. Predicate tests provide exact millisecond boundaries; the displayed age normally updates on a one-second tick. Windows display scaling is emulated, not physical-client acceptance.

The existing Vite warning for a main JavaScript chunk above 500 kB remains (533.06 kB / 164.63 kB gzip). No performance or field-latency acceptance is claimed.

Reproduce from the repository root with the local preview running:

```powershell
npm run test
npm run build
node apps/web/scripts/freshness-qa.mjs
$env:HUD_QA_OUTPUT_DIR = 'docs/frontend/evidence/freshness-correction/display'
node apps/web/scripts/frame-qa.mjs
Remove-Item Env:HUD_QA_OUTPUT_DIR
```

## Actual screenshot files

These are the requested PNG files captured from the final application, not placeholders, aliases or references to old milestone images. Dimensions and SHA-256 hashes are recorded in browser-qa.json.

| File | Dimensions |
| --- | --- |
| [hud-desktop.png](evidence/freshness-correction/hud-desktop.png) | 1920 x 1080 |
| [hud-uncalibrated.png](evidence/freshness-correction/hud-uncalibrated.png) | 1920 x 1080 |
| [hud-stale.png](evidence/freshness-correction/hud-stale.png) | 1920 x 1080 |
| [hud-demo.png](evidence/freshness-correction/hud-demo.png) | 1920 x 1080 |
| [hud-mobile.png](evidence/freshness-correction/hud-mobile.png) | 390 x 2655, full-page capture |

## Changed files

Core: `model/freshness.ts`, `model/viewModel.ts`, `realtime/store.ts`, `realtime/client.ts`, local scenarios, and their boundary/regression tests under `apps/web/src/`.

Presentation: source/transport badges and selected-lift details, gateway heartbeat, WS disconnect message, source-freshness KPI, UI tests, and scoped detail spacing. Browser harnesses and current frontend README/HUD specification were updated. Full paths for every changed file and review asset are in [files-changed.txt](evidence/freshness-correction/files-changed.txt).

## Preserved findings and remaining assumptions

- **C01 FAIL remains open**, including the legacy baseline-path/fail-return finding: [original evidence](../audit/evidence/LOCAL_CONTRACT_2026-09-14_FINAL.json), [historical report](MILESTONE_01_REPORT.md). No audit result was rewritten to PASS.
- **ui-enums draft mismatch remains open** against draft.2. The frozen metadata was not patched.
- **Root Ajv advisory remains open**, including the original [dependency audit](evidence/dependency-audit.json). No root dependency or lockfile was changed.
- Frozen draft.2 WS exposes reported transportState but no independent valid-frame timestamp/age. Its ViewModel transport age stays null/UNKNOWN; deriving it from source ST age or browser receipt would be false. The REAL 75/90 classifier is ready and unit-tested with explicit input, while LIVE integration remains NOT_RUN.
- Local heartbeat projection assumes envelope sentAt and lastHeartbeatAt share a server clock domain. Production comparability, gateway association and stream lifecycle still require Architect/Backend confirmation.
- Existing normalized display anchors, conservative contiguous-revision gap handling, mock stream identities and gateway revision-baseline limitations remain local assumptions. The corrected freshness thresholds and 15-second reconciliation cadence are no longer unresolved policy choices.
- The frozen MQTT heartbeat description ties transport freshness to lastValidStateAt, conflicting with the explicitly required separate valid-frame/ST semantics. This additional metadata discrepancy is recorded for Architect/Backend review; the frozen description remains unchanged.

No changes were made to `contracts/`, `database/`, Claude backend code, WhizdomLift, Capture, COM, Scheduled Task, or workflow/gate records. No merge or deployment occurred. Contract identity remains `2.0.0-draft.2`, recorded hash `sha256:ed2414fb8e830a9c281499c9a5cff8ba441668acb5b98fbb2265a6da5e4d18b3`. G-A remains WAITING_FOR_G-A / BLOCKED_ON_POSTGRES_EXECUTION_EVIDENCE.

**nextAllowedAction = WAIT_FOR_ARCHITECT**
