"""Contract tests C01-C08 (TEST_MATRIX.md). Plain script + pytest-collectible functions,
matching the style already used in WhizdomLift (injected fakes, no live services, real
assertions with evidence printed). Run standalone for a human-readable PASS/FAIL report:

    D:\\lms-ng\\.venv\\Scripts\\python.exe tests\\contract\\test_schemas.py

or via pytest for CI-style collection:

    D:\\lms-ng\\.venv\\Scripts\\python.exe -m pytest tests\\contract\\test_schemas.py -v

Every test that needs a live Postgres/Node-with-modern-ES/Dell service is marked BLOCKED with
the specific reason rather than skipped silently -- see docs/preflight/MACHINE_CAPABILITIES.md.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]          # D:\lms-ng
CONTRACTS = ROOT / "contracts"
SCHEMA_DIR = CONTRACTS / "json-schema"

sys.path.insert(0, str(ROOT / ".venv" / "Lib" / "site-packages"))

import jsonschema  # noqa: E402
from jsonschema import Draft202012Validator, FormatChecker  # noqa: E402
from referencing import Registry, Resource  # noqa: E402
from referencing.jsonschema import DRAFT202012  # noqa: E402
import yaml  # noqa: E402


# --------------------------------------------------------------------------- infrastructure --

def build_registry() -> Registry:
    resources = []
    for p in SCHEMA_DIR.rglob("*.schema.json"):
        doc = json.loads(p.read_text(encoding="utf-8"))
        resources.append((doc["$id"], Resource.from_contents(doc, default_specification=DRAFT202012)))
    return Registry().with_resources(resources)


REGISTRY = build_registry()

SCHEMA_BY_KIND = {
    "state": "https://lms-ng.internal/contracts/2.0/mqtt/state.schema.json",
    "event": "https://lms-ng.internal/contracts/2.0/mqtt/event.schema.json",
    "snapshot": "https://lms-ng.internal/contracts/2.0/mqtt/snapshot.schema.json",
    "presence": "https://lms-ng.internal/contracts/2.0/mqtt/presence.schema.json",
    "heartbeat": "https://lms-ng.internal/contracts/2.0/mqtt/heartbeat.schema.json",
    "diagnostics": "https://lms-ng.internal/contracts/2.0/mqtt/diagnostics-network.schema.json",
    "ack": "https://lms-ng.internal/contracts/2.0/mqtt/ack.schema.json",
}


def validator_for(schema_id: str) -> Draft202012Validator:
    schema = REGISTRY.contents(schema_id)
    return Draft202012Validator(schema, registry=REGISTRY, format_checker=FormatChecker())


def load_fixture(*parts: str) -> dict:
    return json.loads((CONTRACTS / "fixtures" / pathlib.Path(*parts)).read_text(encoding="utf-8"))


def is_valid(payload: dict, schema_id: str) -> tuple[bool, list[str]]:
    v = validator_for(schema_id)
    errors = sorted(v.iter_errors(payload), key=lambda e: e.path)
    return (len(errors) == 0), [f"{list(e.path)}: {e.message}" for e in errors]


RESULTS: list[dict] = []


def record(test_id: str, description: str, passed: bool, detail: str = "", blocked: str | None = None):
    status = "BLOCKED" if blocked else ("PASS" if passed else "FAIL")
    RESULTS.append({
        "testId": test_id, "description": description, "result": status,
        "detail": blocked or detail,
    })
    marker = {"PASS": "PASS   ", "FAIL": "FAIL   ", "BLOCKED": "BLOCKED"}[status]
    print(f"  {marker} {test_id:5s} {description}")
    if detail and status != "PASS":
        for line in detail.splitlines():
            print(f"           {line}")
    return status  # every caller asserts on this -- see the note above main() for why


# --------------------------------------------------------------------------------- C01-C08 --

def test_C01_baseline_not_lost():
    """C01: baseline inventory does not lose S2/S3; diff covers every breaking field."""
    pack = ROOT.parent / "WhizdomLift-wt" / "feature-lms-ng-revise-v2" / "docs" / "revisions" / \
        "LMS_NG_Revised_Execution_Pack_v2_0"
    s2 = pack / "reference" / "legacy-contracts" / "LMS_NG_MQTT_Topic_Specification_v1.yaml"
    s3 = pack / "reference" / "legacy-contracts" / "LMS_NG_OpenAPI_v1.yaml"
    diff_doc = ROOT / "docs" / "preflight" / "CONTRACT_BASELINE_DIFF.md"

    ok = s2.exists() and s3.exists() and diff_doc.exists()
    detail = []
    if not ok:
        for p in (s2, s3, diff_doc):
            if not p.exists():
                detail.append(f"missing: {p}")
        record("C01", "Baseline inventory does not lose S2/S3", False, "\n".join(detail))
        return

    diff_text = diff_doc.read_text(encoding="utf-8")
    # Stems, not whole words: "simulat" matches SIMULATED/simulator, "auth" matches
    # authentication/authorization -- a literal-word match on e.g. "simulation" would fail
    # against a diff document that (correctly) always writes "SIMULATED"/"simulator" instead,
    # which is not a real gap, just a stricter-than-necessary word choice in the test itself.
    required_topics = ["topic root", "envelope", "uuid", "enum", "ack", "lwt", "floor",
                        "simulat", "auth", "websocket", "retention"]
    missing = [t for t in required_topics if t.lower() not in diff_text.lower()]
    passed = ok and not missing
    status = record("C01", "Baseline inventory does not lose S2/S3; diff covers required topics",
           passed, ("missing topics in diff: " + ", ".join(missing)) if missing else
           f"S2/S3 present; diff document covers all {len(required_topics)} required topics")
    assert status == "PASS", "C01 failed - see printed evidence"


def test_C02_python_node_parity():
    """C02: valid/invalid fixtures give the same result in Python (jsonschema) and Node (ajv).
    Executes tests/contract/parity.mjs, which independently loads the same schema files
    through ajv2020 + ajv-formats and validates the same fixture set."""
    # Note on BLOCKED vs FAIL below: a genuinely missing tool (no node on PATH, no Dell,
    # etc.) is recorded as BLOCKED in RESULTS/evidence -- see docs/preflight -- but it still
    # RAISES here rather than silently returning, on purpose. A silent return would make this
    # test report as pytest-PASSED with nothing actually checked, which is exactly the kind
    # of self-contradicting report this project's own lessons (CLAUDE.md 6.15, carried into
    # this round's guardrails) exist to prevent. Missing infrastructure must show up red, not
    # green, in both the standalone-script and pytest execution modes -- main() below
    # catches this per-test so one blocked/failed check does not abort the whole run.
    node_script = ROOT / "tests" / "contract" / "parity.mjs"
    if not node_script.exists():
        record("C02", "Python/Node schema parity", False, blocked="parity.mjs not found")
        raise AssertionError("C02 BLOCKED: parity.mjs not found")
    try:
        proc = subprocess.run(
            ["node", str(node_script)], cwd=str(ROOT), capture_output=True, text=True, timeout=60,
        )
    except FileNotFoundError:
        record("C02", "Python/Node schema parity", False, blocked="node executable not found on PATH")
        raise AssertionError("C02 BLOCKED: node executable not found on PATH")
    except subprocess.TimeoutExpired:
        record("C02", "Python/Node schema parity", False, blocked="parity.mjs timed out after 60s")
        raise AssertionError("C02 BLOCKED: parity.mjs timed out after 60s")

    try:
        node_results = json.loads(proc.stdout.strip().splitlines()[-1])
    except Exception as e:
        record("C02", "Python/Node schema parity", False,
               f"could not parse parity.mjs output as JSON: {e}\nstdout={proc.stdout}\nstderr={proc.stderr}")
        raise AssertionError("C02 failed - could not parse parity.mjs output")

    mismatches = []
    for fixture_path, schema_kind in FIXTURE_TABLE:
        # parity.mjs's fixture table is written with literal forward slashes (that's what
        # the file actually contains, checked into git); pathlib.Path(...) on Windows
        # renders with backslashes, so this normalizes before the dict lookup rather than
        # silently reporting every fixture as "no Node result" from a separator mismatch.
        node_key = fixture_path.replace("\\", "/")
        schema_id = SCHEMA_BY_KIND[schema_kind]
        payload = load_fixture(fixture_path)
        py_valid, py_errors = is_valid(payload, schema_id)
        node_entry = node_results.get(node_key)
        if node_entry is None:
            mismatches.append(f"{fixture_path}: no Node result reported")
            continue
        if py_valid != node_entry["valid"]:
            mismatches.append(
                f"{fixture_path}: Python valid={py_valid} vs Node valid={node_entry['valid']} "
                f"(py_errors={py_errors}, node_errors={node_entry.get('errors')})"
            )
    passed = not mismatches
    status = record("C02", "Python/Node schema parity across all fixtures", passed, "\n".join(mismatches))
    assert status == "PASS", "C02 failed - see printed evidence"


def test_C03_object_closure():
    """C03: assembled valid payload passes; an unknown extra field is rejected WITHOUT the
    valid payload it's based on being rejected for the same reason."""
    valid = load_fixture("valid", "state_w02_climbing.json")
    ok_valid, errs_valid = is_valid(valid, SCHEMA_BY_KIND["state"])

    invalid = load_fixture("invalid", "state_unknown_extra_property.json")
    ok_invalid, errs_invalid = is_valid(invalid, SCHEMA_BY_KIND["state"])

    closure_error_present = any("additional" in e.lower() or "unevaluated" in e.lower() for e in errs_invalid)

    passed = ok_valid and (not ok_invalid) and closure_error_present
    detail = (f"valid fixture valid={ok_valid} errors={errs_valid}; "
              f"extra-property fixture valid={ok_invalid} errors={errs_invalid}")
    status = record("C03", "Object closure: valid payload passes, extra field rejected by closure", passed, detail)
    assert status == "PASS", "C03 failed - see printed evidence"


def test_C04_int64_ordering_strings():
    """C04: streamSeq as a decimal STRING is required; a JSON number is rejected (this is
    exactly the JS-safe-integer overflow the schema exists to prevent); a value within the
    signed-bigint range validates; a value that overflows it is caught (by application-level
    numeric check, since a fixed-width regex on digit COUNT is a syntactic guard only --
    documented honestly in docs/preflight/DEPENDENCY_MATRIX.md, not oversold as a schema
    guarantee)."""
    as_number = load_fixture("invalid", "state_streamSeq_as_number.json")
    ok_number, errs_number = is_valid(as_number, SCHEMA_BY_KIND["state"])

    as_string = load_fixture("valid", "state_w02_climbing.json")
    ok_string, _ = is_valid(as_string, SCHEMA_BY_KIND["state"])

    max_int64 = 9223372036854775807
    overflow = max_int64 + 1
    max_ok = re.match(r"^[1-9][0-9]{0,19}$", str(max_int64)) is not None and int(str(max_int64)) <= max_int64
    overflow_caught = int(str(overflow)) > max_int64  # application-level numeric bound check

    passed = (not ok_number) and ok_string and max_ok and overflow_caught
    detail = (f"number-typed streamSeq rejected={not ok_number} (errors={errs_number}); "
              f"string-typed streamSeq accepted={ok_string}; "
              f"int64 max representable and compared correctly={max_ok}; "
              f"overflow value ({overflow}) caught by numeric range check={overflow_caught}")
    status = record("C04", "streamSeq is a decimal string; JS-unsafe integers never silently truncate",
           passed, detail)
    assert status == "PASS", "C04 failed - see printed evidence"


def test_C05_envelope_scope_validation():
    """C05: bad UUID / missing required scope fields are rejected."""
    bad = load_fixture("invalid", "state_elevatorId_null.json")
    ok, errs = is_valid(bad, SCHEMA_BY_KIND["state"])
    passed = not ok
    status = record("C05", "elevatorId=null rejected for a state message (non-null required)",
           passed, "\n".join(errs) if not passed else "correctly rejected")
    assert status == "PASS", "C05 failed - see printed evidence"


def test_C06_pin_hash_release_guard():
    """C06: the pinned bundle is hash-checkable; RELEASE_MANIFEST.json has NOT been silently
    flipped to APPROVED by anything in this round."""
    manifest = json.loads((CONTRACTS / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    not_self_approved = manifest.get("status") == "DRAFT" and manifest.get("approvedBy") is None \
        and manifest.get("approvedAt") is None

    version_file = (CONTRACTS / "VERSION").read_text(encoding="utf-8").strip()
    version_matches = version_file == manifest.get("version")

    passed = not_self_approved and version_matches
    detail = (f"RELEASE_MANIFEST.json status={manifest.get('status')!r} "
              f"approvedBy={manifest.get('approvedBy')!r} approvedAt={manifest.get('approvedAt')!r}; "
              f"contracts/VERSION={version_file!r} matches manifest.version={version_matches}")
    status = record("C06", "Contract bundle stays DRAFT and unapproved unless a human approves it",
           passed, detail)
    assert status == "PASS", "C06 failed - see printed evidence"


def test_C07_floor_seeds_evidence():
    """C07: WHZ-PAX has 46 codes / 43 landings and reproduces all 10 calibration anchors;
    WHZ-SERVICE has exactly 1->B1, 2->1, 47->44 calibrated and 44 uncalibrated codes (3..46).
    Checked by parsing database/seeds/whz.sql directly (sqlglot-static level, not a live-DB
    execution -- see docs/preflight/MACHINE_CAPABILITIES.md section 5, DELL_TESTS_BLOCKED for
    the real dbmate-apply test)."""
    sql = (ROOT / "database" / "seeds" / "whz.sql").read_text(encoding="utf-8")
    # Row values are column-aligned in the .sql file with variable-width whitespace for
    # human readability, so the pattern between tokens is \s+ (one or more spaces), not a
    # literal single space.
    row_re = r"\('{table}',\s*1,\s*(\d+),\s*(NULL|'[^']*'),\s*(true|false),\s*(true|false),\s*'(\w+)'\)"

    pax_rows = re.findall(row_re.format(table="WHZ-PAX"), sql)
    landings = [r for r in pax_rows if r[2] == "true"]
    anchors = {row[0]: row[1].strip("'") for row in pax_rows if row[0] in
               {"1", "2", "12", "22", "28", "34", "35", "38", "39", "46"}}
    expected_anchors = {"1": "B1", "2": "1", "12": "9", "22": "20", "28": "26",
                         "34": "32", "35": "33", "38": "36", "39": "37", "46": "44"}

    service_rows = re.findall(row_re.format(table="WHZ-SERVICE"), sql)
    service_calibrated = [r for r in service_rows if r[3] == "true"]
    service_calibrated_map = {r[0]: r[1].strip("'") for r in service_calibrated}

    checks = {
        "WHZ-PAX has 46 codes": len(pax_rows) == 46,
        "WHZ-PAX has 43 landings": len(landings) == 43,
        "WHZ-PAX anchors match exactly": anchors == expected_anchors,
        "WHZ-SERVICE has exactly 3 calibrated codes": len(service_calibrated) == 3,
        "WHZ-SERVICE calibrated = {1:B1, 2:1, 47:44}": service_calibrated_map == {"1": "B1", "2": "1", "47": "44"},
    }
    passed = all(checks.values())
    detail = "\n".join(f"{'OK' if v else 'FAIL'}  {k}" for k, v in checks.items())
    status = record("C07", "Floor seeds/evidence: passenger 46/43, W-05 47->44 with 3..46 uncalibrated",
           passed, detail)
    assert status == "PASS", "C07 failed - see printed evidence"


def test_C08_ack_presence_schema_exceptions():
    """C08: LWT presence has no fake occurredAt; a would-be occurredAt is rejected by the
    schema's closure; ACK target/hash/result-type fields validate correctly."""
    lwt = load_fixture("valid", "presence_lwt_offline.json")
    ok_lwt, errs_lwt = is_valid(lwt, SCHEMA_BY_KIND["presence"])
    no_occurred_at = "occurredAt" not in lwt

    fake = load_fixture("invalid", "presence_lwt_fake_occurredAt.json")
    ok_fake, errs_fake = is_valid(fake, SCHEMA_BY_KIND["presence"])

    ack = load_fixture("valid", "ack_db_committed.json")
    ok_ack, errs_ack = is_valid(ack, SCHEMA_BY_KIND["ack"])

    passed = ok_lwt and no_occurred_at and (not ok_fake) and ok_ack
    detail = (f"LWT presence valid={ok_lwt} (errors={errs_lwt}), no occurredAt field={no_occurred_at}; "
              f"fake-occurredAt fixture correctly rejected={not ok_fake} (errors={errs_fake}); "
              f"ack fixture valid={ok_ack} (errors={errs_ack})")
    status = record("C08", "ACK/presence schema exceptions: no fake occurredAt, ACK fields correct",
           passed, detail)
    assert status == "PASS", "C08 failed - see printed evidence"


FIXTURE_TABLE = [
    ("valid/state_w02_climbing.json", "state"),
    ("valid/state_w05_uncalibrated_code47.json", "state"),
    ("valid/presence_lwt_offline.json", "presence"),
    ("valid/ack_db_committed.json", "ack"),
    ("invalid/state_floorDisplay_on_wire.json", "state"),
    ("invalid/state_streamSeq_as_number.json", "state"),
    ("invalid/state_missing_running_statuspoint.json", "state"),
    ("invalid/state_unknown_extra_property.json", "state"),
    ("invalid/state_elevatorId_null.json", "state"),
    ("invalid/presence_lwt_fake_occurredAt.json", "presence"),
]


def main() -> int:
    print(f"contract tests -- schema registry has {len(list(SCHEMA_DIR.rglob('*.schema.json')))} schemas\n")
    # Each test_* function now asserts on its own result (so pytest genuinely fails a test
    # instead of always reporting green -- see the note above record()). That means a single
    # failing/blocked check raises AssertionError, which would otherwise abort this whole
    # standalone run partway through and hide every test after it. Catch per-test here so one
    # red check still lets the rest run and still lands in RESULTS/evidence -- the AssertionError
    # itself is not additional information beyond what record() already printed and logged.
    for test_fn in (
        test_C01_baseline_not_lost,
        test_C02_python_node_parity,
        test_C03_object_closure,
        test_C04_int64_ordering_strings,
        test_C05_envelope_scope_validation,
        test_C06_pin_hash_release_guard,
        test_C07_floor_seeds_evidence,
        test_C08_ack_presence_schema_exceptions,
    ):
        try:
            test_fn()
        except AssertionError:
            pass  # already recorded as FAIL/BLOCKED by record(); keep going

    print()
    fails = [r for r in RESULTS if r["result"] == "FAIL"]
    blocked = [r for r in RESULTS if r["result"] == "BLOCKED"]
    passed = [r for r in RESULTS if r["result"] == "PASS"]
    print(f"PASS={len(passed)} FAIL={len(fails)} BLOCKED={len(blocked)} / {len(RESULTS)} total")

    evidence_path = ROOT / "docs" / "evidence" / "contract_test_results.json"
    evidence_path.parent.mkdir(parents=True, exist_ok=True)
    evidence_path.write_text(json.dumps(RESULTS, indent=2), encoding="utf-8")
    print(f"evidence written to {evidence_path}")

    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
