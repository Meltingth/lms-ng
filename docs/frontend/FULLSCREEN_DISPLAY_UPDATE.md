# Fullscreen HUD and Windows client update

Date: 2026-09-14. Branch: `codex/frontend-hud`. Scope: local frontend display and deployment-time client setup prepared for Architect review.

## Result

The HUD now fills a desktop viewport at Full HD (2MP, 1920 x 1080) and 4K (3840 x 2160), scaling its typography, five lift glyphs, panels and spacing with the available display area. The large simulation banner is replaced by a compact TEST / SIMULATED or DEMO / SIMULATED badge in the header. The current fixture's provenance remains visible.

The Full Screen button enters and exits native browser fullscreen. Its state follows browser fullscreen changes, including Escape; unsupported or rejected requests give a short fallback message. The request is initiated by a button click because the [Fullscreen API requires transient user activation](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen).

Desktop rows fit within the viewport without page scrolling at the tested sizes. The events panel can scroll internally when it contains older events. The detail panel retains an overflow fallback for unusually long future content; current normal/stale fixture details fit without internal scrolling. Small screens retain a normal vertically scrolling layout and an internally scrolling lift strip.

The user confirmed Windows clients should start fullscreen when their user signs in. The prepared [Windows client installer](../../scripts/client/Install-HudClient.ps1) creates per-user Desktop and Startup shortcuts to Edge fullscreen kiosk, using an explicit deployment URL. The [client setup guide](WINDOWS_CLIENT_SETUP.md) contains install, update, removal and target-client acceptance instructions. No installation on a real user profile or Dell deployment was performed.

## Validation

| Check | Result |
| --- | --- |
| `npm run test` | PASS: 84 tests across 8 frontend test files |
| `npm run build` | PASS: TypeScript and Vite build, 357 modules |
| `node apps/web/scripts/display-qa.mjs` | PASS: 7 browser cases, zero page errors |
| `node apps/web/scripts/door-qa.mjs` with `HUD_QA_OUTPUT_DIR=docs/frontend/evidence/display/doors` | PASS: 7 door-animation regression checks, zero page errors |
| `tests/client/test-hud-client.ps1` | PASS: 37 temporary-fixture checks on PowerShell 7.6.5 and Windows PowerShell 5.1 |
| Independent frontend review | Decimal CSS conversion defect found and corrected; no further concrete findings |
| Root installer review | Checked direct Edge invocation, URL/path validation, ownership preflight, WhatIf, and removal scope |
| Screenshot review | Full HD and final 4K screenshots visually inspected |

The final browser run used installed Chrome 153.0.8010.36 and exercised real `requestFullscreen()` / `exitFullscreen()` in an isolated headless context. Windows DPI settings are represented by viewport/device-scale-factor combinations; these are browser emulations, not physical target-client acceptance.

| Display case | CSS viewport | Device scale factor | Outcome |
| --- | --- | --- | --- |
| Full HD / 2MP | 1920 x 1080 | 1 | No page overflow |
| 4K | 3840 x 2160 | 1 | No page overflow |
| 4K at 200% scaling | 1920 x 1080 | 2 | No page overflow |
| Full HD with browser chrome reducing available height | 1920 x 940 | 1 | No page overflow |
| Full HD at 150% scaling | 1280 x 720 | 1.5 | No page overflow |
| Native fullscreen button | 1920 x 1080 | 1 | Enter/exit confirmed via document.fullscreenElement |
| Mobile regression | 390 x 844 | 1 | No horizontal page overflow |

For each desktop case, the harness measured panel boundaries, all five lift cards, KPI content and normal/stale detail content. It also checked layout with stale data, a resnapshot warning and DEMO mode. Typography scaling is checked through computed styles. Door checks confirm dark RUNNING panels, progressive opening when STOPPED, closing on RUNNING, neutral stale/unknown state, reduced motion, and W-05's unplaced glyph.

Evidence: [Full HD](evidence/display/full-hd.jpg), [4K](evidence/display/4k.jpg), [display measurements](evidence/display/verification.json), [door regression](evidence/display/doors/verification.json). Earlier milestone evidence is retained.

The existing build-size warning remains: main JavaScript 526.42 kB / 162.46 kB gzip. This run is not a performance benchmark. Previously documented baseline contract/audit findings remain unchanged and were not reclassified by these frontend checks.

## Deployment status

The installer is ready to include in the future release package. It must be run on each Windows display client as that client's viewing user, supplying the actual approved Dell URL. Setup creates shortcuts without launching a browser; the Desktop icon launches on demand, and the Startup shortcut launches at the next user sign-in.

Real Desktop/Startup installation, Edge kiosk launch, Windows sign-out/sign-in, production authentication, target-client policy/network readiness and Dell deployment are **NOT_RUN**. The [Windows setup guide](WINDOWS_CLIENT_SETUP.md) records those acceptance steps and the documented kiosk behavior. The local website still uses simulated data.

Frozen contract `2.0.0-draft.2`, backend and database files, hardware access and `WORKFLOW_STATE.json` remain unchanged. G-A remains WAITING_FOR_G-A / BLOCKED_ON_POSTGRES_EXECUTION_EVIDENCE. No push, live cutover, gate approval, scheduled-task modification or deployment was performed. This completed frontend/client-preparation milestone is ready for Architect review.
