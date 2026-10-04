# PostgreSQL verification preparation

`prepare_postgres_verification.py` generates a **rollback-only psql script** from the existing migration and seeds. It does not connect to a database, run psql or Docker, install anything, change credentials, or edit its source inputs. PostgreSQL execution remains **NOT_RUN** until an authorized operator runs and captures the generated script on the designated TEST host.

From the repository root:

```powershell
python scripts/database/prepare_postgres_verification.py --plan
python scripts/database/prepare_postgres_verification.py --output "$env:TEMP/lms-ng-verification.sql" --scratch-database lms_ng_verify_review
python -B -m unittest discover -s tests/database -p "test_*.py" -v
```

The output parent must already exist; an existing output file is never overwritten. `--repo-root` supports an explicitly selected checkout on DEV or the authorized TEST machine. Input byte hashes and relative paths are recorded inside the generated file; no machine paths or credentials are embedded. Do not commit generated SQL or run it on production. Host authorization and identity must be checked separately; the name prefix alone cannot prove host role.

Before applying any application DDL, the generated script rejects a server outside PostgreSQL major 16, a database name different from the explicitly supplied `lms_ng_verify_*` name, disabled `plpgsql.check_asserts`, or any existing `core`, `telemetry`, `alarm`, `command`, `auth`, or `audit` schema. Use a new psql session without startup customizations on an isolated, dedicated scratch database and allow no concurrent writers. The eventual operator needs permission to create schemas and the migration's `pgcrypto` extension.

Only `migrate:up` is included. Both immutable seeds execute twice, with snapshots of all seeded tables between runs. Counts, UUID/composite identity and row contents are compared using `EXCEPT ALL`, preserving duplicate multiplicity. Only lifecycle timestamps `created_at`, `registered_at` and `re_enrolled_at` are excluded from row-content comparison; IDs remain included. Known floor mappings, candidate-version consistency and selected CHECK/FK constraints are checked. Ingest tests exercise duplicate message/stream identities, sequence zero, exact signed-int64 maximum and overflow. A savepoint test inserts a receipt, current-state row, partitioned event and outbox item and verifies all disappear after rollback.

Selected check failures accumulate as FAIL rows. The final transaction always ends with `ROLLBACK` on the normal reporting path, then verifies the application schemas are absent and raises an error if a recorded check failed. Unexpected SQL errors stop psql immediately; closing that fresh session rolls back the open transaction. Sequences are not expected to rewind inside savepoints. There is no `COMMIT` path.

These are prepared checks, **not PostgreSQL validation evidence**. They do not prove migration-runner bookkeeping, durable migration/seed commit, backup/restore, repeatability across separate fresh databases, all constraints, concurrent ingestion or backend ACK semantics. The script deliberately does not create a fake migration-history table. Those checks remain NOT_RUN and need separate authorized TEST execution.

Static preparation identified two suspected failures in the current protected inputs: the migration inserts contract version `2.0.0-draft.1` while `contracts/VERSION` is `2.0.0-draft.2`; both seeds insert producer registrations without an explicit ID or a uniqueness constraint on gateway identity, so `ON CONFLICT DO NOTHING` appears insufficient to make reruns idempotent. The generated checks preserve and detect those conditions. No runtime FAIL is claimed until PostgreSQL executes them; no source SQL or Contract bytes are repaired here.
