---
docType: ADR
adrId: ADR-001
status: DRAFT
preparedAt: 2026-09-13T21:00:00+07:00
---

# ADR-001: Two repositories, no forced submodule, pinned contract bundle

## Context

Both the original plan (S1, [decision #11]) and the revised plan (§1.1, R02) agree on keeping
`WhizdomLift` as the Edge repository and a separate `lms-ng` as the Platform monorepo
(NestJS API, web, contracts, database, infra). They disagree on one mechanical detail: the
original plan wanted `lms-ng` to consume WhizdomLift as a git submodule at
`firmware/rs485-gateway`; the revised plan explicitly removes that requirement ("ไม่มี
`firmware/rs485-gateway` submodule เป็นเงื่อนไข build", §C.1) and instead wants a pinned
contract *release* (tag + commit + hash) to be the only coupling between the two repos, with
P05's test requiring "lms-ng clone เดี่ยว build/test ได้จาก pinned contract/fixture" — i.e. a
fresh clone of `lms-ng` alone, with no WhizdomLift checkout anywhere nearby, must still build
and test.

## Decision

Follow the revised plan. `lms-ng` and `WhizdomLift` are two independent git repositories.
Neither is a submodule of the other. The only thing that crosses the boundary is the
**contracts bundle** (JSON Schema, MQTT topic spec, OpenAPI, UI enums), which:

1. Is authored once, in `lms-ng/contracts/` (this repo owns it).
2. Is **vendored as a byte-for-byte copy** into `WhizdomLift/contracts/` by
   `WhizdomLift/scripts/sync-contracts.ps1`, tagged with a `SOURCE.md` recording the exact
   `lms-ng` commit/tag/hash it came from.
3. Is verified equal by hash on demand (`sync-contracts.ps1 -Check`) rather than by a CI job
   that requires both repos to be updated in lockstep before either one goes green — the
   revised plan explicitly forbids that kind of circular CI dependency (§A.1: "ไม่ทำ CI
   วงกลมที่สอง repo ต้องอัปเดตพร้อมกันก่อน repo ใดจะผ่าน").

## Why this repository actually implements it that way (not just restates the plan)

- WhizdomLift already has a working, tested vendoring pattern for exactly this class of
  problem: `vendor/pyserial` is committed source, not a submodule, not a registry dependency,
  precisely because a submodule or a registry fetch is one more thing that can fail silently
  in a context (Scheduled-Task-started process, no admin rights) where failing silently costs
  hours of undetected data loss (CLAUDE.md §6.19). The contracts bundle has the same
  reliability requirement — the agent that will eventually read it runs the same way, under
  the same Scheduled Task, on the same machine — so it gets the same treatment.
- A submodule pin means every `git clone` of `lms-ng` that forgets
  `--recurse-submodules` silently gets an empty `firmware/rs485-gateway/` directory and any
  build step that assumes it's populated fails in a way that looks unrelated to the actual
  cause. A byte-copy-plus-hash-check fails loudly and specifically: "the vendored contracts
  don't match `SOURCE.md`'s claimed hash," which is exactly the failure that matters.

## Consequences

- `lms-ng` never needs a network path to `WhizdomLift`'s repository to build or test (P05).
- `WhizdomLift`'s agent code (Deliverable B, not built in this round) depends on
  `WhizdomLift/contracts/` as ordinary committed files — no submodule init step, no extra
  clone flag for anyone checking out that repo for any other reason (capture debugging, lift
  analysis) to remember.
- The cost is that a contract update requires an explicit sync step (run
  `sync-contracts.ps1`, review the diff, commit) rather than happening automatically on
  `git pull` the way a submodule bump would. This is treated as a feature, not a bug — plan
  §A.1 and §A.11 both want contract changes to be visible, reviewed, hash-pinned events, not
  something that arrives quietly via a submodule bump.

## Status of this decision in the current round

This ADR is written and the mechanism (`sync-contracts.ps1`, `SOURCE.md` format) is built in
this A-DRAFT round, but the contracts it syncs are themselves still `status: DRAFT` pending
Gate G-A. Nothing here is `APPROVED`.
