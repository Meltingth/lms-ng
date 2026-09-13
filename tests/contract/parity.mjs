// Node/ajv side of C02 (Python/Node schema parity). Run standalone for a human-readable
// report, or invoked by test_schemas.py::test_C02_python_node_parity which parses the last
// line of stdout as JSON. Loads the SAME schema files as the Python side (no duplicated
// schema logic) and validates the SAME fixture table.
//
// Usage: node tests/contract/parity.mjs [--quiet]

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SCHEMA_DIR = path.join(ROOT, "contracts", "json-schema");
const FIXTURES_DIR = path.join(ROOT, "contracts", "fixtures");
const QUIET = process.argv.includes("--quiet");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".schema.json")) out.push(p);
  }
  return out;
}

// allowUnionTypes: the contract deliberately uses a couple of genuine (non-null) type
// unions (e.g. envelope.sourceRef.sourceOffset: integer | string, since a source offset is
// either a line number or a session-relative string id) -- not a strict-mode workaround for
// a mistake, a real modeling choice ajv otherwise flags by default.
const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true });
addFormats(ajv);

for (const file of walk(SCHEMA_DIR)) {
  const doc = JSON.parse(readFileSync(file, "utf-8"));
  ajv.addSchema(doc, doc["$id"]);
}

const SCHEMA_BY_KIND = {
  state: "https://lms-ng.internal/contracts/2.0/mqtt/state.schema.json",
  event: "https://lms-ng.internal/contracts/2.0/mqtt/event.schema.json",
  snapshot: "https://lms-ng.internal/contracts/2.0/mqtt/snapshot.schema.json",
  presence: "https://lms-ng.internal/contracts/2.0/mqtt/presence.schema.json",
  heartbeat: "https://lms-ng.internal/contracts/2.0/mqtt/heartbeat.schema.json",
  diagnostics: "https://lms-ng.internal/contracts/2.0/mqtt/diagnostics-network.schema.json",
  ack: "https://lms-ng.internal/contracts/2.0/mqtt/ack.schema.json",
};

const FIXTURE_TABLE = [
  ["valid/state_w02_climbing.json", "state"],
  ["valid/state_w05_uncalibrated_code47.json", "state"],
  ["valid/presence_lwt_offline.json", "presence"],
  ["valid/ack_db_committed.json", "ack"],
  ["invalid/state_floorDisplay_on_wire.json", "state"],
  ["invalid/state_streamSeq_as_number.json", "state"],
  ["invalid/state_missing_running_statuspoint.json", "state"],
  ["invalid/state_unknown_extra_property.json", "state"],
  ["invalid/state_elevatorId_null.json", "state"],
  ["invalid/presence_lwt_fake_occurredAt.json", "presence"],
];

const results = {};
for (const [rel, kind] of FIXTURE_TABLE) {
  const payload = JSON.parse(readFileSync(path.join(FIXTURES_DIR, rel), "utf-8"));
  const validate = ajv.getSchema(SCHEMA_BY_KIND[kind]);
  if (!validate) {
    results[rel] = { valid: false, errors: [`no ajv schema compiled for kind ${kind}`] };
    continue;
  }
  const valid = validate(payload);
  results[rel] = { valid, errors: valid ? [] : (validate.errors || []).map(e => `${e.instancePath} ${e.message}`) };
  if (!QUIET) {
    const status = valid ? "valid  " : "invalid";
    console.error(`  ${status}  ${rel}`);
  }
}

// The dispatch-table doc file (messages.schema.json) is deliberately not a directly
// resolvable/executable schema on its own -- confirm ajv agrees it has no top-level
// constraints (see contracts/json-schema/ws/messages.schema.json $comment).
const wsMessagesDoc = JSON.parse(readFileSync(path.join(SCHEMA_DIR, "ws", "messages.schema.json"), "utf-8"));
const wsHasNoTopLevelType = !("type" in wsMessagesDoc) && !("properties" in wsMessagesDoc);
if (!QUIET) console.error(`  ws/messages.schema.json has no top-level type/properties (by design): ${wsHasNoTopLevelType}`);

// Last line: machine-readable JSON for test_schemas.py to parse.
console.log(JSON.stringify(results));
