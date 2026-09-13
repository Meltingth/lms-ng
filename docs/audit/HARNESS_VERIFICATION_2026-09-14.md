# QA harness verification — 2026-09-14 (Asia/Bangkok)

PASS: Independent QA scaffold and bounded local verification are complete for mandate Task 1.
This is a harness/baseline verification record, not a Claude implementation audit or a gate approval.

BLOCKED: No new Claude commit and agreed comparison base were submitted for an implementation
review. No `AUDIT_<PHASE>_<CLAUDE_COMMIT>.md` was fabricated. The generator supplies the full
mandated footer once those inputs exist, with runtime and A-I reviews NOT_RUN and the initial
verdict BLOCKED (FAIL if a frozen identity/gate-record discrepancy is found).

## Commands and evidence

| Check | Status | Observed result | Evidence |
| --- | --- | --- | --- |
| `python -B -m unittest discover -s tests/audit -p 'test_*.py' -v` | PASS | 17 tests, 51.266 seconds, exit 0; synthetic temporary repositories only | `evidence/HARNESS_2026-09-14.tests.txt` |
| `python -B scripts/audit/audit.py check-frozen --repo .` | PASS | 38 included files; draft.2 exact pinned hash; release manifest DRAFT/unapproved; all five recorded gates preserved; exit 0 | `evidence/HARNESS_2026-09-14.frozen.json` |
| `python -B scripts/audit/run_local_contract_checks.py --evidence-name LOCAL_CONTRACT_2026-09-14_FINAL` | FAIL | C01 FAIL; C02-C08 PASS for implemented checks; exit 1 | `evidence/LOCAL_CONTRACT_2026-09-14_FINAL.json` and `.txt` |
| PostgreSQL 16 migration/seed/constraint/rollback execution | BLOCKED | Existing mandate prerequisite unavailable; no database environment probed or started | Mandate and unchanged `WORKFLOW_STATE.json` |
| New Claude exact-SHA implementation review | NOT_RUN | No new submitted SHA/base; synthetic test SHAs never attributed to Claude | Harness README and report generator |
| Hardware, LIVE connectivity, fault injection, deployment | NOT_RUN | Outside this local harness execution | No corresponding execution evidence claimed |

PASS: Executed with `C:\Python314\python.exe`, Python 3.14.4, Git 2.53.0.windows.3.
The local schema wrapper records dependency versions/paths, source hashes and context HEAD.
Its safe invocation imports compatible installed dependencies before the legacy test module adds
the relocated `.venv` path; it invokes the reviewed C01-C08 functions without their evidence-writing
`main()`. The old `.venv` launcher is not used. Test records are aggregated explicitly so a test
that records FAIL and then returns normally cannot produce a successful wrapper exit.

PASS: Earlier intermediate output is retained in `evidence/LOCAL_CONTRACT_2026-09-14.{json,txt}`;
the `_FINAL` files are the final wrapper run and include the collector source digest. Existing
evidence is never overwritten. The first 15-test harness run passed, then the strengthened
Git-replacement/all-gates checks were included in the final 17-test run above.

## Existing test defects and limitations

FAIL: `tests/contract/test_schemas.py:91-108` hard-codes the legacy
`C:\NST\Software Dev\WhizdomLift-wt\feature-lms-ng-revise-v2\docs\revisions\LMS_NG_Revised_Execution_Pack_v2_0\reference\legacy-contracts`
layout. The two requested files do not exist at that path in this checkout. The corresponding
filenames exist under `C:\NST\Software Dev\WhizdomLift\docs\reference\legacy-contracts`;
this inventory is not proof that the intended historical baseline bytes are equivalent.
C01 records FAIL at line 107 and returns at line 108 without asserting, allowing a normal
pytest function-return path to appear green despite the failed recorded assertion.

NOT_RUN: Minimum proposed correction for the implementation owner/Architect: provide the
approved repository/baseline path as configuration (or resolve the approved current layout),
verify the intended baseline identity, and make the missing-file path raise/fail consistently
with C02-C08. Original test code was not patched in this QA change.

NOT_RUN: C07's PASS is limited to its implemented SQL-text checks: passenger counts/anchors
and the three service calibrated entries. The existing implementation does not assert that
all 44 service codes 3..46 are present and uncalibrated, despite that wording in its docstring
and result description. Its checks do not execute PostgreSQL. A follow-up should assert the
complete service code set and uncalibrated rows independently.

NOT_RUN: C04's overflow check demonstrates local Python arithmetic, not a production ingest
boundary. C06 checks the release/version fields, not the pinned tree hash; the new independent
`check-frozen` check supplies the explicit pinned-hash comparison separately. C02-C08 PASS
must not be generalized to backend correctness or to the layers still NOT_RUN.

## Preserved scope and next action

PASS: Changes are confined to `scripts/audit/**`, `tests/audit/**` and `docs/audit/**`.
Read-only `git diff --name-only -- contracts WORKFLOW_STATE.json docs/evidence` produced no
paths after verification. No production/backend logic, contracts, existing evidence, operational
logs, Git branch/index or commits were modified by this subtask.

PASS: Candidate identity remains `2.0.0-draft.2` /
`sha256:ed2414fb8e830a9c281499c9a5cff8ba441668acb5b98fbb2265a6da5e4d18b3`.

BLOCKED: `WAITING_FOR_G-A / BLOCKED_ON_POSTGRES_EXECUTION_EVIDENCE` remains unchanged.
Passing harness tests do not open G-A, G-U, G-C, G-R or G-H.

BLOCKED: Deployment recommendation remains `DO_NOT_DEPLOY`; next allowed action is
`WAIT_FOR_ARCHITECT`. Future review should use a separate
`codex/audit-<phase>-<claude-sha>` checkout and explicitly supplied full commit/base SHAs.
