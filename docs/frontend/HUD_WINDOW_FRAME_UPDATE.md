# Full HD / 4K HUD window frame

Date: 2026-09-14. Environment: DEV. Branch: `codex/frontend-hud`. Comparison base: `a0b3af582612c999052f68def98d0477147fb549`.

## Result

Added an original SVG window frame inspired by the supplied reference: chamfered corners, a secondary inner rail, segmented edge accents, small index marks, and restrained cyan glow. It uses the HUD's existing cyan, muted blue and dark background palette. The decoration stays around the outside of the application; it introduces no additional operational readings or animation.

The frame is excluded from pointer input and the accessibility tree. Desktop content has a reserved inset and slightly tighter row spacing so all five lift cards, detail information, warnings and controls remain inside the frame. Existing lift animation and state logic were not changed.

The frame is enabled for these responsive viewport bands:

- At least 1800 x 900 CSS pixels.
- At least 1440 x 750 CSS pixels with device pixel ratio at least 1.25.
- At least 1200 x 650 CSS pixels with device pixel ratio at least 1.5.

These bands accommodate Full HD/4K and common Windows display scaling with room for browser chrome. They do not identify monitor hardware. A native 1366 x 768 viewport and mobile retain their existing presentation without this frame.

## Validation

| Check | Result |
| --- | --- |
| `npm run test` | PASS: 84 tests across 8 files |
| `npm run build` | PASS: TypeScript and Vite, 359 modules; final 8-unit frame spacing verified in production CSS |
| `node apps/web/scripts/frame-qa.mjs` | PASS: 9 results; zero browser page errors |
| Independent browser QA | All five lift selections work; normal, stale and warning states stay within the frame |
| Native fullscreen | Enter and exit confirmed through document.fullscreenElement |
| Visual inspection | Full HD and final 4K captures inspected |

Browser cases: Full HD 1920 x 1080; 4K 3840 x 2160; 4K at 200%; Full HD with viewport height reduced to 940; Full HD at 125% and 150%; native 1366 x 768; mobile 390 x 844. The last two correctly hide the frame. Scaling is browser emulation using viewport and device scale factor, not physical Windows-client acceptance.

QA found small internal detail overflow in the warning state at 125%/150%. Row spacing was adjusted to recover the needed height; the final run passes without hiding content or relaxing the overflow assertion.

Evidence: [Full HD](evidence/frame/full-hd.jpg), [4K](evidence/frame/4k.jpg), [125% warning](evidence/frame/full-hd-dpi-125-warning.jpg), [150% warning](evidence/frame/full-hd-dpi-150-warning.jpg), [browser measurements](evidence/frame/verification.json).

## Change scope and repository status

Files changed: `HudWindowFrame.tsx`, `hud-window-frame.css`, the HUD/import integration, `frame-qa.mjs`, this report, and formal screenshots/measurements in `docs/frontend/evidence/frame/`.

Audit result: PASS for this local frontend presentation change. Known issue: the existing Vite bundle-size warning remains (528.50 kB main JavaScript, 163.41 kB gzip); no performance benchmark is claimed. No new dependencies were added.

Remote: none configured at verification. Push status: BLOCKED / REMOTE_UNAVAILABLE. The newly appeared repository `AGENTS.md` requires remote verification and prohibits silently changing a remote without explicit authorization. This frame change is saved locally; it is not claimed as delivered to GitHub. The unrelated, untracked `AGENTS.md` is left unmodified and excluded from this feature commit.

Frozen contracts, backend, Windows client installer, hardware access and workflow gate records remain unchanged. G-A stays WAITING_FOR_G-A / BLOCKED_ON_POSTGRES_EXECUTION_EVIDENCE; G-U is not approved by this work. Dell deployment is NOT_RUN.

Next allowed action: Architect review of this frontend milestone; repository owner configuration/authorization is needed before publishing to a remote. No push, merge, deployment or gate approval was performed.
