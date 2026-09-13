---
docType: DESIGN_REQUIREMENT
status: ACCEPTED_AS_REQUIREMENT_NOT_IMPLEMENTED
targetPhase: P1-OFFLINE (build), gates P2-CANARY / G-C (consumes)
recordedAt: 2026-09-13
ownerDecision: "2026-09-13, G-A review round 3 -- per-lift hold/ownership design accepted as a requirement. Implementation/deployment remains forbidden before an allowed phase. log_lift.py stays unedited."
---

# Design requirement: per-lift capture ownership/hold, without touching `log_lift.py`

**Updated 2026-09-13 (G-A review round 2)** — the owner reaffirmed this requirement and gave an
explicit six-item capability list. Traceability table added below; the design itself (further
down this document) is unchanged, since it already covered five of the six and the sixth
("rollback health verification") is now called out as its own explicit bullet rather than left
implicit inside the rollback command's description.

## Required capabilities — owner's explicit list, mapped to this design

| # | Owner's requirement (verbatim intent) | Where this design covers it |
|---|---|---|
| 1 | HOLD เฉพาะหนึ่ง lift (hold exactly one lift) | "Required shape" item 1 — per-lift hold marker, never a single global flag |
| 2 | Verified PID/ownership before stopping | "Required shape" item 2 |
| 3 | Scheduled Task ไม่ restart logger ตัวที่ HOLD (the Scheduled Task must not restart a held logger) | "Required shape" item 4, "Watchdog awareness" |
| 4 | lift อื่นยัง capture ต่อ (the other lifts keep capturing) | "Required shape" item 3, third bullet — the rollback command "does NOT touch the other three lifts' running processes, PID files, or hold markers at any point" |
| 5 | known-good logger rollback ไม่ import module ใหม่ (rollback never imports a new module) | "Explicit constraint" section, and "Required shape" item 3, second bullet — restarts from the immutable release copy's own vendored `pyserial`, not a new dependency |
| 6 | **Rollback health verification** | **New, explicit below** — was previously only implied inside the rollback command's description; now its own requirement |

**Requirement 6, made explicit:** after a per-lift rollback restarts the known-good logger, the
control-plane layer must independently confirm that lift is actually healthy before considering
the rollback complete — not merely that the process started. The existing
`capture_status.py`/`lift_health.py` tools already define what "healthy" means for a lift
(`CAPTURING` vs `STALE` vs `DEGRADED`, per CLAUDE.md's own tool table) and should be the
verification mechanism reused here, called against the one rolled-back lift specifically, not
assumed from "the process is still running" alone (a process can be running and stalled —
CLAUDE.md's own `STALL` vs `RESTART` distinction in `board_alive.py` exists for exactly this
reason).

**This document records a requirement. It implements nothing.** No code in this repository or
in the WhizdomLift feature worktree implements this mechanism. It is out of scope until G-A is
approved and P1-OFFLINE is reached, and even then it is design/build work, not something this
round performs.

## The blocker this closes

`log_lift.py` (deployed, `D:\WhizdomLift`, read again as of this round — lines 48, 71, 398-399,
451) implements exactly one stop mechanism: a single `STOP_CAPTURE` file in the working
directory, checked by every running logger before starting and on every loop iteration.
Creating it stops **all four** loggers that share that directory. There is no way, in the code
that is actually deployed right now, to stop or hand off one lift's logger without stopping the
other three. This directly contradicts revision R04 / plan section E.2 step 2 ("ห้ามใช้ global
STOP_CAPTURE ... ที่หยุดทุกลิฟต์") and is why P2-CANARY / Gate G-C stays blocked regardless of
G-A's outcome.

## Explicit constraint: do not refactor the deployed logger

The owner's governing instruction for this whole round is explicit: **"อย่า refactor deployed
log_lift.py ใน P1 และอย่าใช้ logger ที่ import โมดูลใหม่เป็น rollback ต้องมี known-good
release/runtime/config อิสระ"** — do not refactor the deployed `log_lift.py`, and do not make a
logger that imports new modules the rollback target; rollback must stay an independent
known-good release/runtime/config. `docs/release/KNOWN_GOOD_CAPTURE_MANIFEST.json` (WhizdomLift
feature branch) already fixes that independent rollback target at commit `692acd1`. This
requirement is written to be satisfiable **without** editing `log_lift.py`'s own source.

## Required shape: control-plane layer, not logger-internal change

The mechanism lives at the **launcher/control-plane layer** (`scripts/start_captures.ps1` and
whatever P1-OFFLINE's new agent/control process becomes), sitting *alongside* the known-good
logger, never inside it:

1. **Hold marker per lift**, not a single global flag. A file (or equivalent) named per lift
   (e.g. `capture_lift_<n>.hold`), analogous to the existing per-lift `capture_lift_<n>.pid`
   pattern (CLAUDE.md section 6.19's fix for watchdog/PID ownership) — created only for the one
   lift being handed off, never touching the other three's markers.
2. **Verified PID ownership before any stop action.** The existing `.pid`-file identity check
   (CLAUDE.md 6.19 cause 3: Scheduled-Task-started processes hide their command line over WMI,
   so PID-file presence is the only reliable "is this the real logger" signal) is the correct
   pattern to reuse here — a stop/hold action must confirm it is targeting the verified PID for
   *that* lift's known-good logger, not merely "some process," before doing anything.
3. **Independent rollback command**, callable per lift, that:
   - confirms the target lift's COM port is actually released (not just that a PID changed —
     `docs/release/KNOWN_GOOD_CAPTURE_MANIFEST.json`'s own rollback sketch already requires
     this distinction, section "rollbackProcedureSketch" step 1),
   - restarts that one lift's known-good logger from the immutable release copy
     (`D:\WhizdomLift-releases\capture-kg-692acd1\`), using its own vendored `pyserial`,
   - does **not** touch the other three lifts' running processes, PID files, or hold markers at
     any point in this sequence,
   - records the gap (elapsed time with no capture for that lift) honestly, including the time
     before port-release was confirmed — not just the time after (per the known-good manifest's
     own rollback-sketch warning against under-reporting recovery time).
4. **Watchdog awareness.** `scripts/start_captures.ps1`'s existing idempotent "start only what's
   missing" logic (CLAUDE.md 6.19's fix) must be extended to treat a lift with an active hold
   marker as **intentionally not-running**, not as "missing, needs restarting" — otherwise the
   watchdog fights the canary handover every 15 minutes.

## What this explicitly does NOT authorize

- Editing `log_lift.py`, `port_resolver.py`, `capture_status.py`, or any other deployed capture
  code file's source, in this round or in P1-OFFLINE, to add per-lift-stop logic *inside* them.
- Building, testing, or deploying any part of this mechanism before G-A is approved.
- Stopping any lift's capture as a side effect of writing or reviewing this document.

## Test coverage this implies (P1-OFFLINE / P2-TEST scope, not drafted here)

A future per-lift-stop mechanism needs its own dedicated test(s) analogous to `TEST_MATRIX.md`'s
existing G01-G15 group — specifically: holding lift N does not affect lifts M≠N's PID/hold
state; a hold + rollback cycle on lift N, executed while the other three keep capturing,
produces zero gap in their logs; the watchdog does not restart a held lift; the rollback
command's port-release check genuinely blocks on the OS actually releasing the handle, not on a
fixed sleep; **and — requirement 6 — a rollback that restarts a process but leaves it `STALE`
or `DEGRADED` (per `capture_status.py`'s own classification) must be reported as an incomplete
rollback, not silently treated as done because the process exists.** These are not written this
round — recorded here so P1-OFFLINE's test plan does not have to rediscover them from scratch.
