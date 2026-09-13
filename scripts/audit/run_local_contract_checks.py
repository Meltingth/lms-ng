#!/usr/bin/env python3
"""Run the reviewed local C01-C08 functions without their evidence-writing main().

Review test_schemas.py and parity.mjs before using this on changed revisions.
This checks the CURRENT WORKTREE, never represents an independent submitted-SHA audit.
Compatible Python jsonschema/referencing/rpds/PyYAML dependencies must already exist.
"""
from __future__ import annotations

import argparse
import contextlib
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import importlib.util
import io
import json
from pathlib import Path
import re
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-name", required=True, help="New basename under docs/audit/evidence; refuses overwrite")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", args.evidence_name):
        parser.error("evidence-name must use only letters, digits, underscore or hyphen")
    root = Path(__file__).resolve().parents[2]
    directory = root / "docs/audit/evidence"
    if directory.resolve() != directory:
        parser.error("Evidence directory may not be redirected through a link")
    outputs = [directory / (args.evidence_name + extension) for extension in (".json", ".txt")]
    if any(path.exists() for path in outputs):
        parser.error("Refusing to overwrite existing evidence")
    result = {"capturedAt": datetime.now(timezone.utc).isoformat(),
              "scope": "Current-worktree C01-C08 only; not a submitted-Claude-SHA audit or gate approval",
              "python": sys.version, "pythonExecutable": sys.executable,
              "collectorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "command": "python -B scripts/audit/run_local_contract_checks.py --evidence-name " + args.evidence_name,
              "results": [], "gate": "WAITING_FOR_G-A", "blocker": "BLOCKED_ON_POSTGRES_EXECUTION_EVIDENCE"}
    output = io.StringIO()
    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
        try:
            # Preload compatible dependencies from this interpreter BEFORE the legacy
            # module inserts its relocated, Python-3.12 .venv path. Never patch that module.
            import jsonschema
            import referencing.jsonschema
            import rpds
            import yaml
            result["dependencies"] = {name: {"version": importlib.metadata.version(distribution), "path": module.__file__}
                for name, distribution, module in (("jsonschema", "jsonschema", jsonschema), ("referencing", "referencing", referencing), ("rpds", "rpds-py", rpds), ("yaml", "PyYAML", yaml))}
            for relative in ("tests/contract/test_schemas.py", "tests/contract/parity.mjs", "package-lock.json"):
                result.setdefault("sourceSha256", {})[relative] = hashlib.sha256((root / relative).read_bytes()).hexdigest()
            git = subprocess.run(["git", "--no-optional-locks", "-c", "core.fsmonitor=false", "-C", str(root), "rev-parse", "HEAD"], capture_output=True, text=True, check=True)
            result["contextHead"] = git.stdout.strip()
            spec = importlib.util.spec_from_file_location("local_contract_checks", root / "tests/contract/test_schemas.py")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            functions = sorted((name, fn) for name, fn in vars(module).items() if re.fullmatch(r"test_C0[1-8]_.+", name))
            for name, function in functions:
                before = len(module.RESULTS)
                try:
                    function()
                except Exception as error:
                    if len(module.RESULTS) == before or all(row["result"] == "PASS" for row in module.RESULTS[before:]):
                        module.RESULTS.append({"testId": name, "result": "FAIL", "detail": repr(error)})
                    print(name + " raised " + repr(error))
                if len(module.RESULTS) == before:
                    module.RESULTS.append({"testId": name, "result": "NOT_RUN", "detail": "Function produced no assertion record"})
            result["results"] = module.RESULTS
            if len(functions) != 8:
                result["results"].append({"testId": "COLLECTION", "result": "FAIL", "detail": "Expected exactly eight C01-C08 test functions"})
        except Exception as error:
            result["results"].append({"testId": "PREREQUISITE", "result": "BLOCKED", "detail": repr(error)})
    statuses = {row["result"] for row in result["results"]}
    result["summary"] = {status: sum(row["result"] == status for row in result["results"]) for status in ("PASS", "FAIL", "BLOCKED", "NOT_RUN")}
    exit_code = 1 if "FAIL" in statuses else 2 if statuses & {"BLOCKED", "NOT_RUN"} else 0
    result["exitCode"] = exit_code
    directory.mkdir(parents=True, exist_ok=True)
    with outputs[0].open("x", encoding="utf-8", newline="\n") as target:
        json.dump(result, target, indent=2)
        target.write("\n")
    with outputs[1].open("x", encoding="utf-8", newline="\n") as target:
        target.write(output.getvalue())
    print(output.getvalue())
    print(json.dumps({"summary": result["summary"], "exitCode": exit_code, "evidence": [str(path) for path in outputs]}, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
