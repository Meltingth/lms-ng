---
docType: GATE_DECISION_PACKET
gate: G-A
phaseId: A-DRAFT
status: AWAITING_OWNER_DECISION
preparedAt: 2026-09-13T22:00:00+07:00
candidateVersion: 2.0.0-draft.1
contractTreeHash: sha256:c80b2a1889d0ce8ce56f0f5e8c87634fbe43a37be340d42633c8d854ea5ae225
---

# Gate G-A decision packet — contracts candidate `2.0.0-draft.1`

**This document requests a decision. It does not make one.** `contracts/RELEASE_MANIFEST.json`
`status` is `DRAFT`, `approvedBy` and `approvedAt` are `null`, and nothing in this repository —
no script, no test, no phase report — is wired to set them to anything else. The only way this
gate moves to `APPROVED` is the owner saying so, and recording it themselves (or telling this
session to record a specific approval it can quote back). Approving *this round's plan* earlier
was not this approval; approving *this packet* is not a Live Cutover approval either — those are
separate gates (G-C, G-R) that this round does not touch.

## What you are being asked to approve

Whether contract candidate `2.0.0-draft.1` — MQTT v2 topic tree + envelope, JSON Schema, OpenAPI,
UI enum set, and the PostgreSQL schema/seed draft it implies — is an acceptable basis to build
P0-SERVER (Platform stack skeleton) and P1-OFFLINE/P1-SHADOW (Edge-side offline work) against.
Approving it does **not** authorize touching the deployed Gateway, opening any COM port, stopping
any capture, or moving any real lift's data — those stay gated behind G-C (single-lift canary)
and G-R (fleet rollout), each requiring its own separate authorization.

## 1. Candidate identity

| Field | Value |
|---|---|
| Version | `2.0.0-draft.1` |
| Contract tree hash | `sha256:c80b2a1889d0ce8ce56f0f5e8c87634fbe43a37be340d42633c8d854ea5ae225` |
| Hash method | [contracts-hash.ps1](../../scripts/contracts-hash.ps1) — SHA-256 over every file under `contracts/` except `RELEASE_MANIFEST.json` (cannot hash itself) and `SOURCE.md` (vendoring pointer, not content), each LF-normalised, combined via a sorted `relpath:hash` manifest. Reproduced identically by **three independent implementations** before being recorded here (§7). |
| File count hashed | 38 |
| Reproduce it yourself | `D:\lms-ng\scripts\contracts-hash.ps1` (no `-Run`/mutation needed — read-only) |
| Vendored copy (Edge side) | `D:\WhizdomLift-wt\feature-lms-ng-revise-v2\contracts\`, pinned in `contracts/SOURCE.md` there, verified against the same hash via `scripts\sync-contracts.ps1 -Check` |
| Supersedes | v1 baseline shipped inside the revision pack (`reference/legacy-contracts/LMS_NG_MQTT_Topic_Specification_v1.yaml`, `LMS_NG_OpenAPI_v1.yaml`) — read-only references, never edited |

## 2. What changed and why — diff summary

Full row-by-row reasoning with test-ID citations: [`docs/preflight/CONTRACT_BASELINE_DIFF.md`](../preflight/CONTRACT_BASELINE_DIFF.md).
Counts from that document's own summary (section 8):

- **KEEP: 9** — topic root pattern (versioned), `direction` enum, `floorRaw` type, `floorDisplay`
  REST-side shape, `activeAlarmCount`, REST base path `/api/v1`, `bearerAuth` scheme, heartbeat
  cadence/QoS, diagnostics topic role.
- **CHANGE: 19** — the two most consequential:
  - **Envelope sequencing.** v1's plain-integer `bootId`+`sequence` → `streamId` /
    `producerId` / `producerEpoch` / `streamSeq` (decimal string). A Gateway restart no longer
    implicitly resets the meaningful ordering context, and a counter that runs for months never
    silently loses precision in a JavaScript consumer past 2^53 (revision R07; [T1]).
  - **`floorDisplay` removed from the Edge's MQTT `state` payload — a correction, not a
    stylistic change.** The v1 baseline's own example had the Gateway computing and publishing
    a floor label directly, which contradicts Backend Plan v1.3 §2.2/§4.2, CLAUDE.md §9.6, and
    your own instruction for this round verbatim ("คง Backend เป็นเจ้าของ floor labels;
    WhizdomLift ส่ง floorRaw และสัญญาณที่รับจริงเท่านั้น"). Whoever wrote the v1 baseline
    contract apparently didn't get that memo. This candidate fixes it: the Edge publishes
    `floorRaw` (bare position code) and the four real contacts only; `floorDisplay`/`floorKind`/
    `floorProfileVersion` exist only in Backend-computed REST/WS responses.
- **REMOVE: 2** — the per-signal-point MQTT topic (redundant with the new `state.changes[]`
  array) and the Edge-reported `tripCount` (trip definition becomes a versioned Backend/Analytics
  concept, not something the Edge counts from raw contacts).
- **NEW: 7** — `origin` (LIVE/SIMULATED/IMPORT, immutable), `clockQuality`, `sourceRef`,
  `motion` (distinct from `direction`), `changes[]`, the full WebSocket envelope (v1 had none to
  diff against), snapshot/delta reconciliation protocol.
- **DEFER (not dropped): 2** — command request/result topics and config desired/reported topics.
  Reasoned in the diff document: both need P5-DRY-RUN's `DRY_RUN`/`LIVE` result-code design,
  which is out of this round's scope; drafting them now risks a shape that has to change anyway.

Full changelog prose: [`contracts/CHANGELOG.md`](../../contracts/CHANGELOG.md).

**No PostgreSQL schema baseline and no UI-enums baseline exist anywhere** (searched the revision
pack, WhizdomLift, and GitHub — `BASELINE_INVENTORY.md` §2). `database/migrations/0001_schema_v2_draft.sql`
and `contracts/enums/ui-enums.yaml` therefore have no v1 to diff against; both are drafted
directly from Backend Plan v1.3 §5/§6/§13 and revised plan §A.9/§A.11 prose, not from prior SQL
or a prior enum file. This is recorded, not glossed over — flag it if you know of a baseline this
round didn't find.

## 3. ACL matrix (MQTT)

From [`contracts/mqtt/LMS_NG_MQTT_Topic_Specification_v2.yaml`](../../contracts/mqtt/LMS_NG_MQTT_Topic_Specification_v2.yaml)
`identityAndAcl`:

| Principal | May publish | May subscribe |
|---|---|---|
| Gateway | `status/presence`, `status/heartbeat`, `telemetry/elevators/+/state`, `telemetry/elevators/+/snapshot`, `events/elevators/+`, `events/gateway`, `diagnostics/network` | `delivery/acks` |
| Server (ingestion) | `delivery/acks` | `+/+/+/status/#`, `+/+/+/telemetry/#`, `+/+/+/events/#`, `+/+/+/diagnostics/#` |
| TEST/simulator | identical shape to Gateway, scoped to the `lms-sim/v2/...` root and its own registered TEST elevator/gateway IDs — **can never match a REAL-root pattern** (test S01) | — |

Command topics (request/result) and config topics (desired/reported) are absent from this table
by design — see §2's DEFER items. Broker-level enforcement of "TEST cannot write REAL" is by
**topic-root pattern**, not by trusting the payload's `origin` field alone (`CONTRACT_BASELINE_DIFF.md`
§1) — this is deliberately a belt-and-suspenders design, not redundant: a client that got its
`origin` field wrong is still blocked by the broker ACL before that mistake reaches storage.

## 4. ACK / presence / sequence — how they actually work (text diagrams)

### 4.1 Application-level ACK (headline fix, R05)

```
Gateway                     Broker                      Server                  Database
   |-- PUBLISH state (QoS1) -->|                            |                        |
   |<---------- PUBACK --------|  (transport ack only --     |                        |
   |                            |   NOT a DB guarantee,       |                        |
   |                            |   OASIS MQTT 5.0 spec [T1]) |                        |
   |                            |-- deliver -------------->|                        |
   |                            |                            |-- INSERT ingest_receipt,
   |                            |                            |   current_state, events,
   |                            |                            |   outbox row (one txn) ->|
   |                            |                            |<----- COMMIT -----------|
   |                            |<-- PUBLISH delivery/acks --|  (DB_COMMITTED, only now)
   |<-- delivery/acks (app ACK)-|                            |                        |
   |   outbox: PENDING -> TRANSPORT_ACKED (on PUBACK) -> DB_COMMITTED (on this ACK)    |
```

A retry before `DB_COMMITTED` re-sends the **identical** `messageId` (immutable across retries,
R06) so the Server's `ingest_receipt` unique constraint on that ID — and independently on the
`(producerId, producerEpoch, streamId, streamSeq)` tuple — makes a duplicate delivery a no-op
rather than a duplicate row (tests I02, I06, I11).

### 4.2 Presence (merged birth/will, R09)

```
v1 baseline: two retained topics, can disagree after a reconnect race
  status/birth  (retained) --------- "online: true"
  status/will   (retained, LWT) ---- "online: false, reason: LWT"   <- prepared at CONNECT time,
                                                                        before any real disconnect,
                                                                        no timestamp field shown

v2 candidate: one retained topic, monotonic connectionSeq
  status/presence (retained) — { state: ONLINE|OFFLINE, connectionId, connectionSeq, reason,
                                  preparedAt }
  A stale LWT from a superseded connection cannot un-say a newer CONNECT's ONLINE, because
  connectionSeq only increases; a consumer treats a retained ONLINE as merely a HINT until an
  independent fresh proof (heartbeat/state) arrives -- connectionState = AWAITING_FRESH_PROOF
  in between (plan section A.4, test O06).
```

### 4.3 Sequence / ordering identity (R07)

```
v1: ordering key = (gatewayId, bootId, sequence)     -- sequence is a plain JSON integer
v2: ordering key = (producerId, producerEpoch, streamId, streamSeq) -- streamSeq is a DECIMAL
                                                                        STRING (1..2^63-1)

Why the change matters:
  - bootId resets on every restart -> a consumer that (incorrectly, but plausibly) treated
    bootId+sequence as durable ordering loses continuity on every reboot.
  - producerEpoch does NOT change on a plain restart -- only an explicit re-enrollment
    (e.g. after local durable-storage loss) advances it (test O03).
  - streamSeq as a JSON *number* silently loses precision past 2^53 in JavaScript; as a
    decimal *string* it never does (test C04). This is not a hypothetical: a counter meant to
    run for months on 4-5 elevators will realistically approach or exceed 2^53 samples over the
    system's lifetime under continuous per-signal-change recording.
```

## 5. Enum parity — new vs. carried-forward, and the one that isn't a real change

`contracts/enums/ui-enums.yaml` extends the (nonexistent-baseline, freshly-drafted) UI enum set
with values this candidate's design requires: `AWAITING_FRESH_PROOF`, `UNCALIBRATED`, `TRANSIT`,
`AGING`, `OUT_OF_SERVICE`, `NOT_COMMISSIONED`, plus per-field `dataQualityFlag` values including
`POSITION_BIT_SUSPECT` (renamed from the original plan's `SENSOR_VS2_FAULT` — a diagnostic
*candidate*, not an assertion a sensor is broken, until a human confirms it).

Owner-fixed Thai strings are carried forward **verbatim**, marked `(owner)` in the enum file, and
were not reworded by this round: `รอติดตั้ง` (PENDING_INSTALL, explicitly noted as "ใช้เมื่อยังไม่ติดตั้งจริงเท่านั้น
ไม่ใช้แทน OUT_OF_SERVICE"), `ศูนย์สัญญาณเตือน`, `โหมดสาธิต — ข้อมูลจำลองเพื่อการนำเสนอ`, `สาธิต`,
building name `"The Whizdom"`, ground floor label `"1"`.

`commissioningStatus` / `serviceStatus` / `monitoringEnabled` are three **separate axes** (R12) —
the concrete case this closes: W-04 is `COMMISSIONED` + `OUT_OF_SERVICE`, and the enum/schema
design makes it structurally impossible for that state to render as `PENDING_INSTALL` or
`NOT_COMMISSIONED` (test U05). This is carried forward from the plan's own explicit requirement,
not a new design choice made here.

## 6. Privacy / data-classification boundaries

Full detail: [`docs/preflight/DATA_CLASSIFICATION.md`](../preflight/DATA_CLASSIFICATION.md).
Summary relevant to this gate:

- **Never committed, this round or any future round without a separate owner decision:** raw
  capture logs, the Scheduled Task XML export, real hostnames/usernames tied to this machine,
  any credential. None of these appear in `contracts/`, `database/`, or anything staged for a
  push this round.
- **Fine to publish:** everything under `contracts/` and `database/` (schema/seed source, no
  operational data), `contracts/fixtures/**` (synthetic `TEST`-org payloads, never real building
  identifiers), this preflight/decision documentation, `tests/contract/**` source.
- **Push discipline actually followed this round:** the only push anywhere is the
  `feature/lms-ng-revise-v2` branch to the existing, already-public `Meltingth/WhizdomLift`
  remote — `main` untouched. `D:\lms-ng` has no remote configured and nothing from it can be
  pushed by accident. Before that push, the diff was scanned for secret-shaped patterns
  (`password`, `secret`, `api[_-]key`, `token`, `-----BEGIN`, this machine's hostname/username) —
  see `docs/evidence/A-DRAFT_report.md` for the exact command and its result.

## 7. Real verification evidence (not mock-as-proof)

Every number below is from an actual run this round, not asserted. Raw JSON:
[`docs/evidence/contract_test_results.json`](../evidence/contract_test_results.json),
[`docs/evidence/sql_lint_results.json`](../evidence/sql_lint_results.json),
[`docs/evidence/validate_contracts_results.json`](../evidence/validate_contracts_results.json).

| Test | What it checks | Result |
|---|---|---|
| C01 | Baseline inventory doesn't lose S2/S3; diff covers required topics | **PASS** |
| C02 | Python (`jsonschema`+`referencing`) / Node (`ajv2020`+`ajv-formats`) validate the same 10 fixtures identically | **PASS** |
| C03 | Object closure: valid payload passes; unknown extra field rejected by `unevaluatedProperties` at the assembled root | **PASS** |
| C04 | `streamSeq` decimal-string requirement; a JSON number is rejected; int64-range math checked | **PASS** |
| C05 | Envelope/scope validation (`elevatorId: null` rejected) | **PASS** |
| C06 | `RELEASE_MANIFEST.json` still `DRAFT`, `approvedBy`/`approvedAt` still `null` | **PASS** |
| C07 | WHZ-PAX 46 codes/43 landings/10 anchors reproduced exactly; WHZ-SERVICE exactly `{1:B1, 2:1, 47:44}` calibrated, 44 uncalibrated | **PASS** |
| C08 | LWT presence carries no fake `occurredAt`; ACK fixture fields valid | **PASS** |
| SQL lint (sqlglot-static) | `0001_schema_v2_draft.sql`, `whz.sql`, `test.sql` parse under `dialect=postgres` | **PASS** (45+18+8 statements; 2 statements — `CREATE EXTENSION`, a `DO $$...ASSERT...$$` block — fall back to untyped `Command` parsing, sqlglot's known weaker-than-`libpg_query` limit, disclosed in the evidence file, not hidden) |
| Tree hash reproducibility | Same algorithm, run independently 3 times | **PASS** — identical `sha256:c80b2a1...` every time |

**Standalone script and `pytest -v` both genuinely assert now** — this needed a real fix mid-round
(§8.1).

### What is BLOCKED / NOT_RUN this round, and why (not silently skipped)

| Item | Status | Reason |
|---|---|---|
| `dbmate up` against a live Postgres 16 | **BLOCKED** | No Dell reachable from this session (`DELL_TESTS_BLOCKED`, `MACHINE_CAPABILITIES.md` §5). Only `sqlglot-static` syntax parsing ran, which is honestly weaker than a real grammar parse — see the sqlglot-vs-pglast note below. |
| EMQX/Postgres/Redis stack end-to-end (G01-G15, I01-I12, O01-O06, S01-S05, U01-U12, P01-P09) | **NOT_RUN** | All require the Dell or a running broker/DB — P0-SERVER/P1-OFFLINE/P2-TEST scope, not A-DRAFT. `TEST_MATRIX.md`'s `beforeCanary=true` marking on these means they must exist and pass **before G-C**, not that they were expected to run in this round. |
| Confirm whether a private `lms-ng` GitHub repo already exists under another account/org | **VERIFY (open, owner input needed)** | No GitHub token in this session; an unauthenticated 404 on `api.github.com/repos/Meltingth/lms-ng` does not distinguish "doesn't exist" from "exists, private, no token to see it" (`BASELINE_INVENTORY.md` §1.1). Resolve this before `D:\lms-ng` is ever pushed anywhere, to avoid creating a second, divergent repo of the same name. |
| Per-lift capture stop | **BLOCKED (design gap, not attempted this round)** | `log_lift.py` (read again this round) implements exactly one stop mechanism: a single `STOP_CAPTURE` file that stops **every** running logger sharing that directory — no way to target one lift. This directly contradicts revision R04 ("ห้ามใช้ global STOP_CAPTURE ที่หยุดทุกลิฟต์"). **This is why P2-CANARY stays blocked regardless of how this gate resolves** — a per-lift stop must be designed, built, and tested in Deliverable B/P1-OFFLINE before any single-lift cutover can be authorized (G-C). |
| `contracts/openapi/LMS_NG_OpenAPI.yaml` command/alarm-ack/demo-start-stop/analytics-summary/elevator-events paths | **Present, `x-status: planned`, not implemented or schema-validated against a live server** | Deferred to their respective phases (P4/P5), matching the topic-level deferral in §2. |
| `packages/contracts` (generated TypeScript types from the JSON Schema/OpenAPI) | **Placeholder only, no codegen tool chosen or run** | P0-SERVER scope — see `packages/contracts/README.md` for the explicit plan. |

**Dependency substitution, disclosed rather than hidden:** the plan's original SQL-static-analysis
candidate was `pglast` (a `libpg_query` C-extension binding); `pip install pglast` failed on this
machine (no C/C++ build toolchain). Substituted with `sqlglot 25.34.1` (pure Python). Every result
from it is labeled `sqlglot-static` in evidence and prose, never claimed as equivalent to a real
Postgres-grammar parse — full detail in `docs/preflight/DEPENDENCY_MATRIX.md`.

### 7.1 Two real bugs this round's own verification discipline caught (not reported, then hidden)

Recorded here deliberately, in the interest of the same honesty the plan demands of the contract
itself — CLAUDE.md §6.15's pattern ("a bug announces itself with a report that contradicts
itself") showed up twice in this round's own tooling, and both are fixed and re-verified, not
just patched and trusted:

1. **`tests/contract/test_schemas.py`'s `pytest`-collected tests never asserted on their own
   result.** `record()` logged PASS/FAIL to stdout and a results list, but no top-level
   `test_*()` function raised on a `FAIL`/`BLOCKED` outcome — so `pytest -v` reported "8 passed"
   regardless of whether any individual check actually passed. Caught by deliberately re-running
   under `pytest` right after the standalone script had already reported a clean run, and asking
   whether the pytest wrapper was independently verifying that claim (it wasn't). Fixed: every
   `test_*()` now asserts on `record()`'s return value; re-verified by deliberately inverting one
   check (C05) and confirming `pytest` goes red, then reverting and confirming a clean run again.
2. **The PowerShell tree-hash scripts' claimed "ordinal, byte-value sort" was not actually
   ordinal.** `Sort-Object -Property RelPath -CaseSensitive` on Windows PowerShell 5.1 only
   breaks ties on case within an otherwise culture-aware comparison — it does not reproduce true
   byte-value order (e.g. it sorted `README.md` after `mqtt/...`, though `'R'` is a lower byte
   value than `'m'`). Caught by writing a **third**, independent Python implementation of the
   same tree-hash algorithm in `WhizdomLift/tests/test_contracts.py` specifically for
   cross-checking, and finding it disagreed with the PowerShell result on the exact same 38
   files. Fixed by sorting through `[System.StringComparer]::Ordinal` explicitly in both
   `contracts-hash.ps1` and `sync-contracts.ps1`; re-verified all three implementations now
   agree on `sha256:c80b2a1889d0ce8ce56f0f5e8c87634fbe43a37be340d42633c8d854ea5ae225`.

Neither bug affected contract *content* — both were in this round's own verification tooling,
found by the tooling's own cross-checks before being reported as done, which is the point of
building three independent checks rather than trusting one.

## 8. Known-good capture — unaffected by this round

`docs/release/KNOWN_GOOD_CAPTURE_MANIFEST.json` (WhizdomLift feature branch) and the immutable,
outside-git copy at `D:\WhizdomLift-releases\capture-kg-692acd1\` were re-verified importable in
isolation (`python -I`, no `PYTHONPATH`) before this packet was written. `capture_status.py`
reported `ALL CAPTURING` before this round started and is re-checked at the end of this round
(`docs/evidence/A-DRAFT_report.md`) — see that report for the exact before/after readout.

## 9. Open questions for the owner (not decided by this round)

1. **Does a private `lms-ng` repo already exist** under any account/org? (§7 VERIFY item.)
   Resolve before `D:\lms-ng` gets a remote.
2. **REST base path `/api/v1` kept unchanged** (no deployed v1 consumer found this round) — if a
   real v1 API is deployed somewhere this round's search didn't reach, this decision needs
   revisiting before it's final.
3. **Per-lift stop mechanism** — not designed or built this round; needs its own design decision
   before Deliverable B/P1-OFFLINE can close it, which in turn gates G-C.
4. Anything in the diff (`CONTRACT_BASELINE_DIFF.md`) you'd change before it's locked — every row
   there is independently approvable/rejectable, not just the document as a whole.

## 10. What approving G-A actually unlocks

Per `execution-manifest.json`'s own gate graph: P0-SERVER, P1-OFFLINE, P1-SHADOW, HUD-CORE, and
P2-TEST all list `G-A` as their only required gate and become permitted to start. **P2-CANARY
additionally requires G-U and G-C** (not unlocked by G-A alone), and per your explicit
instruction, no command moves all of lifts 1/2/3/5 at once automatically even after G-R — each
lift's cutover is its own authorized step.

## 11. Decision record (filled in only by the owner, never by this session)

```
Decision:      [ ] APPROVED   [ ] REJECTED   [ ] APPROVED WITH CHANGES (specify below)
approvedBy:    ____________________  (must match a real identity, not inferred)
approvedAt:    ____________________  (ISO 8601, recorded when actually given)
Scope of this approval: contract bytes at sha256:c80b2a1889d0ce8ce56f0f5e8c87634fbe43a37be340d42633c8d854ea5ae225 ONLY.
                        Does NOT authorize G-C (single-lift canary) or G-R (fleet rollout).
Conditions / changes required before P0-SERVER/P1-OFFLINE may start (if any):
```

This block, `contracts/RELEASE_MANIFEST.json`, `execution-manifest.json`'s `gates.G-A`, and
`WORKFLOW_STATE.json`'s `gates.G-A` all stay `PENDING`/`null` until you fill this in yourself (or
tell this session the exact values to record on your behalf) — nothing here defaults to yes.
