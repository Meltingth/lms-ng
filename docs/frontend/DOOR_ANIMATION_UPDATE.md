# Lift icon door animation update

Implemented on codex/frontend-hud in response to the owner's requested motion visualization.

- RUNNING: two dark, closed door panes.
- STOPPED: panes slide apart to the left and right over 700ms; returning to RUNNING closes them.
- UNKNOWN or untrusted/stale/disconnected data: neutral striped panes and a question mark, with no transition.
- Reduced motion or the operator Animation switch: correct static pose without sliding.
- All five lifts use the same glyph. W-05's anchorless glyph stays inside the RAW CODE panel, retaining POSITION UNKNOWN; it is not placed on a building floor.
- W-04 keeps its OUT_OF_SERVICE and commissioning states.

This is explicitly a symbolic representation of Platform motion, not a claimed physical door sensor. The existing API contract has no measured door state. The shared view model separates trusted motion from known position so a raw-code lift can show known motion without inventing an anchor.

To try it locally: select **ประตู: วิ่ง ↔ จอด (จำลอง)**, then press **เดินข้อมูล 1 ขั้น**. Each click sends a fresh, local W-01/W-02 RUNNING/STOPPED observation. Confirmed floors, profiles and service states do not change. No DOOR_OPEN telemetry is fabricated.

Validation:
- PASS: frontend suite 76/76 tests, 7 files (12.84s).
- PASS: TypeScript and Vite build (355 modules).
- PASS: 7 browser checks, including measured intermediate/final panel transforms, reverse closing, dark surfaces, stale cancellation, reduced motion and mobile layout.
- PASS: captured running/stopped poses visually inspected.
- PASS: bounded independent code review; no blocking findings. Reviewer did not claim to rerun tests.
- Existing bundle-size warning remains: 524.65 kB main JS / 161.89 kB gzip. This is not a performance benchmark.

Evidence: [running/closed](evidence/doors/running-closed.jpg), [stopped/open](evidence/doors/stopped-open.jpg), [browser checks](evidence/doors/verification.json).
Reproduce browser check with the local preview running: `node apps/web/scripts/door-qa.mjs`.

Frozen contracts, backend, hardware access, gate records and deployment remain unchanged. Local frontend update only.
