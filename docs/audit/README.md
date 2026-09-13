# Independent QA harness

PASS: Task 1's scaffold exists in `scripts/audit/audit.py` and `tests/audit/test_audit.py`.
Its automated checks concern evidence capture and safety boundaries only. They do not establish
implementation correctness, Claude authorship, database durability, or approval of any gate.

BLOCKED: No specific new Claude implementation SHA/base was submitted for this milestone.
An actual `AUDIT_<PHASE>_<CLAUDE_COMMIT>.md` is therefore not fabricated for the existing HEAD
or for Codex's frontend work. The `prepare` command generates the complete mandated report
format when a full submitted SHA and an agreed full comparison-base SHA are available.

BLOCKED: `WAITING_FOR_G-A / BLOCKED_ON_POSTGRES_EXECUTION_EVIDENCE` remains in effect.
The pinned candidate is `2.0.0-draft.2` with
`sha256:ed2414fb8e830a9c281499c9a5cff8ba441668acb5b98fbb2265a6da5e4d18b3`.
These tools never write frozen contracts, `WORKFLOW_STATE.json`, existing `docs/evidence`,
production logic, Git branches/index, operational logs, or approval fields.

## Local checks

Run from the `lms-ng` repository root. Python 3.10+ and Git are sufficient; no package install,
database, network, broker, container or hardware connection is required.

```powershell
python -B -m unittest discover -s tests/audit -p 'test_*.py' -v
python -B scripts/audit/audit.py check-frozen --repo .
```

`check-frozen` prints JSON and writes nothing. It independently implements the documented
LF-normalized, ordinally sorted contract hash and checks the exact mandate pin. It checks
`VERSION` and the excluded release manifest's version/DRAFT/unapproved fields separately.
It also checks the recorded workflow gate fields without probing any environment. A matching
hash only proves bundle identity under that algorithm; it does not prove raw line endings,
semantic correctness, contract approval, PostgreSQL execution or deployment readiness.

| Exit | `check-frozen` | `prepare` |
| --- | --- | --- |
| 0 | PASS for the bounded frozen-identity/gate-record checks | Never emitted |
| 1 | FAIL: identity or gate-record mismatch | FAIL report captured: frozen identity or gate-record mismatch |
| 2 | BLOCKED: input/tool/read prerequisite failure | BLOCKED report captured, or prerequisite/output failure; inspect output |

NOT_RUN: The existing `scripts/validate-contracts.ps1 -Run` and contract test runners are not
automatically invoked. They can overwrite `docs/evidence/*` and execute test code. Review their
side effects first and run them only in an isolated, authorized test checkout when applicable.
Existing Claude evidence is context, never a substitute for independent execution.

## Future exact-SHA review

1. Obtain the specific functional Claude implementation's full 40-character SHA, phase and
   agreed full comparison-base SHA. Review all merge parents and the intended scope. Never
   assume current HEAD, an author string, a branch name or an old evidence file is the submission.
2. Create a separate checkout/worktree for the audit branch
   `codex/audit-<phase>-<claude-sha>`, following repository approval rules. Do not switch a shared
   checkout being used for frontend work. Keep production changes out of audit commits.
3. Use this trusted harness to inspect the target repository. The harness need not exist in the
   submitted commit. The placeholders below must be replaced with the supplied full SHAs.

   ```powershell
   python -B 'C:\NST\Software Dev\lms-ng\scripts\audit\audit.py' prepare `
     --repo 'C:\path\to\isolated-audit-checkout' `
     --phase P1-OFFLINE `
     --commit <FULL_SUBMITTED_COMMIT_SHA> `
     --base <FULL_AGREED_COMPARISON_BASE_SHA>
   ```

4. The command reads commit objects directly, without checking out or executing submitted code.
   It writes a new `docs/audit/AUDIT_<PHASE>_<FULL_SHA>.md` and matching evidence directory with
   the binary patch, changed-file list, dependency-file inventory and capture metadata. Metadata
   includes submitted/base/tree/parent SHAs, timestamp, collector digest, tool versions, patch
   digest, committed contract per-file hashes and current-worktree context. Current dirty files
   cannot silently become target-commit evidence. Existing report/evidence paths are refused.
5. Independently inspect the diff and dependency changes, then review all applicable A-I rows.
   Add concrete assertions and evidence rather than replacing an entire layer with a broad PASS.
   Inspect test code and prerequisites before running approved local tests from the exact SHA.
   Record command, versions, output, exit code, fixture identity, checkout SHA, cleanliness
   before/after and hashes of the resulting evidence. Keep runtime evidence separate from capture
   evidence and from Claude's original results.
6. Leave unavailable prerequisites BLOCKED, unattempted or inapplicable checks NOT_RUN with a
   reason, and measured failures FAIL. Never relabel skipped work PASS. If the frozen candidate
   fails, report it and wait for the Architect; do not repair it in place. A-G correctness and
   H-I applicability still require independent judgment, not a green capture exit code.
7. Preserve the mandated report footer and `NextAllowedAction: WAIT_FOR_ARCHITECT`. Use
   `DO_NOT_DEPLOY` while blocked or failed. `READY_FOR_NEXT_TEST_PHASE` and
   `READY_FOR_ARCHITECT_REVIEW` are recommendations after supporting evidence, never gate
   approvals. Owner approval after Technical Lead review is required for G-A/G-U/G-C/G-R/G-H.

## Scope to review per applicable change

| Layer | Independent review scope |
| --- | --- |
| A Contract | MQTT v2, schema, `/api/v2`, WS envelope, UI enums/IDs, sequence/epoch/origin/time, ACK/presence, backend floor ownership |
| B Correctness | Logic, errors, state transitions, concurrency/locking/async, cleanup, timeouts/retries, diff and dependencies |
| C Regression | Known-good behavior; serial/firmware/output pins/COM/Capture/logger safety |
| D Integrity | Message identity, dedupe/hash, DB_COMMITTED, retry identity, reorder/backlog, monotonic state; PUBACK is not durability |
| E Reliability | Authorized local outage/loss/reorder/reconnect/restart/clock/backlog faults; never real elevator hardware |
| F Security | Authentication/RBAC/ACL/TLS, TEST/REAL/DEMO isolation, WS auth, secrets/logs, injection/traversal, dependencies; no REAL commands |
| G Performance | Throughput, latency, rendering/FPS, CPU/memory/query/backlog; report target and measured values separately |
| H Deployment | Migration order, backup/rollback, environment/volumes, health/startup/cold boot/restart; no automatic deploy |
| I UX truth | SIMULATED/LIVE distinction, DEMO isolation, UNKNOWN/UNCALIBRATED, stale/age/offline evidence and truthful floor display |

NOT_RUN: Runtime, fault-injection, security penetration, PostgreSQL execution, hardware and
deployment testing are not supplied by this scaffold. Before any authorized Dell deployment,
prepare the mandate's `DEPLOYMENT_CANDIDATE.md` and stop for explicit authorization.

## Harness test boundaries

Tests create sanitized temporary Git repositories outside production worktrees. They verify
hash normalization/order/exclusions, tamper detection, exact-SHA selection against a dirty and
newer checkout, refusal of revision expressions and unsafe paths, no overwrite, external-diff
suppression, Git replacement-object suppression, complete BLOCKED report/footer, gate checks and nonzero blocked exit. Synthetic
fixtures patch the expected hash only inside the test process; the CLI exposes no pin override.

The current verification run is recorded in `docs/audit/HARNESS_VERIFICATION_2026-09-14.md`.

## Optional local baseline contract run

After reviewing the existing `tests/contract/test_schemas.py` and `parity.mjs` side effects,
run their C01-C08 functions with a compatible Python environment and a new evidence basename:

```powershell
python -B scripts/audit/run_local_contract_checks.py --evidence-name LOCAL_CONTRACT_NEW_RUN
```

This wrapper executes the current working tree, not the submitted-SHA capture. It preloads
compatible installed Python dependencies before the legacy tests insert their relocated venv
path. It calls test functions without their evidence-writing `main()`, preserves recorded
FAIL/BLOCKED outcomes even if a function returns normally, and writes only new audit evidence.
It needs existing jsonschema, referencing/rpds, PyYAML and the local Node/AJV dependencies.
Exit 1 means a recorded FAIL; exit 2 means BLOCKED/NOT_RUN; neither is test success.

FAIL: The 2026-09-14 baseline run recorded C01 FAIL and C02-C08 PASS. C01 points at the old
`WhizdomLift-wt/feature-lms-ng-revise-v2` layout and returns without an assertion when references
are missing. Do not rely on a pytest-only green summary for this path. The failure and minimal
recommended correction are recorded in `HARNESS_VERIFICATION_2026-09-14.md`; original tests
and contracts remain unchanged.
