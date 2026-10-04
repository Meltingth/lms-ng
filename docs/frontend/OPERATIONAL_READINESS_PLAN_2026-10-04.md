# HUD operational readiness — 4 October 2026

Status: DEV preparation. This is an implementation proposal and evidence index, not a gate approval. The owner authorized continued development and taking over work previously assigned to Claude. That changes implementation ownership; it does not turn our own implementation tests into independent Contract audit evidence.

## What exists now

Verified checkout: `codex/frontend-hud`, starting at `822f64af2138ce6645d2b8b39ff3ccf3f889c66b`, canonical origin `https://github.com/Meltingth/lms-ng.git`. Environment is DEV on the workstation, not an inspected Dell deployment.

- Five-lift HUD, confirmed-position/door presentation, independent freshness clocks, fullscreen and responsive layouts exist with local SIMULATED fixtures.
- The only application in this checkout is `apps/web`; API/worker/infra implementations are absent from this checkout. Declared OpenAPI paths are not proof of running endpoints.
- The store rejects REAL/LIVE frames. Events are local fixture events; history and analytics are unavailable rather than fabricated.
- The frozen tree here remains `2.0.0-draft.2`. Draft.3 is not an approved Contract; no draft.4 candidate or exact handoff has been supplied.
- PostgreSQL execution, live API integration, physical client sign-in/fullscreen acceptance and deployment remain NOT_RUN/BLOCKED as applicable. G-A and G-U remain unopened.
- Historical `WORKFLOW_STATE.json` and September preflight documents are retained. Their old machine paths, network observations and backend C01 PASS are not current machine evidence and do not override the independent C01 FAIL.

The owner has a separate TEST machine available, but OS, host identity, connection and installed-service inventory still need verification. See [remote setup](TEST_HOST_CODEX_SETUP.md).

## Work prepared in this increment

1. Separate the HUD's runtime lifecycle from its local simulation controls. An injectable runtime lets tests exercise lifecycle and isolation while default behavior remains the same visible SIMULATED HUD. It is not a network PlatformAdapter.
2. Preserve source ages, reconciliation, inactive-session boundaries and immediate disconnect motion cancellation through tests.
3. Allow browser QA to target a separate loopback preview and a new evidence directory, preserving the accepted milestone's screenshots.
4. Prepare a PostgreSQL verification bundle generator that reads current SQL without modifying it. Generation/local tests are not PostgreSQL execution. The eventual SQL run requires an explicitly identified empty scratch PostgreSQL 16 database on the TEST host.

## Ordered delivery plan

| Step | Work / owner | Evidence required before the following step |
| --- | --- | --- |
| 1. Connect TEST host | Owner connects Codex Remote/SSH; Codex inventories read-only | Hostname, OS, role TEST, separate from Gateway/Capture, repo path/origin/branch/SHA, installed tools and service inventory |
| 2. Prepare candidate corrections | Codex may implement the backend work now authorized; preserve frozen draft.2 and isolate any new candidate | Exact platform commit, comparison base, candidate version/hash, vendored-source commit and an explicit change list. Candidate release needs separate review; no silently edited frozen bytes |
| 3. Independently review candidate | Reviewer separate from implementation ownership | C01 semantics, C04 int64 enforcement, all Python/Ajv regex parity cases, version consistency, Ajv/advisories, tree hash, clean-source provenance, Whizdom vendored bytes/source pin, tamper detection. No self-awarded G-A |
| 4. Execute PostgreSQL checks | Codex on the confirmed disposable TEST database | Migration up, WHZ/TEST seeds, rerun/idempotency and stable IDs, actual constraints/assertions, mappings, ingest uniqueness, rollback, then real migration-runner bookkeeping and fresh-from-zero rerun. Keep static and executed results separate |
| 5. G-A decision | Architect review and owner gate decision | Candidate audit and database evidence accepted. Preserve unresolved FAIL/BLOCKED items |
| 6. TEST Platform service | Backend implementation after prerequisites | TEST-scoped authentication, REST snapshot, WS subscription/deltas, independent source/transport/heartbeat clocks, authoritative gateway association and floors, Redis/Postgres/MQTT health. No REAL ingestion in this stage |
| 7. HUD TEST integration | Frontend network adapter against the approved TEST contract | Snapshot/delta ordering, duplicates/gaps/epoch changes, reconnect/resnapshot, expiry and permission failures, stale/unknown states, immediate alarms, TEST/DEMO isolation, no commands controlling lifts |
| 8. Client and reliability acceptance | Codex testing; owner reviews physical display | Windows Full HD/4K/scaling, keyboard and reduced motion, authentication after kiosk restart, Desktop/Startup behavior, disconnected network/server recovery, measured latency and soak results. G-U remains a separate decision |
| 9. Later field delivery | Separate gate-controlled work | P1 offline/shadow and per-lift stop/rollback prerequisites, then G-C canary, G-R rollout and G-H acceptance. Pin deployment SHA and rollback plan before any Dell change |

## Backend decisions needed for a truthful HUD

- Provide independent valid-field-frame age or a documented authoritative transport projection. Do not substitute ST age or WS receipt time.
- Define clock comparability/uncertainty for source and heartbeat observations.
- Define whether revisions are contiguous or merely increasing, the gateway revision baseline, server/dataset/subscription identities and reset semantics.
- Define atomic snapshot/subscription buffering and watermark rules; 15-second reconciliation cannot renew observations.
- Supply elevator-to-gateway association and authoritative floor labels/profile/anchor units. W-05 raw codes 3–46 remain uncalibrated until supplied evidence changes the backend mapping.
- Specify TEST viewer authentication, session expiry/revocation, WS ticket/cookie handling and site authorization.
- Define real alarm/event history and analytics: windows, gaps, incomplete trips, denominators and retention. The current em dash remains until measured results exist.
- Door animation is presentation of confirmed motion. It is not evidence of a physical door-contact sensor unless that signal is supplied and approved.

## Inputs the owner needs to prepare

First provide the TEST OS and connect that machine using the [setup guide](TEST_HOST_CODEX_SETUP.md). A remote session will collect hardware, storage and service inventory before proposing installations. There is no need to guess Redis/MQTT settings or paste credentials into chat.

After connection, agree the disposable database name, test-only account/access method, organization/site scope, eventual API/WS hostname and TLS arrangement. Provide Windows client count, resolution/scaling and intended kiosk sign-in policy for the later client phase.

Local tools will not turn on Capture, open COM, change Scheduled Tasks, start a live gateway or modify WhizdomLift. No database or Contract source changes are included in this preparation increment.

## Findings preserved

C01 FAIL, the ui-enums draft mismatch and the root Ajv advisory remain recorded in the prior audit and freshness reports. Draft.3 remains unapproved. No LIVE PlatformAdapter, G-U approval or deployment is claimed. A future Codex-authored candidate requires an independent reviewer; an additional local subagent review is an implementation check, not an Architect gate decision.

## Verification evidence

Current-run results will be recorded in `evidence/readiness-2026-10-04/`. Historical evidence remains unchanged. Browser artifacts measure local rendering, not hardware telemetry or physical-client acceptance.

Immediate external prerequisite: **CONNECT_TEST_HOST**. Backend execution remains **WAIT_FOR_TEST_HOST_CONNECTION** until host identity and scratch scope are verified. The former WAIT_FOR_CLAUDE_DRAFT4 dependency is replaced by the owner's instruction for Codex to implement the missing work; independent candidate review remains required.
