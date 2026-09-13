#!/usr/bin/env python3
"""Local, read-only Git inspection; writes new evidence only under docs/audit.

This is an evidence scaffold, not a runtime auditor or a gate approval tool.
No code, hooks, filters, or tests from the inspected revision are executed.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


PINNED_VERSION = "2.0.0-draft.2"
PINNED_HASH = "sha256:ed2414fb8e830a9c281499c9a5cff8ba441668acb5b98fbb2265a6da5e4d18b3"
GATE = "WAITING_FOR_G-A"
BLOCKER = "BLOCKED_ON_POSTGRES_EXECUTION_EVIDENCE"
EXCLUDED_NAMES = {"RELEASE_MANIFEST.json", "SOURCE.md"}
STATUSES = {"PASS", "FAIL", "BLOCKED", "NOT_RUN"}
LAYERS = {
    "A-CONTRACT": "MQTT v2; JSON Schema; /api/v2; WS v2; enums/IDs; streamSeq; producerEpoch; origin; clockQuality; ACK; presence; backend-owned floor mapping",
    "B-CORRECTNESS": "Logic; errors; transitions; concurrency/locking; async; cleanup; timeouts; retries; changed files and dependency review",
    "C-REGRESSION": "Known-good behavior; no serial/firmware writes; no output pin setup; no COM stealing; no Capture stop or unauthorized logger refactor",
    "D-INTEGRITY": "messageId/identity; dedupe/payloadHash; DB_COMMITTED vs PUBACK; retry identity; reorder/backlog; monotonic current state",
    "E-RELIABILITY": "Authorized local faults only: API/DB/Redis/EMQX outages; ACK loss; duplicates/reorder; restart/reconnect; stale snapshot; clock rollback; outbox backlog",
    "F-SECURITY": "Auth/RBAC; MQTT ACL; TEST/REAL/DEMO isolation; secrets/TLS; WS auth; logs; traversal/injection; dependency risk; no REAL control",
    "G-PERFORMANCE": "Measured throughput/API/WS/render latency; HUD FPS; memory/CPU/query/backlog behavior; distinguish measurements from targets",
    "H-DEPLOYMENT": "Migration order; backup/rollback; env; volumes; health/startup/cold boot/restart; no deployment from a passing test",
    "I-UX": "LIVE/SIMULATED truthfulness; DEMO isolation; UNKNOWN/UNCALIBRATED; stale/age; offline evidence; backend floor ownership",
}


class AuditError(Exception):
    pass


def git(repo: Path, *args: str) -> bytes:
    # No shell, no checked-out revision, no hooks, no external diff or textconv.
    command = ["git", "--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-C", str(repo), *args]
    result = subprocess.run(command, capture_output=True, check=False)
    if result.returncode:
        raise AuditError(f"git {' '.join(args)}: {result.stderr.decode('utf-8', errors='replace').strip()}")
    return result.stdout


def repository(path: str | Path) -> Path:
    requested = Path(path).resolve(strict=True)
    root = Path(git(requested, "rev-parse", "--show-toplevel").decode().strip()).resolve()
    if root != requested:
        raise AuditError("--repo must identify the repository root")
    return root


def full_commit(repo: Path, value: str) -> str:
    if not re.fullmatch(r"[0-9a-fA-F]{40}", value):
        raise AuditError("Provide a full 40-character commit SHA, not a branch, tag, prefix, or revision expression")
    resolved = git(repo, "rev-parse", "--verify", value + "^{commit}").decode().strip()
    if resolved.lower() != value.lower():
        raise AuditError("SHA must identify the commit itself, not a tag object")
    return resolved


def normalized(data: bytes) -> bytes:
    return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


def bundle_hash(files: dict[str, bytes]) -> tuple[str, list[dict[str, str]]]:
    included = {name: data for name, data in files.items() if Path(name).name not in EXCLUDED_NAMES}
    if not included:
        raise AuditError("Refusing to hash an empty contracts bundle")
    # Match .NET StringComparer.Ordinal used by scripts/contracts-hash.ps1,
    # including supplementary Unicode paths (UTF-16 code-unit ordering).
    ordered = sorted(included, key=lambda value: value.encode("utf-16-be", errors="surrogatepass"))
    entries = [{"path": name, "sha256": hashlib.sha256(normalized(included[name])).hexdigest()} for name in ordered]
    manifest = "".join(f"{entry['path']}:{entry['sha256']}\n" for entry in entries).encode("utf-8")
    return "sha256:" + hashlib.sha256(manifest).hexdigest(), entries


def local_contracts(repo: Path) -> dict[str, bytes]:
    root = repo / "contracts"
    if root.is_symlink() or not root.is_dir():
        raise AuditError("contracts must be a real local directory")
    files = {}
    for path in root.rglob("*"):
        if path.is_symlink():
            raise AuditError(f"Symlink refused in frozen bundle: {path}")
        if path.is_file():
            if not path.resolve().is_relative_to(root.resolve()):
                raise AuditError("Frozen bundle path escapes contracts directory")
            files[path.relative_to(root).as_posix()] = path.read_bytes()
    return files


def committed_contracts(repo: Path, commit: str) -> dict[str, bytes]:
    files = {}
    for record in git(repo, "ls-tree", "-r", "-z", commit, "--", "contracts/").split(b"\0"):
        if not record:
            continue
        metadata, raw_path = record.split(b"\t", 1)
        mode, kind, object_id = metadata.decode("ascii").split()
        if kind != "blob" or mode not in {"100644", "100755"}:
            raise AuditError("Non-regular object refused in frozen bundle")
        path = raw_path.decode("utf-8", errors="strict")
        files[path.removeprefix("contracts/")] = git(repo, "cat-file", "blob", object_id)
    return files


def frozen_result(files: dict[str, bytes]) -> dict:
    actual_hash, entries = bundle_hash(files)
    actual_version = files.get("VERSION", b"").decode("utf-8-sig").strip()
    reasons = []
    if actual_hash != PINNED_HASH:
        reasons.append("Contract tree hash differs from the mandate pin; report the defect and wait for Architect instruction")
    if actual_version != PINNED_VERSION:
        reasons.append("Contract VERSION differs from the mandate pin")
    try:
        release = json.loads(files["RELEASE_MANIFEST.json"].decode("utf-8-sig"))
        if release.get("version") != PINNED_VERSION or release.get("status") != "DRAFT":
            reasons.append("Release manifest no longer identifies the frozen DRAFT candidate")
        if release.get("approvedBy") is not None or release.get("approvedAt") is not None:
            reasons.append("Release manifest contains approval; current mandate requires an unapproved candidate")
    except (KeyError, UnicodeError, ValueError, AttributeError):
        reasons.append("Missing or invalid release manifest")
    return {
        "result": "FAIL" if reasons else "PASS",
        "scope": "Frozen bundle identity only; no contract correctness or gate approval asserted",
        "expectedVersion": PINNED_VERSION,
        "actualVersion": actual_version,
        "expectedHash": PINNED_HASH,
        "actualHash": actual_hash,
        "excludedNames": sorted(EXCLUDED_NAMES),
        "fileCount": len(entries),
        "files": entries,
        "findings": reasons,
    }


def workflow_result(raw: bytes) -> dict:
    try:
        state = json.loads(raw.decode("utf-8-sig"))
        ga = state["gates"]["G-A"]
        valid = (
            state["contractVersion"] == PINNED_VERSION
            and state["contractHash"] == PINNED_HASH
            and GATE in state["status"]
            and BLOCKER in state["status"]
            and ga["status"] == GATE
            and set(state["gates"]) == {"G-A", "G-U", "G-C", "G-R", "G-H"}
            and all(gate.get("approvedBy") is None and gate.get("approvedAt") is None
                    and gate.get("status") == (GATE if name == "G-A" else "PENDING")
                    for name, gate in state["gates"].items())
        )
        return {"result": "PASS" if valid else "FAIL", "scope": "Recorded gate state only; environment availability not independently verified", "status": state["status"]}
    except (KeyError, TypeError, ValueError, UnicodeError, AttributeError):
        return {"result": "FAIL", "scope": "Recorded gate state", "detail": "Missing or invalid expected workflow fields"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def check_frozen(repo: Path) -> dict:
    return {"capturedAt": now(), "source": "current local working tree; not a Claude commit audit",
            "contract": frozen_result(local_contracts(repo)),
            "workflow": workflow_result((repo / "WORKFLOW_STATE.json").read_bytes()),
            "gate": GATE, "blocker": BLOCKER, "nextAllowedAction": "WAIT_FOR_ARCHITECT"}


def report_text(phase: str, commit: str, base: str, evidence: str, captured: dict) -> str:
    checks = [
        ("EXACT-SHA", "PASS", "Git commit/base objects resolved; this proves identity, not correctness"),
        ("DIFF-CAPTURE", "PASS", "Binary-safe Git patch and full file inventory captured; human review NOT_RUN"),
        ("FROZEN-CONTRACT", captured["contract"]["result"], captured["contract"]["actualHash"]),
        ("GATE-RECORD", captured["workflow"]["result"], "Read-only inspection of committed workflow fields"),
        ("POSTGRES-EXECUTION", "BLOCKED", "Mandate environment blocker remains; no DB environment was probed or started"),
    ] + [(name, "NOT_RUN", description) for name, description in LAYERS.items()]
    verdict = "FAIL" if any(status == "FAIL" for _, status, _ in checks) else "BLOCKED"
    rows = "\n".join(f"| {name} | {status} | {description} |" for name, status, description in checks)
    groups = "\n".join(f"{status}: {', '.join(name for name, result, _ in checks if result == status) or '(none)'}" for status in ("PASS", "FAIL", "BLOCKED", "NOT_RUN"))
    findings = captured["contract"]["findings"]
    major = "\n".join(f"- FAIL: {finding}" for finding in findings) or "- NOT_RUN: Independent implementation review pending; absence of findings is not evidence of correctness."
    return f"""# Claude audit scaffold: {phase}

BLOCKED: This report captures an exact submitted revision for independent review. Runtime,
failure-path, dependency, security, integrity, regression and deployment review remain unperformed.
PASS below is restricted to the named evidence-capture checks. Author identity and submission
authority require reviewer confirmation; providing a SHA does not establish Claude authorship.

- PASS: ClaudeCommit selected explicitly: `{commit}`.
- PASS: Comparison base selected explicitly: `{base}` (two-tree diff, not inferred merge-base).
- PASS: Evidence captured at `{captured['capturedAt']}`.
- BLOCKED: `{GATE}` / `{BLOCKER}`. No approval or deployment follows from this report.
- NOT_RUN: Confirm the agreed change scope and all parent commits for a merge submission.

| Assertion/test | Status | Evidence or remaining review |
| --- | --- | --- |
{rows}

## Reviewer work remaining

NOT_RUN: Inspect `diff.patch`, `changed-files.json` and `dependency-files.json` from `{evidence}`.
Record each applicable layer's concrete assertion, command, exit code, actual output, timestamp,
evidence path and limitations. For an inapplicable check, retain NOT_RUN with a reason.
Run reviewed local tests in an isolated checkout of the exact SHA only after inspecting their
side effects. Do not execute unreviewed scripts, use current-worktree results as submitted-SHA
evidence, overwrite prior evidence, or touch Capture/hardware. Record unavailable prerequisites
as BLOCKED and unattempted checks as NOT_RUN. Never infer PASS from either status.

NOT_RUN: Future runtime evidence must include the test checkout SHA, cleanliness before/after,
test-tool versions, command/output/exit code, dependency-lock identity, fixture identity and
artifact hashes. Existing Claude result files are context only, not independent execution proof.

## Required audit footer

```text
AUDIT_RESULT:
{verdict}

ClaudeCommit:
{commit}

ContractVersion:
{PINNED_VERSION}

ContractHash:
{PINNED_HASH}

Tests:
{groups}

CriticalFindings:
- NOT_RUN: Independent critical finding review pending.

MajorFindings:
{major}

MinorFindings:
- NOT_RUN: Independent minor finding review pending.

Evidence:
- PASS: {evidence}/capture.json
- PASS: {evidence}/diff.patch
- PASS: {evidence}/changed-files.json
- PASS: {evidence}/dependency-files.json

RegressionRisk:
HIGH

DeploymentRecommendation:
DO_NOT_DEPLOY

NextAllowedAction:
WAIT_FOR_ARCHITECT
```
"""


def prepare(repo: Path, phase: str, candidate: str, comparison: str) -> tuple[Path, dict]:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", phase):
        raise AuditError("phase must contain only letters, digits, underscores or hyphens (1-64 characters)")
    commit, base = full_commit(repo, candidate), full_commit(repo, comparison)
    name = f"AUDIT_{phase}_{commit}"
    audit_root = repo / "docs" / "audit"
    report = audit_root / f"{name}.md"
    evidence_dir = audit_root / "evidence" / name
    # Prevent a junction or symlink from redirecting writes outside the audit area.
    if audit_root.resolve() != audit_root or evidence_dir.resolve() != evidence_dir:
        raise AuditError("Audit output path must not traverse a link or junction")
    if report.exists() or evidence_dir.exists():
        raise AuditError("Evidence/report already exists; refusing to overwrite a prior audit")

    changed = [p.decode("utf-8") for p in git(repo, "diff", "--no-ext-diff", "--no-textconv", "--name-only", "-z", base, commit, "--").split(b"\0") if p]
    patch = git(repo, "diff", "--no-ext-diff", "--no-textconv", "--binary", "--full-index", base, commit, "--")
    tree_paths = [p.decode("utf-8") for p in git(repo, "ls-tree", "-r", "--name-only", "-z", commit).split(b"\0") if p]
    dependency_names = {"package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "pyproject.toml", "Pipfile", "Pipfile.lock", "poetry.lock", "uv.lock", "Cargo.toml", "Cargo.lock", "go.mod", "go.sum", "Dockerfile"}
    dependencies = [p for p in tree_paths if Path(p).name in dependency_names or Path(p).name.startswith("requirements") or Path(p).name.startswith("compose.")]
    captured = {
        "schemaVersion": 1, "capturedAt": now(), "purpose": "Evidence capture only; not implementation approval",
        "claudeCommit": commit, "comparisonBase": base,
        "commitTree": git(repo, "rev-parse", commit + "^{tree}").decode().strip(),
        "commitParents": git(repo, "show", "-s", "--format=%P", commit).decode().strip().split(),
        "gitVersion": git(repo, "--version").decode().strip(), "pythonVersion": sys.version,
        "collectorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "diffSha256": hashlib.sha256(patch).hexdigest(),
        "localContext": {"head": git(repo, "rev-parse", "HEAD").decode().strip(),
                         "status": git(repo, "status", "--short", "--untracked-files=normal").decode("utf-8", errors="replace"),
                         "note": "Local checkout context only; captured target files come from Git objects"},
        "contract": frozen_result(committed_contracts(repo, commit)),
        "workflow": workflow_result(git(repo, "show", commit + ":WORKFLOW_STATE.json")),
        "gate": GATE, "blocker": BLOCKER, "runtimeTests": "NOT_RUN", "independentReview": "NOT_RUN",
        "deploymentRecommendation": "DO_NOT_DEPLOY", "nextAllowedAction": "WAIT_FOR_ARCHITECT",
        "readCommands": ["git rev-parse --verify <sha>^{commit}", "git diff --no-ext-diff --no-textconv --name-only -z <base> <sha> --", "git diff --no-ext-diff --no-textconv --binary --full-index <base> <sha> --", "git ls-tree -r -z <sha> -- contracts/", "git cat-file blob <object-id>", "git show <sha>:WORKFLOW_STATE.json"],
    }
    evidence_relative = evidence_dir.relative_to(repo).as_posix()
    evidence_dir.mkdir(parents=True, exist_ok=False)
    for filename, value in (("capture.json", captured), ("changed-files.json", changed), ("dependency-files.json", dependencies)):
        with (evidence_dir / filename).open("x", encoding="utf-8", newline="\n") as output:
            json.dump(value, output, indent=2, ensure_ascii=False)
            output.write("\n")
    with (evidence_dir / "diff.patch").open("xb") as output:
        output.write(patch)
    with report.open("x", encoding="utf-8", newline="\n") as output:
        output.write(report_text(phase, commit, base, evidence_relative, captured))
    return report, captured


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    check = commands.add_parser("check-frozen", help="Read current contract bytes/gate fields and print JSON; never writes")
    check.add_argument("--repo", default=".")
    capture = commands.add_parser("prepare", help="Capture exact-SHA evidence and a BLOCKED/FAIL report; never executes reviewed code")
    capture.add_argument("--repo", default=".")
    capture.add_argument("--phase", required=True)
    capture.add_argument("--commit", required=True, help="Explicit full SHA submitted for independent Claude review")
    capture.add_argument("--base", required=True, help="Explicit full SHA defining the agreed comparison baseline")
    args = parser.parse_args(argv)
    try:
        repo = repository(args.repo)
        if args.command == "check-frozen":
            result = check_frozen(repo)
            print(json.dumps(result, indent=2))
            return 1 if any(result[name]["result"] == "FAIL" for name in ("contract", "workflow")) else 0
        report, captured = prepare(repo, args.phase, args.commit, args.base)
        verdict = "FAIL" if any(captured[name]["result"] == "FAIL" for name in ("contract", "workflow")) else "BLOCKED"
        print(json.dumps({"report": str(report), "AUDIT_RESULT": verdict, "runtimeTests": "NOT_RUN", "NextAllowedAction": "WAIT_FOR_ARCHITECT"}, indent=2))
        # Evidence capture success is deliberately not a successful audit exit.
        return 1 if verdict == "FAIL" else 2
    except (AuditError, OSError, UnicodeError, ValueError) as error:
        print(json.dumps({"result": "BLOCKED", "detail": str(error), "NextAllowedAction": "WAIT_FOR_ARCHITECT"}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
