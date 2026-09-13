---
docType: PREFLIGHT_INVENTORY
phaseId: PRE-0
status: DRAFT
preparedAt: 2026-09-13T21:00:00+07:00
preparedFor: G-A decision packet input
machineRole: development-machine (also the Gateway PC, GW-WHZ-01, per Backend Plan v1.3 §1)
---

# Baseline inventory — read-only PRE-0

Every fact below was read, not assumed. Where a source file named something that turned out
absent, that is recorded as absent, not silently skipped (plan §0.2).

## 1. Repositories

| Repo | Path | Remote | Default branch | HEAD commit | Working tree |
|---|---|---|---|---|---|
| WhizdomLift (Edge, deployed) | `D:\WhizdomLift` | `https://github.com/Meltingth/WhizdomLift.git` (fetch+push) | `main` | `692acd123552e32a49bc5bd2de83a7c4995e5335` | Clean except `capture_lift_{1,2,3,5}.log` and `capture_launcher.log`, which the four running loggers append to continuously. No tracked code file differs from HEAD. |
| WhizdomLift feature worktree | `D:\WhizdomLift-wt\feature-lms-ng-revise-v2` | same remote (shared with the main worktree) | branch `feature/lms-ng-revise-v2` (new, created this session from `692acd1`) | `692acd1` at creation | This is where all A-DRAFT Edge-side files are written. The deployed worktree at `D:\WhizdomLift` was never opened for writing during this round. |
| lms-ng (Platform) | `D:\lms-ng` | **none** — `git init` run locally this session, no `git remote add` performed | `main` (empty history at time of writing) | none yet at time of this document | Created fresh. Per plan §2.2 "ไม่สร้าง remote/public repo โดยไม่มีคำสั่งเจ้าของ" this repo has **no remote** and will not get one until the owner creates `Meltingth/lms-ng` (or another destination) and says so. Status reported as `REMOTE_UNAVAILABLE`, not `BLOCKED`, because all local work proceeds normally. |

### 1.1 `lms-ng` existence check (plan §0.3, last row: "404 ไม่พิสูจน์ว่าไม่มีหรือ public/private")

- `GET https://api.github.com/repos/Meltingth/lms-ng` → **HTTP 404** (checked again this session, unauthenticated).
- No local checkout found anywhere searched: `D:\`, `C:\Users\Administrator\Documents`, `Desktop`, `Downloads`, `OneDrive`.
- An unauthenticated 404 on GitHub does not distinguish "does not exist" from "exists but private and I have no token to see it." This session has no GitHub token, so that ambiguity is **not resolved** here. Recorded as `VERIFY` for the owner: confirm whether a private `lms-ng` already exists under any account/org before this round's local `D:\lms-ng` is ever pushed anywhere, to avoid creating a second, divergent repo of the same name.

## 2. Files the source plans named but that are absent from any repo reached in this round

| Named in | Path named | Found? |
|---|---|---|
| `docs/workflow/PHASES.md` (original, WhizdomLift) | `docs/design/LMS_NG_UXUI_Design_Spec_v1_2.md` | **Absent.** Not in WhizdomLift, not in the revision pack (`reference/` holds only the MQTT/OpenAPI baseline and one PNG, not a UX/UI spec document). |
| Backend Plan v1.3 §13 | `contracts/mqtt/LMS_NG_MQTT_Topic_Specification_v1.yaml` (in an `lms-ng` repo) | **Not in any `lms-ng` repo** — because no `lms-ng` repo was reachable — but an identical-content copy ships inside this revision pack at `reference/legacy-contracts/LMS_NG_MQTT_Topic_Specification_v1.yaml` (sha256 verified against `PACK_MANIFEST.sha256`, see §3). |
| Backend Plan v1.3 §13 | `contracts/openapi/LMS_NG_OpenAPI_v1.yaml` | Same as above — present only as `reference/legacy-contracts/LMS_NG_OpenAPI_v1.yaml` inside the pack. |
| Backend Plan v1.3 §13 | `database/migrations/0001_schema_v1.sql` | **Absent everywhere.** No PostgreSQL schema file of any version was found in the pack, in WhizdomLift, or on GitHub. This is the one contract with **zero prior baseline** — A-DRAFT's `0001_schema_v2_draft.sql` has no v1 to diff against, only the plan's prose description (Backend Plan §6, revised plan §A.9). |
| Revised plan v2.0 §0.2 [S5] | `LMS-NG Live Dashboard.html` | **Deliberately excluded from the pack** ("ไฟล์ HTML เดิมไม่รวมใน ZIP"). Not available in this round. Any UI work that would reuse it is `BLOCKED` pending the owner supplying the original file. |
| Revised plan v2.0 §11.1 | `.claude/commands/phase.md`, `scripts/deploy-phase.ps1`, `scripts/test-phase.ps1` (WhizdomLift copies) | **Present** in WhizdomLift at `692acd1`. Read for this round (not modified — PRE-0/A-DRAFT touch neither). |

## 3. Revision pack integrity (own PRE-0 verification, independent of the QA report bundled in the pack)

Verified this session with `sha256sum -c PACK_MANIFEST.sha256` from inside the copy now committed
at `WhizdomLift-wt/.../docs/revisions/LMS_NG_Revised_Execution_Pack_v2_0/`:

```
15 / 15 files: OK
```

`reference/ORIGINAL_CLAUDE_PLAN_2026-09-13.txt` sha256 = `96f28b816fc122e2daf57273e0000673900ad61f7ebcd0b0f1a05658543d5378`
(205 lines) — matches the value the revised plan cites at [S1] exactly.

The pack's own `PACKAGE_QA_REPORT.json` (`scope: DOCUMENT_PACKAGE_VALIDATION_ONLY`,
`deploymentPerformed: false`, `liveLiftTestsPerformed: false`) was read and is consistent with
what PRE-0 found: it is a structural/document check only, not evidence that any contract,
Edge, or Platform code has run.

## 4. Edge (WhizdomLift) — signal facts already established in the deployed repo

These are cited, not re-derived, per plan §0.1 [SOURCE] marking. Source: `CLAUDE.md` §3.1–3.4,
§9.6 as committed at `692acd1`.

| Item | Value |
|---|---|
| Position bits | D24–D29 = VS2–VS7, plain binary, LSB = VS2 (D24), codes 1–46 for the passenger profile |
| Status pins | D16 RUNNING, D17 SAFETY (normally-closed), D19 UP, D20 DN |
| Wire lines (from `IODebug\IODebug.ino`, this round's own read) | `FW_VERSION "1.2.2"` (line 27); `LIFT_ID` defaults to `0` if not passed at compile time (line 45); `HEARTBEAT_MS = 60000`, `IDENT_MS = 30000` (lines 75–76); banner `FW IODebug <ver> <date> LIFT=<n>` (lines 359–365); telemetry line `ST <ms> <13-hex>` (line 368) |
| Floor table (closed 2026-09-12, CLAUDE.md §3.4) | `1→B1, 2→1, 3→2, 5→3, 6→4, 7→5, 8→6, 10→8, 12→9, 13→10, …, 21→18, 22→20, …, 46→44`; codes **4, 9, 11 are transit-only**, no landing; labels 7 and 19 do not exist as landings |
| W-05 (Lift Service) — owner-confirmed decision, carried into this round unchanged | `1→B1, 2→1, 47→44` calibrated; codes 3..46 **UNCALIBRATED**, render as `code N`. This round does **not** touch that decision (plan §0.2 explicit instruction) and does **not** borrow the passenger transit-code list (4/9/11) for W-05. |
| Lift 1 | VS2 line physically repaired 12 Sep 2026; current capture uses the full `POSITION_BITS` map (not the pre-repair 5-bit fallback) |
| Lift 4 | Out of service, not connected. Distinguish from "not commissioned": plan revision R12 requires `serviceStatus` OUT_OF_SERVICE to be a separate axis from `commissioningStatus`/`monitoringEnabled` — the deployed system currently only has `enabled=false` for it, which the revised contract must not collapse back into "pending install." |
| FIRE / FIRE RETURN | Pins never identified; contacts exist on the controller diagram but open-vs-unconnected is indistinguishable without a physical activation test that has not happened. Capability = not-available; the revised contract must not render this as `false`/`NORMAL`. |

## 5. Edge — known-good capture identity (full detail in `KNOWN_GOOD_CAPTURE_MANIFEST.json`, §6 below)

- Deployed commit: `692acd1` (matches the repo HEAD above; the known-good manifest and this
  inventory were generated from the same commit, so there is no drift between "what's running"
  and "what was snapshotted").
- Four `log_lift.py` processes are running right now (lifts 1, 2, 3, 5), started 2026-09-13
  09:32 local by Scheduled Task `WhizdomLift captures`. Verified via `capture_status.py`
  immediately before this round started: `ALL CAPTURING`. Re-verified after every write in
  this round; still `ALL CAPTURING` throughout (see phase report evidence).
- The task's own command lines are **hidden** from `Get-CimInstance Win32_Process` when
  started by Task Scheduler (a known, previously-documented Windows behavior for this
  environment — CLAUDE.md §6.19 cause 3) — confirmed again this session: `capture_status.py`
  and a direct WMI query both show blank `CommandLine` for the four PIDs, while the pid files
  and the still-growing capture logs prove they are the real loggers.
- **Per-lift stop does not exist.** `log_lift.py` (read again this round, lines 48/71/398-399/451)
  implements exactly one stop mechanism: a single `STOP_CAPTURE` file in the working directory
  that every running logger checks before starting and on every loop iteration — creating it
  stops **all** loggers that share that directory, with no way to target one lift. This directly
  contradicts revised-plan requirement R04/E.2 step 2 ("ห้ามใช้ global `STOP_CAPTURE`... ที่หยุดทุก
  ลิฟต์"). **Recorded as the reason P2-CANARY stays `BLOCKED`** until a per-lift stop mechanism
  is designed, built, and tested (owned by Deliverable B/P1-OFFLINE, not by this PRE-0/A-DRAFT
  round). This round does not attempt to build one.

## 6. Platform (lms-ng) — machine and toolchain

See `MACHINE_CAPABILITIES.md` for the full table. Summary: this machine (the Gateway PC) is
explicitly **not** where the Platform stack may run (plan §0.3, §6.6 "ห้ามรันServer stack/Docker
buildหนักบนเครื่องนี้"). All Platform-side validation in this round runs in a project-local
Python venv (`D:\lms-ng\.venv`) and project-local `node_modules` (`ajv`), never touching
`vendor/` or any system package location the deployed Edge capture depends on. Docker Desktop
was **not started** at any point in this round.

## 7. Access limits recorded honestly

- No GitHub token in this session → cannot create `Meltingth/lms-ng`, cannot check private-repo
  existence definitively, cannot push anything anywhere except WhizdomLift's existing remote
  (and only the new feature branch, never `main`).
- No Dell (`LMS-SRV`) reachable from this session. Every P0-SERVER/P2-TEST/HUD-CORE action is
  `DELL_TESTS_BLOCKED` for this round; only what does not require Docker/Postgres/EMQX/Redis to
  actually run (schema parsing, JSON Schema validation, static SQL lint) was attempted.
- No admin/elevated shell in this session. `nssm` and `pwsh` are not installed on this machine
  (checked: both commands not found). Neither is required for PRE-0/A-DRAFT.

## 8. What PRE-0 changed

Nothing in the deployed Edge tree (`D:\WhizdomLift`). Nothing running (the four loggers, the
Scheduled Task, and the capture logs were only *read*, `capture_status.py` was only *called*
with no arguments that write anything). New, additive-only: the `D:\WhizdomLift-wt\...`
worktree/branch, `D:\lms-ng` (untracked-by-anything-else, no remote), and
`D:\WhizdomLift-releases\capture-kg-692acd1\` (a private, read-only, out-of-git copy).
