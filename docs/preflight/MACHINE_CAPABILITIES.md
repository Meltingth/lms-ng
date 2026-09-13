---
docType: PREFLIGHT_MACHINE_CAPABILITIES
phaseId: PRE-0
status: DRAFT
preparedAt: 2026-09-13T21:00:00+07:00
---

# Machine capabilities — read-only checks, no changes made

## 1. This machine (development machine == Gateway PC, `GW-WHZ-01` per Backend Plan §1)

Checked live this session (`Get-CimInstance`, no state changed):

| Item | Value |
|---|---|
| Hostname | `DESKTOP-GCKFBE4` |
| OS | Windows 10 Pro, build 19045, 64-bit |
| CPU | Intel Core i5-5200U @ 2.20 GHz, 2 cores / 4 logical |
| RAM | 7.83 GB total, 3.31 GB free at check time |
| Disk C: | 61.1 GB used, 18.4 GB free |
| Disk D: | 0.3 GB used (before this round), 158.2 GB free |
| Timezone | `SE Asia Standard Time` (matches Asia/Bangkok, UTC+7) |
| Uptime | ~10 h 16 min at check time |

**Rule enforced (plan §0.3, §6.6):** this machine is the Edge/Gateway role. No Docker build,
no Postgres/EMQX/Redis stack, and no heavy Platform work runs here. Docker Desktop was **not**
started during this round even though the CLI is present (see below) — its daemon was
confirmed not running (`docker info` failed to reach the named pipe) and this round did not
change that.

## 2. Toolchain present / absent (this machine)

| Tool | Found | Version |
|---|---|---|
| Python | yes | 3.12.5 (`C:\Python312\python.exe`) — this is the exact interpreter the deployed capture loggers run under |
| pip | yes | 24.2 |
| Node.js | yes | v16.20.2 |
| npm | yes | 8.19.4 |
| git | yes | 2.55.0.windows.5 |
| Docker CLI | yes | 27.0.3 (daemon **not running**, not started) |
| PowerShell 7 (`pwsh`) | **no** | not found |
| NSSM | **no** | not found |

**Version-target gap, recorded per plan §0.1 [VERIFY] discipline (not silently assumed):**
the revised plan's Deliverable C proposes Node 22 LTS / pnpm 10 / NestJS 11 as targets. This
machine has Node 16.20.2, which reached end-of-life in 2026 and cannot run those targets. This
is not a blocker for PRE-0/A-DRAFT (no Platform application code is built in this round), but
it means: (a) any Node-based contract validation in this round uses whatever this Node 16 can
run — `ajv@8.17.1` + `ajv-formats@3.0.1` installed as **project-local** `devDependencies`
under `D:\lms-ng\node_modules` (not global, nothing touching the Edge's `vendor/`) and
confirmed to load under Node 16; (b) building the actual Platform stack targets Node 22 and is
explicitly deferred to the Dell (P0-SERVER), never to this machine.

## 3. Python packages already importable system-wide (before this round installed anything)

Checked with `importlib.util.find_spec` against the system `C:\Python312` interpreter, i.e.
the same interpreter the deployed capture loggers use:

| Package | Present before this round |
|---|---|
| `jsonschema` | no |
| `referencing` | no |
| `yaml` (PyYAML) | no |
| `paho` (paho-mqtt) | no |
| `serial` (pyserial) | not on system path — lives only in WhizdomLift's own `vendor/`, which is exactly why the Edge capture vendors it (CLAUDE.md §6.19) |

**None of these were installed system-wide by this round.** Everything this round needed
(`jsonschema`, `referencing`, `PyYAML`, `sqlglot`, `pytest`) was installed into a fresh,
isolated virtual environment at `D:\lms-ng\.venv`, created with
`C:\Python312\python.exe -m venv .venv`. This venv is inside the new `lms-ng` repo tree, has
no relationship to the Edge's `vendor/` directory or to the system site-packages the deployed
loggers might someday pick up, and nothing on the Edge side was touched.

One dependency substitution, recorded rather than hidden: the plan's `DEPENDENCY_MATRIX`
candidate for SQL-schema static analysis was `pglast` (a libpg_query binding). Installing it
here failed — `pip install pglast` tried to build a wheel and the build failed, because this
machine has no C/C++ build toolchain for a native extension. Substituted with **`sqlglot`
25.34.1**, a pure-Python SQL parser with no compiler dependency, for the static syntax checks
this round runs against `0001_schema_v2_draft.sql`. This is a weaker check than a real
`libpg_query`-based parse (it doesn't understand every Postgres-16-specific DDL extension the
same way), so results from it are marked `sqlglot-static` rather than claimed as a full
Postgres grammar validation — an actual `dbmate up` against a running Postgres 16 remains
`BLOCKED` in this round regardless (see §5).

## 4. Network reachability (read-only HEAD/GET checks only, nothing published)

| Endpoint | Result |
|---|---|
| `https://pypi.org/simple/jsonschema/` | HTTP 200 |
| `https://registry.npmjs.org/ajv` | HTTP 200 |
| `https://github.com` | HTTP 200 |
| `https://api.github.com/repos/Meltingth/lms-ng` | HTTP 404 (see `BASELINE_INVENTORY.md` §1.1 for what this does and does not prove) |

Internet access is available from this machine for package installation; nothing was pushed
or published to any of these endpoints beyond the standard read/GET traffic package managers
perform to resolve and download pinned versions.

## 5. Dell (`LMS-SRV`) — not reached, not simulated as reached

No network path to a machine identified as the Dell exists from this session. Every item in
the revised plan that requires the actual Dell (spec confirmation via `systeminfo`, Docker
Desktop/WSL2 behavior, `docker compose up`, a real Postgres/EMQX/Redis, cold-boot testing,
NTP chain) is recorded as `DELL_TESTS_BLOCKED` for this round, not attempted, not simulated
on this machine, and not silently skipped without a record — per plan §6.6 ("ถ้าไม่มี Dell
ให้ทำ unit/schema/local preview ที่ปลอดภัย... ห้ามใช้ Gateway แทนโดยปริยาย").

Open item O4 from the original plan (confirm the Dell's actual spec) remains open; this round
adds nothing new toward closing it beyond restating that it is still unverified.

## 6. What this section authorizes for A-DRAFT

Based on the above, A-DRAFT in this round may: write and statically validate JSON Schema
documents (Python `jsonschema`/`referencing`, Node `ajv`), write and statically lint SQL DDL
(`sqlglot`), write YAML/Markdown contract documents, and run cross-language fixture tests that
need no network service. A-DRAFT may **not**: run `dbmate` against a real database, start any
container, or exercise the MQTT broker/WebSocket paths end-to-end. Those stay `NOT_RUN` with
this document as the reason, to be picked up in P0-SERVER/P2-TEST on the Dell.
