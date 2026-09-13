---
docType: PREFLIGHT_DATA_CLASSIFICATION
phaseId: PRE-0
status: DRAFT
preparedAt: 2026-09-13T21:00:00+07:00
---

# Data classification — what may reach a public repo, what must not

Plan §2.2 and §10.1's S04 test ("ไม่มี private key/password/raw operational capture/real
host config ในpublicdiff") govern this. This document exists so every later round can check a
diff against a fixed list instead of re-deciding case by case.

## 1. Never committed to any repo this round (nor any future round without a separate, explicit
   owner decision), regardless of public/private status of the destination

| Category | Concrete examples from this project |
|---|---|
| Raw operational capture logs | `capture_lift_1.log`, `capture_lift_2.log`, `capture_lift_3.log`, `capture_lift_5.log`, `capture_launcher.log` — these exist only in the deployed `D:\WhizdomLift` tree and were not copied anywhere by this round |
| Private host/network configuration | The Scheduled Task export (`task_export.xml.txt`) captured for the known-good manifest lives **only** at `D:\WhizdomLift-releases\capture-kg-692acd1\` (outside git, read-only, local disk only) |
| Real hostnames / usernames tied to this specific machine | `DESKTOP-GCKFBE4`, `Administrator` — appear in `MACHINE_CAPABILITIES.md` and the release manifest (both **local-only**, private classification below) but must not appear in anything staged for the public WhizdomLift remote or a future public `lms-ng` remote |
| Credentials of any kind | None exist in this round — no MQTT credentials, DB passwords, or API keys were generated, referenced by value, or stored anywhere. Where future rounds need them (EMQX users, DB passwords), the plan already mandates generation outside git (plan §6.2) |
| Anything that would let someone reconstruct a live building's real-time occupancy/traffic pattern | Not applicable in this round — no telemetry is processed, only fixture/example values with `TEST` IDs |

## 2. Fine to publish (source code, redacted/synthetic fixtures, documentation)

| Category | Examples this round produced |
|---|---|
| Contract source (schemas, OpenAPI, MQTT spec, migration SQL, seed SQL) | Everything under `D:\lms-ng\contracts\`, `D:\lms-ng\database\` |
| Synthetic/redacted example payloads using `TEST` organization/site/gateway/elevator identifiers | `contracts/mqtt/examples/*.json`, `contracts/fixtures/{valid,invalid}/*.json` — all use placeholder UUIDs and `S-01`/`GW-SIM-01`-style TEST codes, never a real building's identifiers |
| Documentation describing what was found, decided, or is still open | This preflight set, the baseline diff, the ADR, the decision packet |
| Validator/test source code | `tests/contract/*` |
| The vendored contract copy on the Edge side | `WhizdomLift-wt/.../contracts/**` (source code + generated schema files, no operational data) |

## 3. Private-only — kept on this machine, never staged for any git remote in this round

| File | Location | Why |
|---|---|---|
| `KNOWN_GOOD_CAPTURE_MANIFEST.json` | `WhizdomLift-wt/.../docs/release/` (tracked on the **feature branch only**, reviewed before that branch is ever pushed) | Contains local file-system paths (`D:\WhizdomLift...`) and the immutable-release directory path. Paths alone are low sensitivity but are still host-identifying; the manifest is reviewed for anything more sensitive before the feature branch is pushed (see §4) |
| `task_export.xml.txt`, `SHA256SUMS`, the release copy itself | `D:\WhizdomLift-releases\capture-kg-692acd1\` | Deliberately created **outside** both git working trees so it can never be accidentally staged. Contains the full Scheduled Task XML (principal, triggers, the literal command line) — this is operational configuration for a specific real deployment, not source code, and stays local per §1 |

## 4. Push discipline actually followed in this round

- The **only** thing pushed anywhere in this round is the `feature/lms-ng-revise-v2` branch to
  the existing `Meltingth/WhizdomLift` remote (already public — nothing changes about that
  repo's visibility). `main` on that remote is not touched.
- `D:\lms-ng` has no remote configured (see `BASELINE_INVENTORY.md` §1) — nothing from it can
  be pushed anywhere by accident in this round.
- Before the WhizdomLift feature branch push, the diff was scanned for the patterns in §1
  (grep for common secret shapes: `password`, `secret`, `api[_-]key`, `token`, `-----BEGIN`,
  private IP ranges tied to this deployment, the literal hostname/username) — see the A-DRAFT
  phase report for the actual command and its (empty) result.
