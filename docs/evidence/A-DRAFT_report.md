# Phase report — A-DRAFT

## Context
Machine role / actual machine: development machine, also the Gateway PC (`GW-WHZ-01`) —
`DESKTOP-GCKFBE4`, Windows 10 Pro 19045. Platform-side work (`D:\lms-ng`) ran in a project-local
venv (`D:\lms-ng\.venv`, `C:\Python312\python.exe` base interpreter) and project-local
`node_modules` (Node 16.20.2 + `ajv@8.17.1`/`ajv-formats@3.0.1`) — nothing global, nothing
touching the Edge's `vendor/`.
Repo / branch / commit: `D:\lms-ng` (new, local-only, no remote — `git init` this round);
`D:\WhizdomLift-wt\feature-lms-ng-revise-v2` on branch `feature/lms-ng-revise-v2` (Edge-side
vendoring only — the deployed `D:\WhizdomLift` main tree was never opened for writing).
Plan version: `LMS_NG_Revised_Implementation_Plan_v2_0.md` / `execution-manifest.json`
`planVersion: 2.0.0`; `stopAfterInitialPhase: G-A` honored — this report is written at that stop
point, not past it.
Contract version / hash: `2.0.0-draft.1` /
`sha256:c80b2a1889d0ce8ce56f0f5e8c87634fbe43a37be340d42633c8d854ea5ae225` (see
`docs/decisions/G-A_DECISION_PACKET.md` §1 for how this is computed and reproduced).
Input mode: none of C01-C08 or the SQL lint touch a network service — all fixtures/schemas are
static files, all validation runs against them directly. No SIMULATED/recorded-log/SHADOW/LIVE
ingestion pipeline exists yet to even choose an input mode for.
Run ID / time / timezone: 2026-09-13, Asia/Bangkok (UTC+7).

## Changes actually made
Files changed (all new, additive):
- `D:\lms-ng\contracts\**` (VERSION, RELEASE_MANIFEST.json, README.md, CHANGELOG.md,
  `mqtt/*.yaml`+`mqtt/examples/*.json`, `json-schema/{common,mqtt,ws}/*.schema.json`,
  `openapi/LMS_NG_OpenAPI.yaml`, `enums/ui-enums.yaml`, `fixtures/{valid,invalid}/*.json`)
- `D:\lms-ng\database\{migrations/0001_schema_v2_draft.sql, seeds/{whz,test}.sql}`
- `D:\lms-ng\packages\contracts\README.md` (placeholder only, no codegen)
- `D:\lms-ng\scripts\{contracts-hash.ps1, validate-contracts.ps1}`
- `D:\lms-ng\tests\contract\{test_schemas.py, parity.mjs, sql_lint.py}`, `package.json`
- `D:\lms-ng\docs\decisions\G-A_DECISION_PACKET.md`, `docs\evidence\{PRE-0,A-DRAFT}_report.md`,
  `docs\evidence\{contract_test_results,sql_lint_results,validate_contracts_results}.json`,
  `WORKFLOW_STATE.json`, `.gitignore`
- `D:\WhizdomLift-wt\feature-lms-ng-revise-v2\contracts\**` (vendored copy, written by
  `scripts/sync-contracts.ps1 -Update`, never hand-edited), `scripts/sync-contracts.ps1`,
  `tests/test_contracts.py`

Services / tasks / ports touched: **NONE.** No COM port opened. No Scheduled Task changed. No
capture stopped. No Server stack (EMQX/Postgres/Redis/Docker) started on this machine — Docker
Desktop's daemon was checked and confirmed not running, and this round did not start it.

Private artifacts location: none new this phase beyond PRE-0's (`D:\WhizdomLift-releases\capture-kg-692acd1\`).

## Tests actually run
| Test ID | Environment | Result | Evidence | Caveat |
|---|---|---|---|---|
| C01 | venv, `jsonschema` | PASS | `docs/evidence/contract_test_results.json` | — |
| C02 | venv `jsonschema`/`referencing` + local `node_modules` `ajv2020`/`ajv-formats` | PASS | same | Node 16.20.2 (EOL), not the plan's Node 22 target — sufficient for this schema-validation use, not for the actual Platform build (P0-SERVER targets Node 22 on the Dell) |
| C03 | venv | PASS | same | — |
| C04 | venv | PASS | same | — |
| C05 | venv | PASS | same | — |
| C06 | venv, reads `RELEASE_MANIFEST.json` | PASS | same | — |
| C07 | venv, regex-parses `database/seeds/whz.sql` | PASS | same | — |
| C08 | venv | PASS | same | — |
| SQL static lint (`sqlglot-static`) | venv, `sqlglot==25.34.1`, `dialect=postgres` | PASS (45+18+8 statements across 3 files; 2 fell back to untyped `Command` parsing — disclosed, not a real grammar check for those 2) | `docs/evidence/sql_lint_results.json` | Weaker than a real Postgres-grammar parse — `pglast` (the plan's original candidate) failed to build here, no C/C++ toolchain. An actual `dbmate up` against Postgres 16 remains `BLOCKED` (Dell unreachable) |
| Tree hash reproducibility | `contracts-hash.ps1`, run 3x independently, plus a 3rd independent Python implementation in `WhizdomLift/tests/test_contracts.py` | PASS — all three agree on `sha256:c80b2a1889d0ce8ce56f0f5e8c87634fbe43a37be340d42633c8d854ea5ae225` | see §"Two bugs" below — this agreement was reached only after fixing a real bug the cross-check found | — |
| `validate-contracts.ps1 -Run` (wraps the three checks above) | venv/node/PowerShell | PASS=3 FAIL=0 BLOCKED=0 / 3 steps | `docs/evidence/validate_contracts_results.json` | `-PlanOnly` is this script's default; the plan-only run was also verified separately to execute nothing |
| `sync-contracts.ps1 -Check` (Edge-side vendored copy vs. its pin) | WhizdomLift feature worktree | PASS | — | Deliberately tampered one vendored file mid-round and re-ran `-Check` to confirm it actually catches drift (it did — MISMATCH reported, exit 1), then restored via `-Update` and re-verified clean, before this evidence was recorded |
| `WhizdomLift/tests/test_contracts.py` | WhizdomLift feature worktree, system Python 3.12.5 | PASS — 0 failures across 8 checks | printed output, this report | — |
| Secret scan of new files before considering a push | `grep -rniE` for password/secret/api-key/token/`-----BEGIN`/this machine's hostname+username | 1 match, reviewed: `contracts/openapi/LMS_NG_OpenAPI.yaml:315` — `password: { type: string }`, a login-endpoint request-body **schema type declaration**, not a literal credential value. No other matches. | this report | — |
| `capture_status.py` (end of A-DRAFT, immediately before this report) | Gateway, read-only | PASS — `ALL CAPTURING`, all 4 PIDs alive (11360/1, 12660/2, 11684/3, 12100/5), `restarts 0`, `link lost 0` for every lift since the 09:32 session start | this report | Zero restarts across the whole round is the strongest available continuity evidence — a restart would have reset each lift's board clock to a small number, which it did not |
| `git -C D:\WhizdomLift status` (end of A-DRAFT) | Gateway, read-only | PASS — same 5 modified-tracked log files as PRE-0's baseline (`capture_lift_{1,2,3,5}.log`, `capture_launcher.log`), same pre-existing untracked `docs/` pack files the owner placed there before this round started; no new untracked/modified files, no tracked code differs from HEAD | this report | — |

**PASS=8 FAIL=0 BLOCKED=0** for C01-C08 (`docs/evidence/contract_test_results.json`); **0
failures** for `WhizdomLift/tests/test_contracts.py`.

### Two real bugs found and fixed by this round's own verification discipline

Recorded in full in `docs/decisions/G-A_DECISION_PACKET.md` §7.1 — summarized here because they
are evidence *of* the process, not evidence *for* the contract:

1. `tests/contract/test_schemas.py`'s `pytest`-collected tests logged PASS/FAIL but never
   asserted on it, so `pytest -v` reported "8 passed" independent of whether any check actually
   passed. Fixed: every `test_*()` now asserts on `record()`'s return value. Re-verified by
   deliberately inverting one check and confirming `pytest` goes red, then reverting.
2. The PowerShell tree-hash scripts' `Sort-Object -CaseSensitive` was not a true ordinal sort on
   this host (Windows PowerShell 5.1) — caught by a third, independent Python reimplementation
   disagreeing with it on the same 38 files. Fixed via `[System.StringComparer]::Ordinal` in
   both `contracts-hash.ps1` and `sync-contracts.ps1`; all three implementations now agree.

Neither bug touched contract content — both were caught in this round's own tooling before being
reported as done, which is why they are disclosed here rather than silently corrected.

## Gate state
G-A / G-U / G-C / G-R / G-H: all `PENDING`, all `approvedBy`/`approvedAt` `null` in
`contracts/RELEASE_MANIFEST.json`, `execution-manifest.json`, and `WORKFLOW_STATE.json`. **This
round stops here, at G-A, as instructed** — no APPROVED tag created, nothing self-approved.
Approval evidence and scope (null if pending): null — awaiting the owner's decision on
`docs/decisions/G-A_DECISION_PACKET.md`.

## Remaining work and risks
BLOCKED:
- `dbmate up` against a live Postgres 16 — Dell unreachable this round (`DELL_TESTS_BLOCKED`).
- Whether a private `lms-ng` GitHub repo already exists — no GitHub token this session
  (`BASELINE_INVENTORY.md` §1.1); resolve before `D:\lms-ng` gets a remote.
- Per-lift capture stop — does not exist; blocks P2-CANARY regardless of G-A's outcome. Not
  designed or attempted this round (Deliverable B/P1-OFFLINE scope).
NOT_RUN: every `TEST_MATRIX.md` test outside C01-C08 (G01-G15, I01-I12, O01-O06, S01-S05, U01-U12,
P01-P09, F01-F05) — all require the Dell, a running broker/DB, or an authorized field window,
none of which exist/are authorized in this round. `beforeCanary=true` on most of these means
"must exist and pass before G-C," not "expected this round."
Accepted risks (owner / scope / expiry): none accepted this round — nothing live changed, so
there is nothing to accept risk on yet. Two open decisions were recorded as **owner input
needed**, not as accepted risk: REST base path `/api/v1` reuse (no deployed v1 consumer found
within the repositories, this machine's local filesystem, and the supplied artifacts this
round could inspect — the Dell/server environment and the excluded `LMS-NG Live Dashboard.html`
were not reached) and the `lms-ng` repo-existence ambiguity above. **Addendum, resolved by the
owner during G-A review: base path changed to `/api/v2` — see "Addendum: candidate 2.0.0-draft.2"
at the end of this report.**

## Next permitted action
Exact next phase/step: **STOP at Gate G-A.** Hand `docs/decisions/G-A_DECISION_PACKET.md` to the
owner. Only after explicit owner approval (recorded by the owner, never inferred or defaulted)
do P0-SERVER, P1-OFFLINE, and P1-SHADOW become permitted to start, per
`execution-manifest.json`'s gate graph.
Actions still prohibited: everything PRE-0's report already listed, plus: no schema/topic/table
change without a `contracts/VERSION` bump + `CHANGELOG.md` entry (`contracts/README.md`'s
"Change guard"); no P0-SERVER/P1-OFFLINE/P1-SHADOW work before G-A is actually approved; no
setting of any gate's `approvedBy`/`approvedAt`; no `APPROVED` tag; no all-lift-at-once cutover
command, ever, even after G-R.
Rollback applicability: not applicable — nothing running or deployed was changed this phase. If
P0-SERVER/P1-OFFLINE work begins after G-A, the existing known-good capture release
(`D:\WhizdomLift-releases\capture-kg-692acd1\`) remains the rollback target for any future Edge
change, untouched by anything in this round.
