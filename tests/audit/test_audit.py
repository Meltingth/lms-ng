"""Independent harness safety tests. Uses temporary synthetic Git repositories only."""

import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("audit", ROOT / "scripts/audit/audit.py")
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class HashTests(unittest.TestCase):
    def test_hash_matches_documented_independent_manifest(self):
        files = {"z.txt": b"z\r\n", "README.md": b"r\r", "x/SOURCE.md": b"excluded", "RELEASE_MANIFEST.json": b"excluded"}
        expected_manifest = "README.md:" + hashlib.sha256(b"r\n").hexdigest() + "\nz.txt:" + hashlib.sha256(b"z\n").hexdigest() + "\n"
        tree, entries = audit.bundle_hash(files)
        self.assertEqual(tree, "sha256:" + hashlib.sha256(expected_manifest.encode()).hexdigest())
        self.assertEqual([entry["path"] for entry in entries], ["README.md", "z.txt"])

    def test_line_endings_normalized_without_decoding_bytes(self):
        self.assertEqual(audit.bundle_hash({"x": b"\xff\r\ny\r"}), audit.bundle_hash({"x": b"\xff\ny\n"}))

    def test_changed_added_removed_and_renamed_files_change_identity(self):
        original = audit.bundle_hash({"a": b"1", "b": b"2"})[0]
        for candidate in ({"a": b"X", "b": b"2"}, {"a": b"1", "b": b"2", "c": b"3"}, {"a": b"1"}, {"a": b"1", "c": b"2"}):
            with self.subTest(candidate=candidate):
                self.assertNotEqual(original, audit.bundle_hash(candidate)[0])

    def test_empty_bundle_refused(self):
        with self.assertRaises(audit.AuditError):
            audit.bundle_hash({"SOURCE.md": b"only excluded"})

    def test_ordinal_order_matches_utf16(self):
        _, entries = audit.bundle_hash({"\U00010000": b"a", "\ue000": b"b", "Z": b"c"})
        self.assertEqual([entry["path"] for entry in entries], ["Z", "\U00010000", "\ue000"])

    def test_excluded_release_manifest_still_has_separate_approval_guard(self):
        files = {"VERSION": audit.PINNED_VERSION.encode(), "RELEASE_MANIFEST.json": json.dumps({"version": audit.PINNED_VERSION, "status": "DRAFT", "approvedBy": "unpermitted", "approvedAt": None}).encode()}
        with patch.object(audit, "PINNED_HASH", audit.bundle_hash(files)[0]):
            result = audit.frozen_result(files)
        self.assertEqual(result["result"], "FAIL")
        self.assertTrue(any("approval" in finding for finding in result["findings"]))


class GitEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="lms-ng-audit-test-")
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name).resolve()
        self.run_git("init", "-q")
        self.run_git("config", "user.name", "Synthetic QA Test")
        self.run_git("config", "user.email", "synthetic@example.invalid")
        self.run_git("config", "core.autocrlf", "false")
        self.run_git("config", "commit.gpgsign", "false")
        (self.repo / "contracts").mkdir()
        (self.repo / "contracts/VERSION").write_text(audit.PINNED_VERSION, encoding="utf-8")
        (self.repo / "contracts/RELEASE_MANIFEST.json").write_text(json.dumps({"version": audit.PINNED_VERSION, "status": "DRAFT", "approvedBy": None, "approvedAt": None}), encoding="utf-8")
        (self.repo / "contracts/schema.json").write_text('{"type":"object"}', encoding="utf-8")
        self.expected = audit.bundle_hash(audit.local_contracts(self.repo))[0]
        self.workflow = {"contractVersion": audit.PINNED_VERSION, "contractHash": self.expected,
                         "status": audit.GATE + " / " + audit.BLOCKER,
                         "gates": {name: {"status": audit.GATE if name == "G-A" else "PENDING", "approvedBy": None, "approvedAt": None}
                                   for name in ("G-A", "G-U", "G-C", "G-R", "G-H")}}
        (self.repo / "WORKFLOW_STATE.json").write_text(json.dumps(self.workflow), encoding="utf-8")
        (self.repo / "package.json").write_text('{"name":"synthetic"}', encoding="utf-8")
        (self.repo / "implementation.txt").write_text("base\n", encoding="utf-8")
        self.run_git("add", ".")
        self.run_git("commit", "-qm", "synthetic base")
        self.base = self.run_git("rev-parse", "HEAD").strip()
        (self.repo / "implementation.txt").write_text("submitted\n", encoding="utf-8")
        self.run_git("add", ".")
        self.run_git("commit", "-qm", "synthetic submitted revision")
        self.commit = self.run_git("rev-parse", "HEAD").strip()
        self.pin = patch.object(audit, "PINNED_HASH", self.expected)
        self.pin.start()
        self.addCleanup(self.pin.stop)

    def run_git(self, *args):
        return subprocess.run(["git", "-c", "core.hooksPath=" + str(self.repo / ".disabled-test-hooks"), "-c", "core.fsmonitor=false", "-C", str(self.repo), *args], check=True, capture_output=True).stdout.decode()

    def prepare(self, phase="SYNTHETIC"):
        return audit.prepare(self.repo, phase, self.commit, self.base)

    def test_requires_exact_commit_sha(self):
        for value in ("HEAD", self.commit[:8], self.commit + "~1", "--help", "f" * 40):
            with self.subTest(value=value), self.assertRaises(audit.AuditError):
                audit.full_commit(self.repo, value)
        self.assertEqual(audit.full_commit(self.repo, self.commit.upper()), self.commit)

    def test_reads_submitted_commit_despite_dirty_worktree_and_newer_head(self):
        (self.repo / "implementation.txt").write_text("future\n", encoding="utf-8")
        self.run_git("add", ".")
        self.run_git("commit", "-qm", "synthetic newer HEAD")
        (self.repo / "contracts/schema.json").write_text("dirty frozen bytes", encoding="utf-8")
        before = (self.repo / "contracts/schema.json").read_bytes()
        head = self.run_git("rev-parse", "HEAD")
        report, captured = self.prepare()
        evidence = self.repo / "docs/audit/evidence" / report.stem
        diff = (evidence / "diff.patch").read_text()
        self.assertIn("+submitted", diff)
        self.assertNotIn("+future", diff)
        self.assertNotIn("dirty frozen bytes", diff)
        self.assertEqual(captured["contract"]["result"], "PASS")
        self.assertEqual((self.repo / "contracts/schema.json").read_bytes(), before)
        self.assertEqual(self.run_git("rev-parse", "HEAD"), head)

    def test_report_blocked_and_complete_not_an_audit_pass(self):
        report, captured = self.prepare()
        text = report.read_text()
        self.assertIn("AUDIT_RESULT:\nBLOCKED", text)
        self.assertIn("NextAllowedAction:\nWAIT_FOR_ARCHITECT", text)
        self.assertIn("DeploymentRecommendation:\nDO_NOT_DEPLOY", text)
        for field in ("ClaudeCommit", "ContractVersion", "ContractHash", "Tests", "CriticalFindings", "MajorFindings", "MinorFindings", "Evidence", "RegressionRisk"):
            self.assertIn(field + ":\n", text)
        for layer in audit.LAYERS:
            self.assertIn("| " + layer + " | NOT_RUN |", text)
        self.assertEqual(captured["runtimeTests"], "NOT_RUN")
        self.assertIn("POSTGRES-EXECUTION | BLOCKED", text)
        dependencies = self.repo / "docs/audit/evidence" / report.stem / "dependency-files.json"
        self.assertEqual(json.loads(dependencies.read_text()), ["package.json"])

    def test_frozen_change_in_target_fails_without_repair(self):
        (self.repo / "contracts/schema.json").write_text("changed", encoding="utf-8")
        self.run_git("add", ".")
        self.run_git("commit", "-qm", "synthetic frozen defect")
        self.commit = self.run_git("rev-parse", "HEAD").strip()
        report, captured = self.prepare()
        self.assertEqual(captured["contract"]["result"], "FAIL")
        self.assertIn("AUDIT_RESULT:\nFAIL", report.read_text())
        self.assertEqual((self.repo / "contracts/schema.json").read_text(), "changed")

    def test_never_overwrites_prior_report_or_evidence(self):
        report, _ = self.prepare()
        before = report.read_bytes()
        with self.assertRaisesRegex(audit.AuditError, "overwrite"):
            self.prepare()
        self.assertEqual(report.read_bytes(), before)

    def test_phase_cannot_escape_audit_directory(self):
        for phase in ("../escape", "..", "x/y", "x\\y", "a b", "x" * 65):
            with self.subTest(phase=phase), self.assertRaises(audit.AuditError):
                self.prepare(phase)
        self.assertFalse((self.repo / "docs").exists())

    def test_external_diff_is_not_executed(self):
        self.run_git("config", "diff.external", "DO-NOT-EXECUTE-NONEXISTENT-COMMAND")
        report, _ = self.prepare()
        self.assertTrue(report.exists())

    def test_git_replace_cannot_substitute_submitted_content(self):
        (self.repo / "implementation.txt").write_text("replacement\n", encoding="utf-8")
        self.run_git("add", ".")
        self.run_git("commit", "-qm", "synthetic replacement content")
        replacement = self.run_git("rev-parse", "HEAD").strip()
        self.run_git("replace", self.commit, replacement)
        report, _ = self.prepare()
        diff = (self.repo / "docs/audit/evidence" / report.stem / "diff.patch").read_text()
        self.assertIn("+submitted", diff)
        self.assertNotIn("+replacement", diff)

    def test_workflow_approval_is_a_failure_not_pass(self):
        self.workflow["gates"]["G-U"]["status"] = "APPROVED"
        self.assertEqual(audit.workflow_result(json.dumps(self.workflow).encode())["result"], "FAIL")

    def test_removed_gate_cannot_pass_gate_preservation_check(self):
        del self.workflow["gates"]["G-C"]
        self.assertEqual(audit.workflow_result(json.dumps(self.workflow).encode())["result"], "FAIL")

    def test_cli_exit_distinguishes_blocked_from_pass(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(audit.main(["check-frozen", "--repo", str(self.repo)]), 0)
            self.assertEqual(audit.main(["prepare", "--repo", str(self.repo), "--phase", "CLI", "--commit", self.commit, "--base", self.base]), 2)
        self.assertFalse((self.repo / "docs/evidence").exists())


if __name__ == "__main__":
    unittest.main()
