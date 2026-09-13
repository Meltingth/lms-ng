# HUD acceptance evidence — foundation only

This records local verification. G-U visual acceptance remains pending owner/Architect review.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Five shafts, selection, details, event stream | PASS | OperationsHud.test.tsx; browser checks; hud-desktop.png |
| UP, DOWN, IDLE, UNKNOWN; confirmed 20 -> 21 | PASS | Component/fixture/model tests and measured browser interpolation |
| No extrapolated floor; raw values remain opaque | PASS | Known-target motion tests; literal W-05 cases; schema and presentation review |
| Stale/age, offline gateway, degraded connection, TIME_UNCERTAIN | PASS | Store/view-model/component tests; hud-stale.png |
| W-04 OUT_OF_SERVICE independent of commissioning/connection | PASS | Component/browser tests; hud-mobile.png |
| W-05 raw code/UNCALIBRATED and unknown position | PASS | All 44 uncalibrated fixture cases; detail/shaft tests; hud-uncalibrated.png |
| Alarm shown without waiting for motion | PASS | Component/browser checks |
| Snapshot -> delta; duplicate/old/gap; reconnect/resnapshot | PASS | Store/client tests and browser recovery check |
| Gateway revision retained after same-dataset snapshot | PASS | Regression test and independently repeated replay reproduction |
| TEST/LIVE label distinction and isolated DEMO banner | PASS | Component-only LIVE badge test; LIVE rejected by store; hud-demo.png |
| Reduced motion, keyboard operation, mobile layout | PASS | Component/browser checks, 390px screenshot and no document overflow |
| Real CSS interpolation and endpoint containment | PASS | Browser bounding-box samples plus isolated geometry probes at 0/1 |
| Runtime page errors / unexpected external requests | PASS | Browser report: zero page errors, zero external resource requests |
| Owner-approved pixel regression baseline / G-U | BLOCKED | Screenshots are proposed review evidence, not approval |
| Real Platform authentication/REST/WS | NOT_RUN | MockAdapter only |
| API/DB/Redis/MQTT failures, field hardware, deployment | NOT_RUN | No such connection or authorization in this milestone |
| FPS, long-run memory/CPU and field latency targets | NOT_RUN | Not measured; build bundle sizes are not latency/FPS evidence |

Final frontend suite: 66 tests in 6 files, PASS. Browser suite: 10 grouped checks, PASS. Build/typecheck: PASS, with the bundle-size warning retained.

Evidence lives in ../frontend/evidence. Desktop and mobile images were visually inspected; no clipping of primary operational content or page-level horizontal overflow was observed. The mobile shaft region intentionally scrolls horizontally. Cross-browser coverage is limited to Chrome 153.0.8010.36 on this Windows workstation.

Independent review corrections included gateway replay ordering, raw-code detail headings, car endpoint containment, and literal passenger fixture labels. No frozen Contract or backend implementation was changed to obtain these results.
