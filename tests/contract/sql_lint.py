"""Static SQL syntax check for database/migrations and database/seeds, using sqlglot
(dialect="postgres") as a stand-in for a real libpg_query parse.

Why sqlglot and not pglast (the plan's original candidate): `pip install pglast` failed on
this machine -- no C/C++ build toolchain for its native extension (libpg_query binding). See
docs/preflight/MACHINE_CAPABILITIES.md section 3 and DEPENDENCY_MATRIX.md for the substitution
record. sqlglot is pure Python and installs cleanly, but it is a WEAKER check than a real
Postgres-grammar parse -- it does not understand every Postgres-16-specific DDL extension the
same way libpg_query does, and it never touches a running database (no constraint/type/FK
validation, no partition-attach semantics check). Results from this script are always labeled
"sqlglot-static" and must never be read as equivalent to `dbmate up` against a real Postgres 16
instance -- that remains DELL_TESTS_BLOCKED this round (MACHINE_CAPABILITIES.md section 5).

Run standalone:
    D:\\lms-ng\\.venv\\Scripts\\python.exe tests\\contract\\sql_lint.py
Exit code 0 = every statement in every file parsed; 1 = at least one parse error.
"""
from __future__ import annotations

import json
import logging
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]  # D:\lms-ng
sys.path.insert(0, str(ROOT / ".venv" / "Lib" / "site-packages"))

import sqlglot  # noqa: E402
from sqlglot.errors import ParseError  # noqa: E402


class _CaptureHandler(logging.Handler):
    """sqlglot reports its 'fell back to Command parsing' notice via logger.warning(), not
    Python's warnings module (confirmed by reading sqlglot/parser.py _warn_unsupported() in
    this venv) -- a plain warnings.catch_warnings() silently captures nothing. This handler
    attaches directly to sqlglot's own logger for the duration of one parse call."""

    def __init__(self):
        super().__init__(level=logging.WARNING)
        self.records: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record.getMessage())


SQL_FILES = [
    ROOT / "database" / "migrations" / "0001_schema_v2_draft.sql",
    ROOT / "database" / "seeds" / "whz.sql",
    ROOT / "database" / "seeds" / "test.sql",
]


def lint_file(path: pathlib.Path) -> dict:
    if not path.exists():
        return {"file": str(path.relative_to(ROOT)), "result": "BLOCKED",
                 "detail": "file not found", "statements": 0, "errors": [],
                 "unmodeled_fallbacks": []}
    sql = path.read_text(encoding="utf-8")
    # sqlglot falls back to a generic "Command" node (rather than a real parse tree) for
    # syntax it does not model -- e.g. this schema's `CREATE EXTENSION IF NOT EXISTS` and its
    # `DO $$ ... ASSERT ... $$` guard blocks. That fallback is silent unless caught here: it
    # emits a logger.warning(), not an exception (see _CaptureHandler's docstring -- a plain
    # warnings.catch_warnings() was tried first and silently caught nothing, since this isn't
    # Python's warnings module), so a caller that only catches ParseError would report "18
    # statements parsed" without disclosing that some of them were never actually
    # grammar-checked -- exactly the kind of report that looks clean while hiding what wasn't
    # verified (the failure pattern this project's own CLAUDE.md section 6.15 keeps finding).
    # Captured explicitly here so the evidence says what was and wasn't checked.
    sqlglot_logger = logging.getLogger("sqlglot")
    handler = _CaptureHandler()
    sqlglot_logger.addHandler(handler)
    try:
        statements = sqlglot.parse(sql, read="postgres")
        fallback_warnings = [m for m in handler.records if "Falling back" in m]
        # parse() returns None entries for empty statements between semicolons (e.g. a
        # trailing blank); that is not a parse failure, just nothing to check there.
        n = sum(1 for s in statements if s is not None)
        detail = f"sqlglot-static: {n} statements parsed under dialect=postgres"
        if fallback_warnings:
            detail += (f"; {len(fallback_warnings)} fell back to untyped 'Command' parsing "
                       f"(syntax sqlglot does not model -- listed below, not a failure but "
                       f"not a real grammar check either)")
        return {"file": str(path.relative_to(ROOT)), "result": "PASS",
                 "detail": detail, "statements": n,
                 "errors": [], "unmodeled_fallbacks": fallback_warnings}
    except ParseError as e:
        return {"file": str(path.relative_to(ROOT)), "result": "FAIL",
                 "detail": "sqlglot-static parse error", "statements": 0,
                 "errors": [str(e)], "unmodeled_fallbacks": []}
    finally:
        sqlglot_logger.removeHandler(handler)


def main() -> int:
    results = [lint_file(p) for p in SQL_FILES]
    for r in results:
        marker = {"PASS": "PASS   ", "FAIL": "FAIL   ", "BLOCKED": "BLOCKED"}[r["result"]]
        print(f"  {marker} {r['file']:45s} {r['detail']}")
        for err in r["errors"]:
            for line in err.splitlines():
                print(f"           {line}")
        for fw in r.get("unmodeled_fallbacks", []):
            print(f"           fallback: {fw.splitlines()[0]}")

    evidence_path = ROOT / "docs" / "evidence" / "sql_lint_results.json"
    evidence_path.parent.mkdir(parents=True, exist_ok=True)
    evidence_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"evidence written to {evidence_path}")

    fails = [r for r in results if r["result"] == "FAIL"]
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
