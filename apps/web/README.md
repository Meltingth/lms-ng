# Local TEST Operations HUD

This is the mandate's first frontend foundation in the approved Vite + React + TypeScript layout. It is a local SIMULATED preview, with no Platform, MQTT, Capture, COM, or hardware connection.

From the repository root, using Node >=22.12:

```powershell
npm ci
npm run dev
npm run test
npm run build
npm run test:browser --workspace @lms-ng/web
```

The preview binds only to http://127.0.0.1:5173. The browser test requires that preview and an installed Chrome/Edge, or Playwright Chromium. Set HUD_BROWSER_EXECUTABLE to an explicitly selected browser path if needed. It launches an isolated headless browser and writes screenshots/results to docs/frontend/evidence. It never uses a signed-in browser profile.

Choose a local scenario and use **เดินข้อมูล 1 ขั้น** to deliver a new confirmed fixture observation. The local data does not move by itself: SIM source state becomes STALE at 30 seconds. Gateway heartbeat becomes OFFLINE at 30 seconds independently. Reconciliation stays at 15 seconds and never renews either observation. The normalized 0..1 anchors remain local fixture assumptions, not floor calibration.

The source.live envelope value does not certify LIVE origin: the local source.live session contains SIMULATED/TEST records. DEMO uses a separate session and SIMULATED/DEMO records. The store rejects LIVE origin, foreign sites, stale subscriptions, invalid schema frames, and TEST/DEMO mixing.

The frozen JSON Schema is the runtime authority. src/model/types.ts contains local presentation projections only; packages/contracts remains unchanged. MockAdapter can be replaced behind the store boundary when the Architect supplies the authorized REST /api/v2 and /ws integration decisions. A network PlatformAdapter is intentionally absent from this pre-G-A milestone.

The ViewModel keeps source freshness, field transport, gateway heartbeat and browser WebSocket connection separate. REAL source (90s) and valid-frame transport (75s/90s) boundaries are tested with local inputs; there is no LIVE integration. The frozen WS projection lacks a valid-frame age, so the HUD displays server-reported transport state with AGE UNKNOWN. Selecting **WS reconnect** disconnects the active local session immediately, preserves its last confirmed values, and stops rendering motion; **เดินข้อมูล 1 ขั้น** requests its recovery snapshot.

For the freshness correction review, run `node apps/web/scripts/freshness-qa.mjs` from the repository root with the preview running. It exports the actual `hud-desktop.png`, `hud-uncalibrated.png`, `hud-stale.png`, `hud-demo.png` and `hud-mobile.png` under `docs/frontend/evidence/freshness-correction/`, with browser results and SHA-256 metadata. Historical milestone evidence is retained.

See docs/design/HUD_SPEC_V2.md, docs/design/HUD_ACCEPTANCE.md, docs/design/ANALYTICS_DEFINITIONS.md and docs/frontend/MILESTONE_01_REPORT.md. This preview does not approve G-A/G-U or authorize deployment.
