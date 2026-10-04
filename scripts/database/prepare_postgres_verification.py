"""Prepare, never execute, a rollback-only PostgreSQL 16 verification bundle.

Only Python's standard library is used. Run --plan for scope and limitations.
The generated file is a psql script, not a migration or deployment artifact.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


SOURCE_PATHS = (
    "database/migrations/0001_schema_v2_draft.sql",
    "database/seeds/whz.sql",
    "database/seeds/test.sql",
    "contracts/VERSION",
)
APPLICATION_SCHEMAS = ("core", "telemetry", "alarm", "command", "auth", "audit")
SEED_TABLES = {
    "core.organization": ("id",), "core.site": ("id",),
    "core.building": ("id",), "core.floor_profile": ("id",),
    "core.floor_profile_version": ("profile_id", "version"),
    "core.floor_mapping": ("profile_id", "version", "code"),
    "core.signal_config_version": ("id",), "core.elevator": ("id",),
    "core.gateway": ("id",), "core.gateway_binding": ("elevator_id",),
    "core.signal_point": ("elevator_id", "point"),
    "core.producer_registration": ("id",), "alarm.definition": ("code",),
    'auth."user"': ("id",),
}


def executable_statements(sql: str) -> list[str]:
    """Lex top-level statements, ignoring comments and quoted bodies.

    This is deliberately a conservative source guard, not a SQL validator.
    Dollar bodies are opaque here; PostgreSQL validates them during execution.
    """
    statements: list[str] = []
    current: list[str] = []
    i = 0
    while i < len(sql):
        if sql.startswith("--", i):
            end = sql.find("\n", i)
            i = len(sql) if end < 0 else end + 1
            current.append(" ")
        elif sql.startswith("/*", i):
            depth = 1
            i += 2
            while i < len(sql) and depth:
                if sql.startswith("/*", i):
                    depth += 1
                    i += 2
                elif sql.startswith("*/", i):
                    depth -= 1
                    i += 2
                else:
                    i += 1
            if depth:
                raise ValueError("Unterminated SQL comment")
            current.append(" ")
        elif sql[i] in "'\"":
            quote = sql[i]
            # E-strings have extra escaping rules; current immutable inputs use none.
            if quote == "'" and i and sql[i - 1] in "Ee" and (
                i < 2 or not (sql[i - 2].isalnum() or sql[i - 2] == "_")
            ):
                raise ValueError("E-strings require source-guard review")
            i += 1
            while i < len(sql):
                if sql[i] == quote:
                    i += 1
                    if i < len(sql) and sql[i] == quote:
                        i += 1
                        continue
                    break
                if sql[i] == "\\":
                    raise ValueError("Backslash in SQL quoted input requires review")
                i += 1
            else:
                raise ValueError("Unterminated SQL quote")
            current.append(" quoted ")
        elif sql[i] == "$" and (match := re.match(r"\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$", sql[i:])):
            delimiter = match.group()
            end = sql.find(delimiter, i + len(delimiter))
            if end < 0:
                raise ValueError("Unterminated SQL dollar quote")
            current.append(" dollar_body ")
            i = end + len(delimiter)
        elif sql[i] == "\\":
            raise ValueError("psql metacommands are forbidden in source inputs")
        elif sql[i] == ";":
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current.clear()
            i += 1
        else:
            current.append(sql[i])
            i += 1
    if "".join(current).strip():
        raise ValueError("Every source statement must end with a semicolon")
    return statements


def migration_up(source: str) -> str:
    markers = list(re.finditer(r"(?m)^-- migrate:(up|down)[ \t]*$", source))
    if [match[1] for match in markers] != ["up", "down"]:
        raise ValueError("Expected exactly one migrate:up followed by one migrate:down")
    if executable_statements(source[:markers[0].start()]):
        raise ValueError("SQL before migrate:up is forbidden")
    up = source[markers[0].end():markers[1].start()].strip()
    statements = executable_statements(up)
    if not statements:
        raise ValueError("Migration up is empty")
    for statement in statements:
        if not re.match(r"(?i)^(?:CREATE\s+(?:SCHEMA|TABLE|EXTENSION|(?:UNIQUE\s+)?INDEX)\b|INSERT\s+INTO\b)", statement):
            raise ValueError("Migration contains an unsupported top-level statement")
    return up


def validate_seed(source: str) -> str:
    statements = executable_statements(source)
    if not statements or any(not re.match(r"(?i)^(?:INSERT\s+INTO\b|DO\s+dollar_body\s*$)", item) for item in statements):
        raise ValueError("Seed contains an unsupported top-level statement")
    return source.strip()


def load_sources(repo_root: Path) -> tuple[dict[str, str], dict[str, str]]:
    texts, hashes = {}, {}
    for relative in SOURCE_PATHS:
        data = (repo_root / relative).read_bytes()
        texts[relative] = data.decode("utf-8-sig").replace("\r\n", "\n")
        hashes[relative] = hashlib.sha256(data).hexdigest()
    return texts, hashes


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def seed_snapshot_query() -> str:
    parts = []
    for table, keys in SEED_TABLES.items():
        key_args = ", ".join(f"{sql_literal(key)}, row_value.{key}" for key in keys)
        parts.append(
            f"SELECT {sql_literal(table)} AS relation_name, "
            f"jsonb_build_object({key_args}) AS identity_data, "
            "to_jsonb(row_value) - ARRAY['created_at','registered_at','re_enrolled_at']::text[] AS row_data "
            f"FROM {table} AS row_value"
        )
    return "\nUNION ALL\n".join(parts)


def check(name: str, predicate: str, detail: str) -> str:
    return f"SELECT pg_temp.record_check({sql_literal(name)}, ({predicate}), {sql_literal(detail)});"


def expected_failure(name: str, statement: str, sqlstate: str) -> str:
    return f"SELECT pg_temp.expect_failure({sql_literal(name)}, {sql_literal(statement)}, {sql_literal(sqlstate)});"


def plan() -> dict:
    return {
        "mode": "PREPARATION_ONLY", "databaseExecution": "NOT_RUN",
        "sourcePaths": list(SOURCE_PATHS), "serverMajorRequired": 16,
        "output": "psql script; dedicated lms_ng_verify_* scratch database only; final ROLLBACK",
        "checksPrepared": [
            "version, exact database name, empty application schemas and enabled assertions guards",
            "migrate:up only; WHZ and TEST seed assertions",
            "seed rerun row counts, stable identity and row contents via EXCEPT ALL snapshots",
            "candidate version consistency and floor profile counts/anchors",
            "selected CHECK/FK constraints, signed int64 bounds, both ingest dedupe keys",
            "savepoint rollback across receipt/current/event/outbox writes; final schema absence",
        ],
        "notProven": [
            "any PostgreSQL execution until an authorized operator runs the script",
            "migration-runner bookkeeping, durable COMMIT, backup/restore or deployed migration",
            "fresh-database-from-zero rerun across separate databases or stable fresh-seed UUIDs",
            "all constraints, concurrent transactions, backend ingestion/ACK semantics or Contract approval",
        ],
    }


def render_bundle(repo_root: Path, scratch_database: str) -> str:
    if not re.fullmatch(r"lms_ng_verify_[a-z0-9_]{1,40}", scratch_database):
        raise ValueError("Scratch database name must match lms_ng_verify_[a-z0-9_]{1,40}")
    sources, hashes = load_sources(repo_root)
    up = migration_up(sources[SOURCE_PATHS[0]])
    seeds = "\n\n".join(validate_seed(sources[path]) for path in SOURCE_PATHS[1:3])
    version = sources[SOURCE_PATHS[3]].strip()
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?", version):
        raise ValueError("Unexpected candidate version")
    schema_literals = ", ".join(map(sql_literal, APPLICATION_SCHEMAS))
    snapshot = seed_snapshot_query()
    pieces = [
        "-- PREPARATION ONLY: this generated script has NOT been executed by the generator.",
        "-- Use a fresh psql -X session on the explicitly authorized, dedicated scratch host.",
        "-- Requires create-schema/extension permissions; never run against an existing application DB.",
        "-- Seed REAL labels are scratch fixtures; no network, MQTT, Capture or hardware action occurs.",
        "-- Rollback-only checks do not prove durable deployment or migration-runner bookkeeping.",
        "-- Input SHA-256 values cover raw source bytes (not the Contract tree-hash algorithm):",
        *(f"-- {path}: {digest}" for path, digest in hashes.items()),
        r"\set ON_ERROR_STOP on", r"\set AUTOCOMMIT on", "BEGIN;",
        "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '60s';",
        "SET LOCAL idle_in_transaction_session_timeout = '120s';",
        f"""DO $preflight$
BEGIN
    IF current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999 THEN
        RAISE EXCEPTION 'Requires PostgreSQL major 16';
    END IF;
    IF current_database() <> {sql_literal(scratch_database)} THEN
        RAISE EXCEPTION 'Wrong scratch database; no application changes permitted';
    END IF;
    IF current_setting('plpgsql.check_asserts', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'plpgsql.check_asserts must be ON';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ({schema_literals})) THEN
        RAISE EXCEPTION 'Existing application schema; refusing all migration and seed writes';
    END IF;
END $preflight$;""",
        "-- BEGIN IMMUTABLE MIGRATION UP (the down segment is excluded).", up,
        "-- END IMMUTABLE MIGRATION UP.",
        """CREATE TEMP TABLE verification_results (
    check_id text PRIMARY KEY, status text NOT NULL, detail text NOT NULL
) ON COMMIT DROP;
CREATE FUNCTION pg_temp.record_check(p_name text, p_ok boolean, p_detail text)
RETURNS void LANGUAGE plpgsql AS $record$
BEGIN
    INSERT INTO verification_results VALUES (p_name, CASE WHEN p_ok IS TRUE THEN 'PASS' ELSE 'FAIL' END, p_detail);
END $record$;
CREATE FUNCTION pg_temp.expect_failure(p_name text, p_sql text, p_expected text)
RETURNS void LANGUAGE plpgsql AS $expected$
DECLARE actual_state text;
BEGIN
    BEGIN
        EXECUTE p_sql;
        -- Roll back even an unexpectedly successful write in this subtransaction.
        RAISE EXCEPTION USING ERRCODE = 'PZ001', MESSAGE = 'Expected rejection did not occur';
    EXCEPTION
        WHEN SQLSTATE 'PZ001' THEN actual_state := NULL;
        WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
    END;
    PERFORM pg_temp.record_check(p_name, actual_state = p_expected,
        'expected SQLSTATE=' || p_expected || '; actual=' || coalesce(actual_state, 'NO_REJECTION'));
END $expected$;""",
        check("candidate_version", f"SELECT count(*) = 1 AND bool_and(version = {sql_literal(version)}) FROM core.contract_version", "Migration contract-version rows must match supplied candidate VERSION"),
        "-- FIRST SEED EXECUTION: all original ASSERT statements remain enabled.", seeds,
        f"CREATE TEMP TABLE seed_before ON COMMIT DROP AS {snapshot};",
        "-- SECOND SEED EXECUTION: sources are deliberately unchanged.", seeds,
        f"CREATE TEMP TABLE seed_after ON COMMIT DROP AS {snapshot};",
    ]
    for name, projection in (
        ("seed_rerun_counts", "relation_name, count(*) AS row_count"),
        ("seed_stable_identity", "relation_name, identity_data"),
        ("seed_rerun_rows", "relation_name, row_data"),
    ):
        group = " GROUP BY relation_name" if name.endswith("counts") else ""
        left = f"SELECT {projection} FROM seed_before{group}"
        right = f"SELECT {projection} FROM seed_after{group}"
        predicate = f"NOT EXISTS (({left} EXCEPT ALL {right}) UNION ALL ({right} EXCEPT ALL {left}))"
        pieces.append(check(name, predicate, "Compare all seeded tables; preserve multiplicity and UUID/composite identity"))
    pieces.extend([
        check("passenger_mapping", "SELECT count(*)=46 AND count(*) FILTER (WHERE is_landing)=43 FROM core.floor_mapping WHERE profile_id='WHZ-PAX' AND version=1", "46 codes and 43 landings"),
        check("passenger_anchors", "SELECT string_agg(label, ',' ORDER BY code)='B1,1,9,20,26,32,33,36,37,44' FROM core.floor_mapping WHERE profile_id='WHZ-PAX' AND version=1 AND code IN (1,2,12,22,28,34,35,38,39,46)", "Ten authoritative passenger anchors"),
        check("service_mapping", "SELECT count(*)=47 AND count(*) FILTER (WHERE calibrated)=3 AND count(*) FILTER (WHERE NOT calibrated AND label IS NULL AND code BETWEEN 3 AND 46)=44 FROM core.floor_mapping WHERE profile_id='WHZ-SERVICE' AND version=1", "W-05 three calibrated and 44 uncalibrated codes"),
        check("service_anchors", "SELECT string_agg(label, ',' ORDER BY code)='B1,1,44' FROM core.floor_mapping WHERE profile_id='WHZ-SERVICE' AND version=1 AND calibrated", "W-05 confirmed anchors only"),
        check("elevator_scope", "SELECT count(*)=8 AND count(*) FILTER (WHERE gateway_type='REAL')=5 AND count(*) FILTER (WHERE gateway_type='SIM')=3 FROM core.elevator", "Five WHZ and three TEST elevator registry rows"),
        check("w04_service", "SELECT commissioning_status='COMMISSIONED' AND service_status='OUT_OF_SERVICE' AND NOT monitoring_enabled FROM core.elevator WHERE code='W-04'", "Commissioning and service remain independent"),
    ])
    constraints = (
        ("floor_code_range", "INSERT INTO core.floor_mapping(profile_id,version,code) VALUES ('WHZ-PAX',1,64)", "23514"),
        ("floor_calibrated_label", "INSERT INTO core.floor_mapping(profile_id,version,code,is_landing,calibrated,label) VALUES ('WHZ-PAX',1,0,true,true,NULL)", "23514"),
        ("floor_profile_fk", "INSERT INTO core.floor_mapping(profile_id,version,code) VALUES ('MISSING',1,0)", "23503"),
        ("lift_id_range", "UPDATE core.elevator SET lift_id=0 WHERE code='S-01'", "23514"),
        ("service_enum", "UPDATE core.elevator SET service_status='INVALID' WHERE code='S-01'", "23514"),
        ("gateway_type_enum", "UPDATE core.gateway SET gateway_type='INVALID' WHERE code='GW-SIM-01'", "23514"),
        ("signal_pin_range", "UPDATE core.signal_point SET pin=1 WHERE point='RUNNING'", "23514"),
        ("signal_point_enum", "UPDATE core.signal_point SET point='INVALID' WHERE point='RUNNING'", "23514"),
        ("alarm_severity_enum", "UPDATE alarm.definition SET severity='INVALID' WHERE code='STALE_DATA'", "23514"),
        ("user_role_enum", "UPDATE auth.\"user\" SET role='INVALID' WHERE username='joy'", "23514"),
    )
    pieces.extend(expected_failure(*item) for item in constraints)
    receipt_columns = "message_id,producer_id,producer_epoch,stream_id,stream_seq,payload_hash"
    producer = "ffffffff-0000-4000-8000-000000000001"
    stream = "ffffffff-0000-4000-8000-000000000002"
    message = "ffffffff-0000-4000-8000-000000000003"

    def receipt(message_id: str, stream_seq: str) -> str:
        return f"INSERT INTO telemetry.ingest_receipt({receipt_columns}) VALUES ('{message_id}','{producer}',1,'{stream}',{stream_seq},repeat('0',64))"

    pieces.extend([
        receipt(message, "9223372036854775807") + ";",
        check("receipt_int64_max", f"SELECT stream_seq=9223372036854775807 FROM telemetry.ingest_receipt WHERE message_id='{message}'", "Signed int64 maximum stored exactly"),
        expected_failure("receipt_duplicate_message", receipt(message, "1"), "23505"),
        expected_failure("receipt_duplicate_stream", receipt("ffffffff-0000-4000-8000-000000000004", "9223372036854775807"), "23505"),
        expected_failure("receipt_sequence_zero", receipt("ffffffff-0000-4000-8000-000000000005", "0"), "23514"),
        expected_failure("receipt_int64_overflow", receipt("ffffffff-0000-4000-8000-000000000005", "9223372036854775808"), "22003"),
        "SAVEPOINT atomic_rollback_probe;",
        receipt("ffffffff-0000-4000-8000-000000000006", "1") + ";",
        f"""INSERT INTO telemetry.current_state(elevator_id,gateway_id,producer_id,producer_epoch,stream_id,stream_seq,event_time,origin)
VALUES ('99999999-0000-4000-8000-000000000021','99999999-0000-4000-8000-000000000004','{producer}',1,'{stream}',1,'2026-10-01T00:00:00Z','SIMULATED');
INSERT INTO telemetry.events(event_time,elevator_id,gateway_id,producer_id,producer_epoch,stream_id,stream_seq,event_type,origin)
VALUES ('2026-10-01T00:00:00Z','99999999-0000-4000-8000-000000000021','99999999-0000-4000-8000-000000000004','{producer}',1,'{stream}',1,'VERIFICATION_ROLLBACK','SIMULATED');
INSERT INTO telemetry.realtime_outbox(kind,payload) VALUES ('VERIFICATION_ROLLBACK','{{}}');""",
        "ROLLBACK TO SAVEPOINT atomic_rollback_probe;", "RELEASE SAVEPOINT atomic_rollback_probe;",
        check("atomic_rollback", "NOT EXISTS(SELECT 1 FROM telemetry.ingest_receipt WHERE message_id='ffffffff-0000-4000-8000-000000000006') AND NOT EXISTS(SELECT 1 FROM telemetry.current_state) AND NOT EXISTS(SELECT 1 FROM telemetry.events) AND NOT EXISTS(SELECT 1 FROM telemetry.realtime_outbox)", "Receipt, current state, partitioned event and outbox all rolled back together; sequences need not rewind"),
        "SELECT check_id, status, detail FROM verification_results ORDER BY check_id;",
        "SELECT EXISTS(SELECT 1 FROM verification_results WHERE status='FAIL') AS verification_failed \\gset",
        "-- No COMMIT occurs. Source DDL and scratch data are removed together.", "ROLLBACK;",
        f"""DO $post_rollback$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ({schema_literals})) THEN
        RAISE EXCEPTION 'FAIL: application schema survived final rollback';
    END IF;
END $post_rollback$;""",
        r"\if :verification_failed",
        "DO $failed$ BEGIN RAISE EXCEPTION 'FAIL: verification checks failed; scratch transaction was rolled back'; END $failed$;",
        r"\endif",
        "SELECT 'ROLLBACK_ONLY_CHECKS_PASS; DURABLE_MIGRATION_AND_RUNNER_BOOKKEEPING_NOT_RUN' AS result;",
    ])
    return "\n\n".join(pieces) + "\n"


def write_bundle(output: Path, bundle: str, repo_root: Path) -> None:
    resolved = output.resolve()
    for relative in ("contracts", "database", ".git", "scripts", "tests", "apps", "packages"):
        protected = (repo_root / relative).resolve()
        if resolved == protected or protected in resolved.parents:
            raise ValueError("Output must not overwrite source or protected repository directories")
    # Exclusive creation prevents clobbering existing evidence or any source file.
    with output.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(bundle)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2], help="Repository containing immutable database inputs; defaults to script discovery")
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--plan", action="store_true", help="Print scope/limitations JSON; create no files")
    action.add_argument("--output", type=Path, help="New output .sql file; parent must already exist; never overwritten")
    parser.add_argument("--scratch-database", help="Exact authorized scratch database name, lms_ng_verify_*")
    args = parser.parse_args(argv)
    if args.plan:
        print(json.dumps(plan(), indent=2))
        return 0
    if not args.scratch_database:
        parser.error("--output requires --scratch-database")
    try:
        root = args.repo_root.resolve(strict=True)
        bundle = render_bundle(root, args.scratch_database)
        write_bundle(args.output, bundle, root)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"Preparation failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "PREPARED_NOT_EXECUTED", "output": str(args.output.resolve()), "databaseExecution": "NOT_RUN"}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
