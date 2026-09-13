---
docType: DB_VERIFICATION_STATUS
appliesTo: "database/migrations/0001_schema_v2_draft.sql, database/seeds/{whz,test}.sql"
status: BLOCKED_PENDING_ENVIRONMENT
preparedAt: 2026-09-13
---

# PostgreSQL 16 verification status

**No item below is reported PASS from static inspection alone.** Static tooling (`sqlglot`)
checks syntax only; it never executes a statement, never opens a connection, never evaluates a
constraint. Where that distinction matters, both the static result and the execution status are
shown separately, and the execution status governs whether the row counts as done.

**Environment check performed this turn:** the Dell (`LMS-SRV`) is unreachable from this
session — `ping`/`nslookup LMS-SRV` both fail to resolve, and the ARP table shows only the
local router and multicast addresses, no other host on this network segment. **No Docker or
Postgres stack was started on this Gateway machine to work around that** — the owner's
instruction is explicit that G-A stays BLOCKED rather than have this round manufacture a pass
that way, and this document honors that.

| Check | Status | Evidence / required environment |
|---|---|---|
| Static SQL lint | **PASS** | `sqlglot 25.34.1`, `dialect=postgres` — `docs/evidence/sql_lint_results.json`. Weaker than a real grammar parse (2 statements fall back to untyped `Command` parsing — disclosed there, not hidden). `pglast` (the original candidate) failed to build on this machine (no C/C++ toolchain). |
| Fresh migration (`0001_schema_v2_draft.sql` applied to an empty Postgres 16) | **BLOCKED** | Never executed. Requires a reachable Postgres 16 instance — the Dell, or another authorized scratch environment that is not this Gateway. |
| WHZ seed (`database/seeds/whz.sql` loaded into a real DB) | **BLOCKED** | Never executed. Same environment requirement. |
| TEST seed (`database/seeds/test.sql` loaded into a real DB) | **BLOCKED** | Never executed. Same environment requirement. |
| Seed rerun / idempotency | **BLOCKED — designed for it, untested** | Both seed files use `ON CONFLICT DO UPDATE`/`DO NOTHING` throughout (verified by direct inspection: 8 occurrences in `test.sql` alone) — a deliberate design choice, not an accident. Whether re-running either file against a live database actually produces zero errors and zero duplicate rows has never been executed. |
| Constraints/assertions | **BLOCKED (DB execution) — PASS (underlying facts, by a different method, see caveat)** | The migration's 25 `CHECK`/`CONSTRAINT` declarations have never been evaluated by a real Postgres engine. `whz.sql`'s `DO $$ ... ASSERT ... $$` guard block (4 assertions: WHZ-PAX = 46 codes / 43 landings / exact 10-anchor label string; WHZ-SERVICE = 3 calibrated / 44 uncalibrated) has never executed — it is literally one of the two statements `sqlglot` could not fully parse (fell back to `Command` mode). **Caveat, not a substitute:** `C01-C08`'s `C07` independently re-derives the same facts by regex-parsing the SQL text directly (currently PASS) — real, reproducible evidence, but a text-level re-derivation is not the same claim as "the SQL `ASSERT` statements executed inside Postgres and held." |
| Deterministic/stable seed IDs | **Verified by inspection, not by execution** | Every UUID in `whz.sql`/`test.sql` is a literal, hand-assigned constant (e.g. `'00000000-0000-4000-8000-000000000001'`), not generated at insert time — so re-running the seed against the same schema is structurally guaranteed to produce the same IDs. This is a static-text property, confirmed by reading the files; it has not been confirmed by actually running the insert twice against a live database and diffing the resulting rows. |
| Expected counts/mappings | **PASS (text-level, via `C07`) — not yet confirmed against a live table** | `C07` confirms `whz.sql`'s literal text encodes exactly 46 WHZ-PAX codes / 43 landings / the 10 owner-confirmed anchors, and exactly 3 calibrated + 44 uncalibrated WHZ-SERVICE codes. Confirming `SELECT count(*) FROM core.floor_mapping ...` returns the same numbers **after** the migration+seed actually run in Postgres is a separate, not-yet-performed check. |
| Transaction/rollback behavior testable in scratch | **BLOCKED** | Never executed — requires a scratch Postgres 16 instance to apply the migration, seed, then exercise a rollback/restore procedure (plan §E.3 / test P07 pattern) and confirm state afterward. |
| Migration status/version table | **BLOCKED — cannot report either way** | Whichever migration runner P0-SERVER ends up using (the plan's own template references `dbmate`) tracks applied migrations in its own bookkeeping table, created only when that runner first connects to a real database. Since no runner has ever connected to any database in this project, this table has never been created, inspected, or populated — this is not "empty" or "absent" as a confirmed fact about a real database, it is "never reached." |
| Upgrade migration (applying a migration on top of a database that already has `0001` applied) | **NOT_RUN / N/A — structurally inapplicable within what this round can inspect, not a universal claim** | Only migration `0001` exists in this repository; there is no second migration to test an upgrade sequence with. Separately: no prior applied LMS-NG migration was found within the repositories, this machine's local filesystem, and the supplied artifacts this round could inspect — the Dell/server environment was not inspected, so this is not asserted as true system-wide, only as "not found within that scope." Both facts point to the same conclusion (nothing to test yet), but they are two different claims and are kept distinct here. |

## What would close each BLOCKED item

All of them need the same thing: a reachable Postgres 16 instance that is not this Gateway PC —
the Dell, or another environment the owner explicitly authorizes as scratch. Once reachable, the
sequence is: apply `0001_schema_v2_draft.sql` fresh → run `whz.sql` → run `test.sql` → rerun both
seed files a second time and diff row counts/IDs against the first run → query the anchor/count
facts `C07` already predicts from the SQL text and confirm they match live → exercise a
rollback/restore drill → capture whatever migration-runner status table exists at that point.
Every step's real output (not a re-assertion of the static check) becomes this document's
evidence, replacing the corresponding BLOCKED row with PASS or FAIL — never silently upgraded
without that live run.
