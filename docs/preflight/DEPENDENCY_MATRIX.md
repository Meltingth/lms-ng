---
docType: PREFLIGHT_DEPENDENCY_MATRIX
phaseId: PRE-0
status: DRAFT
preparedAt: 2026-09-13T21:00:00+07:00
---

# Dependency matrix — version targets vs. what was actually verified

Per plan §3 item 7: "Node 22/NestJS 11/pnpm 10/EMQX 5/Postgres 16/Redis 7 เป็น **version
targets จากต้นฉบับ ไม่ใช่การยืนยัน latest/supported วันนี้**". This table separates "what the
plan proposes" from "what this round could actually confirm," and pins exact versions for
everything this round installed.

## 1. Platform targets (proposed; unverifiable from this machine this round)

| Component | Target (from Backend Plan v1.3 / revised plan) | Verified this round? | Notes |
|---|---|---|---|
| Node.js (Platform apps) | 22 LTS | **No** — this machine runs 16.20.2 and does not build the Platform apps | Compatibility, current LTS status, and security advisories for Node 22 are unverified from here; confirm on/before Dell provisioning |
| NestJS | 11 | No | Not installed anywhere in this round |
| pnpm | 10 | No | Not installed; `npm` (bundled with Node 16) was used for the one project-local `ajv` install this round needed |
| EMQX | 5.x | No | No broker started or reached this round |
| PostgreSQL | 16 | No | No database instance exists in this round; SQL is only statically parsed (§2) |
| Redis | 7 | No | Not installed, not reached |
| Docker / Docker Desktop | any recent | Partially — the CLI (27.0.3) is present on this machine, but this machine is not where the stack runs (`MACHINE_CAPABILITIES.md` §1), and the daemon was never started |

**None of these are pinned to exact patch/digest versions in this round** — that pinning
(image digests, exact NestJS/pnpm versions) is P0-SERVER work, done against whatever the Dell
actually has once it is reachable, not guessed at here.

## 2. What this round actually installed, with exact versions (isolated, see below)

| Package | Version | Where | Purpose this round |
|---|---|---|---|
| `jsonschema` | 4.23.0 | `D:\lms-ng\.venv` (Python venv) | Draft 2020-12 schema validation, C02/C03/C06/C07 |
| `referencing` | 0.36.2 | same venv | `$ref` registry for the JSON Schema validator |
| `jsonschema-specifications` | 2025.9.1 | same venv (transitive) | meta-schema resources |
| `rpds-py` | 2026.6.3 | same venv (transitive, native wheel) | backing immutable structures for `referencing` |
| `attrs` | 26.1.0 | same venv (transitive) | used by `jsonschema`/`referencing` |
| `PyYAML` | 6.0.2 | same venv | parsing the MQTT topic spec and OpenAPI YAML documents |
| `sqlglot` | 25.34.1 | same venv | static syntax check of `0001_schema_v2_draft.sql` (substituted for `pglast`, see below) |
| `pytest` | 8.3.4 | same venv | running `tests/contract/test_schemas.py` |
| `ajv` | 8.17.1 | `D:\lms-ng\node_modules` (project-local, `package.json` `devDependencies`) | Node-side Draft 2020-12 validation, for the C02 parity check against Python's `jsonschema` |
| `ajv-formats` | 3.0.1 | same | format keywords (`uuid`, `date-time`, etc.) for ajv |

**Isolation, checked not assumed:** the venv was created with
`C:\Python312\python.exe -m venv D:\lms-ng\.venv`; every package above installed into
`D:\lms-ng\.venv\Lib\site-packages`, confirmed with `importlib.metadata.version()` run through
the venv's own interpreter. None of it touched `C:\Python312\Lib\site-packages` (the system
location the deployed capture loggers could theoretically see) or
`D:\WhizdomLift\vendor\` (where the loggers' actual pyserial dependency is vendored per
CLAUDE.md §6.19). The `ajv`/`ajv-formats` install went into `D:\lms-ng\node_modules` via a
`package.json` scoped to that repo, not a global npm install.

## 3. Substitution recorded: `pglast` → `sqlglot`

The plan's implied SQL-analysis tooling (`pglast`, a `libpg_query` binding used for real
Postgres-grammar-accurate parsing) failed to install: `pip install pglast==7.4` attempted to
build a native wheel and failed because this machine has no C/C++ compiler toolchain. Rather
than skip static SQL checking or silently claim a level of validation this round can't back
up, `sqlglot==25.34.1` (pure Python, no compiler needed) was installed instead. `sqlglot`
parses the general SQL grammar including most Postgres extensions but is not a
byte-for-byte match for `libpg_query`; it will not catch every Postgres-16-specific edge case
a real `dbmate up` against a live Postgres 16 would. Every result produced with it in the
A-DRAFT test evidence is labelled `sqlglot-static` for exactly this reason, and the genuine
`dbmate up` / migration-apply test remains `BLOCKED` (needs the Dell) regardless of what
`sqlglot` says.

## 4. License notes (brief, not a full audit)

All packages installed this round (`jsonschema`, `referencing`, `PyYAML`, `sqlglot`,
`pytest`, `ajv`, `ajv-formats`) are MIT or Apache-2.0 licensed, standard for their ecosystems,
and used here only as development/test tooling — none of them ship inside any artifact that
would be distributed to an end user of the finished system. A full SBOM/license inventory for
the eventual Platform runtime dependencies (NestJS, EMQX, Postgres driver, etc., per plan
§B.7 "ทำ SBOM/license/secret scan ของrelease") is P1/P0-SERVER work, not attempted here.
