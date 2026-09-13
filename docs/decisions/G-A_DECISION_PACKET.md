---
docType: GATE_DECISION_PACKET
gate: G-A
phaseId: A-DRAFT
status: AWAITING_OWNER_DECISION
preparedAt: 2026-09-13 (round 2 — supersedes the round-1 packet written against 2.0.0-draft.1)
candidateVersion: 2.0.0-draft.2
contractTreeHash: sha256:ed2414fb8e830a9c281499c9a5cff8ba441668acb5b98fbb2265a6da5e4d18b3
supersedesCandidate: "2.0.0-draft.1, hash sha256:c80b2a1889d0ce8ce56f0f5e8c87634fbe43a37be340d42633c8d854ea5ae225 (retired, do not cite as this candidate's hash)"
---

# Gate G-A decision packet — contracts candidate `2.0.0-draft.2`

**This document requests a decision. It does not make one.** `contracts/RELEASE_MANIFEST.json`
`status` is `DRAFT`, `approvedBy`/`approvedAt` are `null`, and nothing in this repository sets
them to anything else. Round 1 of this packet (against `2.0.0-draft.1`) was reviewed but not
approved — the owner accepted directions D-01 through D-06 and D-08 through D-13, required a
change to D-07, required real PostgreSQL execution evidence (still outstanding, see section 3),
and required evidence-wording corrections applied throughout (see section 8). This is round 2,
reflecting all of that.

## 1. Candidate identity

| Field | Value |
|---|---|
| Version | `2.0.0-draft.2` |
| Contract tree hash | `sha256:ed2414fb8e830a9c281499c9a5cff8ba441668acb5b98fbb2265a6da5e4d18b3` |
| Superseded candidate | `2.0.0-draft.1`, hash `sha256:c80b2a1889d0ce8ce56f0f5e8c87634fbe43a37be340d42633c8d854ea5ae225` — retired, never reused |
| What changed from draft.1 | **Only** the REST base path (D-07: `/api/v1` → `/api/v2`) in `contracts/openapi/LMS_NG_OpenAPI.yaml`, plus evidence-wording corrections in surrounding documentation (not part of the hashed `contracts/` bundle). No MQTT, envelope, WebSocket, or database schema byte changed. |
| Hash method | `scripts/contracts-hash.ps1` — SHA-256 over every file under `contracts/` except `RELEASE_MANIFEST.json`/`SOURCE.md`, LF-normalised, sorted `relpath:hash` manifest, ordinal-sorted via `[System.StringComparer]::Ordinal` |
| File count hashed | 38 (unchanged from draft.1 — same files, different bytes in one of them) |
| Reproduced by | Three independent implementations this round: `lms-ng/scripts/contracts-hash.ps1`, `WhizdomLift/scripts/sync-contracts.ps1 -Check`, `WhizdomLift/tests/test_contracts.py` (from-scratch Python). All three agree on the hash above. |
| Tamper detection | Deliberately re-tested this round: appended a byte to the vendored `contracts/VERSION`, confirmed `sync-contracts.ps1 -Check` reports MISMATCH (exit 1), then restored via `-Update` and reconfirmed clean (exit 0). |
| lms-ng commit | `a93891b` (contains this candidate's contract bytes + the D-07 change + DB verification/remediation/design docs below; local only, no remote configured) |
| WhizdomLift vendored copy | branch `feature/lms-ng-revise-v2`, commit `5a2fb55` — the draft.2 re-vendor, committed **locally only** (`aba4310` remains the last commit actually **pushed** to `origin`); no push instruction was given this turn, see section 9 |

## 2. Decision table D-01 through D-13 — final, for `2.0.0-draft.2`

Evidence-wording note (applies to every "not found" claim below, per the owner's correction this
round): every "not found" statement means *not found within the repositories, this machine's
local filesystem, and the supplied revision-pack artifacts inspected this round*. **The
Dell/server environment was not inspected, and the deliberately-excluded `LMS-NG Live
Dashboard.html` was never seen.** No row below claims anything is absent system-wide.

| ID | Legacy (v1 baseline) | Candidate (`2.0.0-draft.2`) | Reason | Breaking impact | Compatibility / migration | Test / evidence | Owner decision required |
|---|---|---|---|---|---|---|---|
| **D-01** | One topic root, REAL/TEST separated only by ID value | Two roots: `lms/v2/...` (REAL) / `lms-sim/v2/...` (TEST), broker-ACL-enforced by pattern | Structural separation instead of trusting payload content | Breaking (no v1 subscriber reads v2) | New major version; nothing found within inspected scope currently consumes v1 | S01, C05 — schema **PASS**; live ACL enforcement NOT_RUN (needs a broker) | NO — accepted round 1 |
| **D-02** | Plain-int `sequence`, key `(gatewayId, bootId, sequence)` | `streamSeq` decimal string, key `(producerId, producerEpoch, streamId, streamSeq)` | v1's per-boot key loses continuity on reboot; JS number precision risk past 2^53 | Breaking | New envelope fields; no consumer found within inspected scope to migrate | C04, O01, O03 — schema **PASS**; live behavior NOT_RUN | NO — accepted round 1 |
| **D-03** | Implicit PUBACK-as-DB-guarantee | Explicit `PENDING → TRANSPORT_ACKED → DB_COMMITTED`, `delivery/acks` topic | [T1]: PUBACK is transport ack, not a DB guarantee (R05, headline fix) | Breaking | New topic/states; no existing outbox implementation to migrate | I01, I02 — schema **PASS**; live behavior NOT_RUN | NO — accepted round 1 |
| **D-04** | Two retained topics (`birth`/`will`), can disagree | One retained `status/presence`, monotonic `connectionSeq` | R09 — closes the two-independent-retained-values race | Breaking | New topic; consumer keys off `connectionSeq` | C08, O06 — schema **PASS**; live behavior NOT_RUN | NO — accepted round 1 |
| **D-05** | `state` retained; separate per-signal topic | `state` not retained (durable stream) + new retained `snapshot`; per-signal topic removed | R08/I10 — retained-cache vs durable-backlog conflation; `changes[]` already carries per-signal detail | Breaking | `snapshot` republished after every `state`; no consumer found within inspected scope | I10, O04, I11 — schema **PASS**; live behavior NOT_RUN | NO — accepted round 1 |
| **D-06** | Gateway computes+publishes `floorDisplay` on the wire | Removed from Edge MQTT payload — Backend-computed only | **Correction**, not a style change — contradicts Backend Plan v1.3 §2.2/§4.2, CLAUDE.md §9.6, and the owner's own verbatim instruction | Breaking for the v1 baseline only | No live MQTT consumer of the Edge wire format found within inspected scope | C07, U04 — **PASS** | NO — accepted round 1, closing an established rule |
| **D-07** | REST base `/api/v1` | **`/api/v2`** — **owner decision this round, reversing draft.1's "kept as `/api/v1`" choice** | A legacy v1 OpenAPI baseline already exists; this candidate is breaking regardless of base path; the "no consumer" search was scoped (see wording note above) and never strong enough alone to justify reuse | Breaking relative to draft.1's choice; not breaking relative to any live system (none found within scope) | All 14 OpenAPI paths + description re-based; `contracts/CHANGELOG.md` `2.0.0-draft.2` entry records the full reasoning | Re-run this round: C01-C08 **PASS=8**, sql lint **PASS**, 3-way hash reproducibility **PASS**, tamper detection **PASS** | **RESOLVED this round** — no longer open |
| **D-08** | No WebSocket contract in v1 | Full WS envelope + snapshot/delta/resnapshot protocol | Genuinely new surface, nothing to diff against | New capability | N/A | O04, O05 — schema **PASS**; live behavior NOT_RUN | NO — accepted round 1 |
| **D-09** | No origin/provenance field | `origin: LIVE\|SIMULATED\|IMPORT` (immutable) + topic-root split | Makes D03/S01 provable, not asserted | Breaking | New required field | D01, D03, S01 — schema **PASS**; live Demo Mode isolation NOT_RUN | NO — accepted round 1 |
| **D-10** | WS auth handshake unspecified | Session cookie or short-lived ticket only, never a URL token | [T5] OWASP guidance | Breaking only for a URL-token WS client (none found within scope) | N/A | S02 — design **PASS**; nothing live to test | NO — accepted round 1 |
| **D-11** | Implicit dedupe scheme, no named authority table | `telemetry.ingest_receipt` unique on `message_id` and `(producer_id, producer_epoch, stream_id, stream_seq)`; monotonic-upsert `current_state` | Names an explicit dedupe authority and conflict rule | Breaking relative to v1's implicit scheme | No PostgreSQL baseline found within inspected scope to migrate from | C07 (seed text-level) **PASS**; live DB execution **BLOCKED** — see section 3 | NO — accepted round 1; DB execution evidence still owed (section 3) |
| **D-12** | Edge reports `tripCount` | Removed — trip counting becomes versioned Backend/Analytics concept | Edge has no reliable trip definition from contact states alone | Breaking for any v1 consumer (none found within scope) | N/A | U10 — design **PASS** | NO — accepted round 1 |
| **D-13** | Command/config topics present in v1 | Absent — **deferred to P5-DRY-RUN**, not dropped | Shape depends on `DRY_RUN`/`LIVE` result-code design not yet done | Non-breaking; flagged so it's never mistaken for silent omission | Revisit explicitly at P5 | N/A — explicitly out of scope | NO — accepted round 1 |

## 3. PostgreSQL 16 verification — still owed, BLOCKED, environment-gated

**Full detail:** [`DB_VERIFICATION_STATUS.md`](DB_VERIFICATION_STATUS.md). Summary:

| Check | Status |
|---|---|
| Static SQL lint | **PASS** (sqlglot-static — weaker than real grammar, disclosed) |
| Fresh migration on Postgres 16 | **BLOCKED** — Dell unreachable (confirmed again this round: DNS/ARP both fail), no Docker/Postgres started on this Gateway |
| WHZ seed / TEST seed execution | **BLOCKED** — same reason |
| Seed rerun / idempotency | **BLOCKED** (designed for it — `ON CONFLICT` throughout, verified by inspection — untested live) |
| Constraints/assertions | **BLOCKED** for DB execution; **PASS** for the underlying facts via `C07`'s independent text-level re-derivation (a different, weaker claim, kept distinct) |
| Deterministic/stable seed IDs | Verified by inspection (literal UUID constants, not generated) — not yet confirmed by an actual rerun-and-diff |
| Expected counts/mappings | **PASS** (text-level, `C07`) — not yet confirmed against a live table |
| Transaction/rollback behavior | **BLOCKED** — needs scratch Postgres 16 |
| Migration status/version table | **BLOCKED** — never created, since nothing has ever connected to a real database |
| Upgrade migration | **NOT_RUN / N/A** — only one migration exists; separately, no prior applied LMS-NG migration was found within the inspected scope (not claimed system-wide) |

**G-A stays BLOCKED on this axis until real execution evidence exists from the Dell or another
explicitly authorized scratch environment that is not this Gateway.** No workaround was attempted.

## 4. ACL matrix, ACK/presence/sequence diagrams, enum parity

**Unchanged from round 1** — none of D-01 through D-06 or D-08 through D-13 changed bytes this
round, only D-07 (REST-only) did. See the round-1 content, still accurate:
[`contracts/mqtt/LMS_NG_MQTT_Topic_Specification_v2.yaml`](../../contracts/mqtt/LMS_NG_MQTT_Topic_Specification_v2.yaml)
`identityAndAcl` section for the ACL matrix; [`CONTRACT_BASELINE_DIFF.md`](../preflight/CONTRACT_BASELINE_DIFF.md)
sections 2-3 for the envelope/ACK/presence mechanics; [`contracts/enums/ui-enums.yaml`](../../contracts/enums/ui-enums.yaml)
for the owner-fixed Thai strings, unchanged.

## 5. Real verification evidence, rerun this round against `2.0.0-draft.2` bytes

| Check | Result |
|---|---|
| C01-C08 | **PASS=8 FAIL=0 BLOCKED=0** — rerun standalone and via `pytest -v`, both clean. `docs/evidence/contract_test_results.json` |
| sqlglot-static SQL lint | **PASS** — unchanged from round 1 (no SQL file touched this round). `docs/evidence/sql_lint_results.json` |
| Tree hash, 3 independent implementations | **PASS** — all three agree on `sha256:ed2414fb...` |
| Tree hash reproducibility (same script, 2 runs) | **PASS** — identical both times |
| Tamper detection | **PASS** — deliberately tampered, caught (exit 1, MISMATCH), restored, reconfirmed clean |
| `validate-contracts.ps1 -Run` | **PASS=3 FAIL=0 BLOCKED=0** / 3 steps. `docs/evidence/validate_contracts_results.json` |

## 6. Privacy / data-exposure — reviewed this round, decisions recorded by the owner

Full detail in the prior turn's chat review (git commit `2ebff54` inventory) and
[`OPERATIONAL_LOG_REMEDIATION_PLAN.md`](OPERATIONAL_LOG_REMEDIATION_PLAN.md). Owner decisions
recorded: no history rewrite now; `user=Administrator` alone is not rewrite-worthy; **no further
growth of `capture_lift_*.log`/`capture_launcher.log` gets committed/pushed going forward**; no
local file in active use by the logger or analysis tools gets deleted. A remediation plan
(untrack from the Git index without deleting files, add ignore rules, replace long-lived logs
with sanitized fixtures for documentation purposes) is written and proposed, **not executed**.
The underlying conflict between WhizdomLift `CLAUDE.md`'s "publish everything" rule and the LMS-NG
plan's R17 is flagged, not resolved by this session — see section 9.

## 7. P2-CANARY — reaffirmed BLOCKED, design requirement updated

Full detail: [`P2-CANARY_PERLIFT_STOP_DESIGN_REQUIREMENT.md`](P2-CANARY_PERLIFT_STOP_DESIGN_REQUIREMENT.md),
now including an explicit traceability table against the owner's six-item capability list (hold
one lift only; verified PID/ownership before stopping; Scheduled Task does not restart a held
logger; other lifts keep capturing; rollback never imports a new module; **rollback health
verification**, newly made explicit). Status unchanged: **recorded, not implemented.** `log_lift.py`
remains unedited. P2-CANARY stays BLOCKED regardless of G-A's outcome until P1-OFFLINE builds and
tests this mechanism.

## 8. Evidence-wording correction applied this round

Per the owner's explicit instruction, every persisted document making a claim of the form "X does
not exist anywhere" / "no consumer exists" / "no PostgreSQL baseline exists anywhere" was found
and reworded to name its actual inspected scope (repositories, this machine's local filesystem,
supplied artifacts) and explicitly note the Dell/server environment was not inspected. Fixed
this round: `docs/preflight/CONTRACT_BASELINE_DIFF.md` (intro paragraph, REST base-path row),
`docs/preflight/BASELINE_INVENTORY.md` (§2, two rows), `docs/evidence/A-DRAFT_report.md` (Remaining
work section), `docs/evidence/PRE-0_report.md` (Remaining work section). This document (round 1's
version had the same "exist anywhere" phrasing) is itself rewritten with scoped language
throughout.

## 9. Open items for the owner

1. **PostgreSQL 16 execution evidence** (section 3) — the largest remaining gap. Needs the Dell
   or another explicitly-authorized non-Gateway scratch environment.
2. **Whether a private `lms-ng` GitHub repo already exists elsewhere** — unresolved since round 1,
   no GitHub token this session.
3. **The `CLAUDE.md` "publish everything" vs. plan R17 conflict** (section 6) — this session is
   honoring the most recent explicit instruction (stop future log-growth pushes) but has not
   resolved which standing rule governs going forward.
4. **Whether to push the draft.2 re-vendor to the WhizdomLift feature branch** — committed
   locally (`5a2fb55`) and verified in the worktree, but not pushed this round pending your
   review of this packet (you did not ask for a push this turn).
5. Any D-01–D-13 row you want to revisit now that D-07 has changed.

## 10. What approving G-A unlocks

Unchanged from round 1: P0-SERVER, P1-OFFLINE, P1-SHADOW, HUD-CORE, P2-TEST all list only `G-A`
as their required gate in `execution-manifest.json`. P2-CANARY additionally requires G-U and G-C
(not unlocked by G-A alone) — and stays blocked regardless by the per-lift-stop gap (section 7).
No command moves lifts 1/2/3/5 together automatically, ever, even after G-R.

## 11. Decision record — filled in only by the owner

```
Decision:      [ ] APPROVED   [ ] REJECTED   [ ] APPROVED WITH CHANGES (specify below)
approvedBy:    ____________________
approvedAt:    ____________________
Scope of this approval: contract bytes at
  sha256:ed2414fb8e830a9c281499c9a5cff8ba441668acb5b98fbb2265a6da5e4d18b3  ONLY.
  Does NOT authorize G-C, G-R, or Live Cutover.
  Does NOT constitute PostgreSQL execution evidence -- section 3 stays BLOCKED regardless of
  this decision until real Dell/scratch-environment evidence is produced.
Conditions / changes required before P0-SERVER/P1-OFFLINE may start (if any):
```

This block, `contracts/RELEASE_MANIFEST.json`, `execution-manifest.json`'s `gates.G-A`, and
`WORKFLOW_STATE.json`'s `gates.G-A` all stay `PENDING`/`null` until the owner fills this in.
