"""Preparation tests only; these never connect to PostgreSQL."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "prepare_postgres_verification", ROOT / "scripts/database/prepare_postgres_verification.py"
)
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


class PreparationTests(unittest.TestCase):
    def test_real_inputs_unchanged_and_raw_hashes_recorded(self):
        before = {path: (ROOT / path).read_bytes() for path in generator.SOURCE_PATHS}
        bundle = generator.render_bundle(ROOT, "lms_ng_verify_unittest")
        for path, original in before.items():
            self.assertEqual((ROOT / path).read_bytes(), original)
            self.assertIn(f"-- {path}: {hashlib.sha256(original).hexdigest()}", bundle)

    def test_only_up_segment_embedded(self):
        source = "-- migrate:up\nCREATE TABLE core.t(id integer);\n-- migrate:down\nDROP SCHEMA core CASCADE;"
        self.assertEqual(generator.migration_up(source), "CREATE TABLE core.t(id integer);")
        bundle = generator.render_bundle(ROOT, "lms_ng_verify_up")
        self.assertNotIn("DROP SCHEMA", bundle)
        self.assertNotIn("-- migrate:down", bundle)

    def test_invalid_marker_order_or_duplicates_rejected(self):
        for source in (
            "-- migrate:down\n-- migrate:up", "-- migrate:up\nSELECT 1;",
            "-- migrate:up\n-- migrate:up\n-- migrate:down",
            "SELECT 1;\n-- migrate:up\nCREATE TABLE t(a int);\n-- migrate:down",
        ):
            with self.subTest(source=source), self.assertRaises(ValueError):
                generator.migration_up(source)

    def test_transaction_and_metacommand_escape_rejected(self):
        for sql in (
            "COMMIT;", "ROLLBACK;", "END;", "\\connect other\nINSERT INTO t VALUES(1);",
            "COPY t FROM PROGRAM 'something';", "INSERT INTO t VALUES(1); COMMIT;",
            "INSERT INTO t VALUES(E'escape');",
        ):
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                generator.validate_seed(sql)
        with self.assertRaises(ValueError):
            generator.migration_up("-- migrate:up\nCOMMIT;\n-- migrate:down")

    def test_sql_lexer_handles_seed_asserts_comments_and_quoted_semicolons(self):
        sql = "/* outer /* inner */ done */ INSERT INTO t VALUES ('a;''b', \"odd;name\"); -- COMMIT;\nDO $body$ BEGIN ASSERT true; END $body$;"
        self.assertEqual(len(generator.executable_statements(sql)), 2)
        self.assertEqual(generator.validate_seed(sql), sql)

    def test_incomplete_source_rejected(self):
        for sql in ("INSERT INTO t VALUES(1)", "DO $$ unterminated", "/* unterminated", "INSERT INTO t VALUES('unclosed);"):
            with self.subTest(sql=sql), self.assertRaises(ValueError):
                generator.validate_seed(sql)

    def test_guards_precede_every_application_write(self):
        bundle = generator.render_bundle(ROOT, "lms_ng_verify_guard")
        guard_end = bundle.index("END $preflight$;")
        self.assertLess(guard_end, bundle.index("CREATE SCHEMA IF NOT EXISTS core"))
        guard = bundle[:guard_end]
        for clause in ("160000 AND 169999", "current_database() <> 'lms_ng_verify_guard'", "plpgsql.check_asserts", "pg_namespace", "Existing application schema"):
            self.assertIn(clause, guard)
        self.assertIn(r"\set ON_ERROR_STOP on", guard)

    def test_unsafe_or_non_scratch_database_names_rejected(self):
        for name in ("postgres", "lms_ng", "lms_ng_verify_", "lms_ng_verify_x';COMMIT;--", "lms_ng_verify_" + "x" * 41):
            with self.subTest(name=name), self.assertRaises(ValueError):
                generator.render_bundle(ROOT, name)

    def test_seed_rerun_snapshots_keep_multiplicity_and_identity(self):
        bundle = generator.render_bundle(ROOT, "lms_ng_verify_repeat")
        self.assertEqual(bundle.count("INSERT INTO core.producer_registration (gateway_id, current_epoch)"), 4)
        self.assertIn("FROM core.producer_registration AS row_value", bundle)
        self.assertIn("jsonb_build_object('id', row_value.id)", bundle)
        self.assertIn("EXCEPT ALL", bundle)
        self.assertNotIn("EXCEPT SELECT", bundle)
        self.assertIn("seed_stable_identity", bundle)
        self.assertIn("seed_rerun_counts", bundle)
        self.assertIn("seed_rerun_rows", bundle)
        self.assertIn("ARRAY['created_at','registered_at','re_enrolled_at']", bundle)

    def test_candidate_mismatch_not_silently_rewritten(self):
        bundle = generator.render_bundle(ROOT, "lms_ng_verify_version")
        self.assertIn("VALUES ('2.0.0-draft.1', 'DRAFT'", bundle)
        self.assertIn("bool_and(version = '2.0.0-draft.2')", bundle)

    def test_negative_probes_rollback_successes_and_verify_sqlstate(self):
        bundle = generator.render_bundle(ROOT, "lms_ng_verify_errors")
        self.assertIn("ERRCODE = 'PZ001'", bundle)
        self.assertIn("actual_state = p_expected", bundle)
        self.assertIn("receipt_duplicate_message", bundle)
        self.assertIn("receipt_duplicate_stream", bundle)
        self.assertIn("receipt_int64_overflow", bundle)
        self.assertIn("receipt_sequence_zero", bundle)
        self.assertIn("floor_profile_fk", bundle)
        self.assertIn("'22003'", bundle)

    def test_final_rollback_precedes_failed_check_exit(self):
        bundle = generator.render_bundle(ROOT, "lms_ng_verify_rollback")
        final_rollback = bundle.rindex("\n\nROLLBACK;")
        failure_exit = bundle.index(r"\if :verification_failed")
        self.assertLess(final_rollback, failure_exit)
        self.assertIn("ROLLBACK TO SAVEPOINT atomic_rollback_probe;", bundle)
        self.assertIn("application schema survived final rollback", bundle)
        self.assertNotRegex(bundle, r"(?m)^COMMIT\s*;")
        self.assertIn("DURABLE_MIGRATION_AND_RUNNER_BOOKKEEPING_NOT_RUN", bundle)

    def test_plan_is_explicitly_not_execution(self):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(generator.main(["--plan"]), 0)
        parsed = json.loads(output.getvalue())
        self.assertEqual(parsed["databaseExecution"], "NOT_RUN")
        self.assertTrue(parsed["notProven"])

    def test_output_never_clobbers_existing_files_or_source(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "bundle.sql"
            output.write_text("original", encoding="utf-8")
            with self.assertRaises(FileExistsError):
                generator.write_bundle(output, "replacement", ROOT)
            self.assertEqual(output.read_text(), "original")
        for directory in ("database", "contracts", ".git", "scripts", "tests", "apps", "packages"):
            with self.subTest(directory=directory), self.assertRaises(ValueError):
                generator.write_bundle(ROOT / directory / "must-not-exist.sql", "text", ROOT)

    def test_explicit_root_portable_between_dev_and_server_layouts(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            bundles = []
            for relative in ("DEV/Software Dev/lms-ng", "PRODUCTION/lms-ng"):
                root = base / relative
                for source in generator.SOURCE_PATHS:
                    destination = root / source
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(ROOT / source, destination)
                output = base / ("dev.sql" if relative.startswith("DEV") else "production.sql")
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(generator.main(["--repo-root", str(root), "--output", str(output), "--scratch-database", "lms_ng_verify_portable"]), 0)
                bundles.append(output.read_text(encoding="utf-8"))
            self.assertEqual(bundles[0], bundles[1])
            self.assertNotIn(str(base), bundles[0])


if __name__ == "__main__":
    unittest.main()
