# PostgreSQL preparation — not execution evidence

Date: 4 October 2026. Environment: DEV. Scope: prepare verification tooling for the owner's separate TEST host. This is Codex-authored implementation preparation, not an independent audit of Claude's draft.4.

Added [generator and usage](../../scripts/database/README.md) and stdlib tests. The generator reads the existing migration/seeds and Contract VERSION, writes a new rollback-only SQL bundle, and never invokes PostgreSQL, Docker, a process or a network connection. It refuses to overwrite existing output or write under source directories. No generated SQL is committed.

| Check | Result |
| --- | --- |
| Generator unit tests | **15/15 PASS** — [output](evidence/readiness-2026-10-04/database-preparation/tests.txt) |
| Preparation plan | **PASS** — [scope and limitations](evidence/readiness-2026-10-04/database-preparation/plan.json) |
| Read-only implementation review | No actionable generator defect found; not PostgreSQL engine validation |
| Protected SQL/Contract inputs | Unchanged; raw input preservation is checked by the generator tests and Git diff |
| PostgreSQL 16 execution | **NOT_RUN** — TEST host not connected/identified yet |
| Durable migration, runner bookkeeping, fresh-database rerun | **NOT_RUN** — separate execution evidence still required |

The generated checks verify the exact scratch database name, server major 16, assertions enabled and absence of application schemas before application writes. They include only migrate:up, run the original seeds twice, compare counts/IDs/row contents including duplicates, check mapping facts and selected constraints, test ingest deduplication/int64 and multi-table savepoint rollback, and finish with ROLLBACK. SQL guard parsing is conservative and is not a general SQL validator or a security boundary for untrusted SQL bodies.

## Findings to reproduce on PostgreSQL

These are static source observations, not executed database FAIL results:

1. `database/migrations/0001_schema_v2_draft.sql:352` inserts contract version draft.1 while the frozen `contracts/VERSION` here is draft.2. The generated candidate-version check will retain and expose the discrepancy.
2. `core.producer_registration` at migration lines137–143 has a generated random primary-key ID and no gateway uniqueness constraint. WHZ seed129–131 and TEST seed24–26 omit that ID and use ON CONFLICT DO NOTHING. Seed reruns therefore appear to insert additional registrations. The generated comparisons include registration IDs and multiplicity rather than hiding them.

No migration, seed or Contract repair was performed. Any correction needs a separate reviewed change; frozen Contract bytes must remain preserved. Earlier C01 FAIL, ui-enums mismatch and root Ajv advisory remain open in their original evidence. Draft.3 is not approved; G-A/G-U and deployment state are unchanged.

Next: connect the TEST host, verify its role and scratch database scope, then review and run explicit PostgreSQL checks. **nextAllowedAction = WAIT_FOR_TEST_HOST_CONNECTION**.
