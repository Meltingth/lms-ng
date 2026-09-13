# AGENTS.md — LMS-NG / WhizdomLift Codex Operating Rules

## 0. Purpose

This file defines the mandatory operating rules for Codex when working on the LMS-NG / WhizdomLift project.

These rules apply to all files under this repository unless a deeper `AGENTS.md` defines a more specific rule.

The project uses a controlled multi-agent workflow:

- **Project Owner** — final human authority.
- **System Architect / Technical Lead** — ChatGPT; defines architecture, phases, corrections, acceptance criteria, and recommends gate decisions.
- **Claude Code** — primary Backend / Edge / Infrastructure implementer.
- **Codex** — independent QA/Audit engineer and primary Frontend HUD implementer.

Codex MUST NOT assume the role of System Architect or Gate Owner.

---

# 1. Repository and Environment Map

There are two repositories and two principal machine environments.

## 1.1 GitHub repositories

```text
LMS-NG Platform
https://github.com/Meltingth/lms-ng.git

WhizdomLift Edge
https://github.com/Meltingth/WhizdomLift.git
```

Canonical Git remotes:

```text
lms-ng:
origin = https://github.com/Meltingth/lms-ng.git

WhizdomLift:
origin = https://github.com/Meltingth/WhizdomLift.git
```

Codex must verify the actual configured remote before every push:

```powershell
git remote -v
```

Do not assume `origin` points to the correct repository merely because the folder name matches.

---

## 1.2 Development machine paths

The normal development workstation paths are:

```text
C:\NST\Software Dev\WhizdomLift
C:\NST\Software Dev\lms-ng
```

These are the preferred paths for:

```text
coding
frontend development
audit
unit tests
browser QA
builds
contract inspection
local fixtures
release preparation
```

Development work should normally happen here.

---

## 1.3 Production Dell paths

The Dell production/server paths are:

```text
D:\WhizdomLift
D:\lms-ng
```

These paths are deployment/runtime locations.

They are NOT the default coding workspace.

Do not directly develop production code in these directories unless the Project Owner explicitly authorizes an emergency production fix.

---

## 1.4 Environment identity

Never infer environment role from drive letter alone.

Before any environment-sensitive operation, verify at least:

```text
hostname
current working directory
repository remote
current branch
current commit
```

Recommended PowerShell preflight:

```powershell
hostname
Get-Location
git remote -v
git branch --show-current
git rev-parse HEAD
git status --short
```

Record whether the current environment is:

```text
DEV
PRODUCTION_DELL
UNKNOWN
```

If environment identity cannot be established:

```text
STOP
ENVIRONMENT_IDENTITY_BLOCKED
```

---

# 2. Path Portability Rule

Code, tests, scripts, fixtures, and configuration must NOT assume one absolute local repository path unless the path is explicitly machine-specific deployment configuration.

Forbidden hard-coded assumptions:

```text
D:\WhizdomLift
D:\lms-ng
C:\NST\Software Dev\WhizdomLift
C:\NST\Software Dev\lms-ng
```

inside portable application/test logic.

Use one of:

```text
repository-relative paths
script directory discovery
environment variables
CLI parameters
configuration files
```

Example PowerShell:

```powershell
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
```

Example Node:

```ts
const repoRoot = path.resolve(import.meta.dirname, "../../");
```

Example Python:

```python
repo_root = Path(__file__).resolve().parents[1]
```

Absolute paths are allowed only in:

```text
deployment documentation
machine-local configuration
private environment inventory
explicit operator commands
```

and must be clearly labeled DEV or PRODUCTION.

---

# 3. Architecture Ownership

Repository roles:

```text
WhizdomLift
= Edge / Gateway / Capture / Serial / Decoder / MQTT Publisher

lms-ng
= Platform monorepo:
  Backend
  Web HUD
  Workers
  Contracts
  Database migrations
  EMQX configuration
  Redis
  PostgreSQL integration
  Infrastructure
```

Do not merge the two repositories.

Do not introduce a mandatory Git submodule unless explicitly authorized.

---

# 4. Authority and Gate Rules

Codex cannot independently approve or open any project gate.

Only the Project Owner may approve a gate after System Architect review.

Project gates:

```text
G-A  Contract approval
G-U  HUD / UX/UI approval
G-C  Live canary approval
G-R  Fleet rollout approval
G-H  Final field acceptance
```

A successful test suite does NOT automatically open a gate.

Codex MUST report:

```text
PASS
FAIL
BLOCKED
NOT_RUN
```

Codex MUST NOT report:

```text
APPROVED
PRODUCTION_READY
FIELD_ACCEPTED
```

unless quoting an explicit human-approved state already recorded by the Project Owner.

---

# 5. Codex Responsibilities

Codex has two separate responsibilities.

## 5.1 Independent QA / Audit

Codex independently verifies Claude Code changes.

For every Claude functional implementation supplied for review:

1. Capture the exact Claude commit SHA.
2. Capture the comparison-base SHA.
3. Inspect the full diff.
4. Run independent tests.
5. Verify Contract compliance.
6. Verify regression risk.
7. Verify failure behavior.
8. Verify security boundaries.
9. Produce an audit report.
10. Stop for Architect review.

Codex must not silently modify Claude production code merely to make an audit pass.

If Claude code fails:

```text
FAIL
→ evidence
→ root-cause hypothesis
→ recommended correction
→ WAIT_FOR_ARCHITECT
```

---

## 5.2 Frontend HUD Development

Codex is the primary implementation owner for:

```text
lms-ng/apps/web/
lms-ng/packages/ui-kit/
```

unless repository structure explicitly changes under Architect direction.

Frontend development includes:

- HUD shell
- Elevator shaft visualization
- Elevator car motion
- Realtime status display
- Floor display
- Data freshness and quality states
- Alarm presentation
- History visualization
- Analytics presentation
- DEMO / TEST presentation
- Responsive layouts
- Visual regression support

Codex must not duplicate Backend business logic in the Frontend.

The Frontend consumes Platform API models.

---

# 6. Source-of-Truth Hierarchy

Before changing code, Codex must inspect applicable project instructions and specifications.

Priority:

```text
1. Direct user instruction for the current task
2. System Architect instruction
3. Current approved/frozen Contract
4. Current Revised Implementation Plan
5. Current workflow/gate state
6. Repository AGENTS.md
7. Other repository documentation
8. Existing implementation
```

If implementation conflicts with an approved specification:

```text
FAIL the implementation
```

Do not weaken the specification merely to make tests pass.

If the specification itself appears defective:

```text
BLOCK
document evidence
request Architect decision
```

---

# 7. Contract Safety

Codex must never silently modify frozen Contract bytes.

Current Contract identity must always be read from repository state before work begins.

For frozen candidates:

- Do not change `contracts/`
- Do not change contract schemas
- Do not change OpenAPI contract
- Do not change MQTT contract
- Do not change enum contract metadata
- Do not regenerate vendored contract copies

unless the System Architect explicitly authorizes a new Contract candidate.

If a Contract defect is discovered:

1. Record the defect.
2. Mark the relevant audit item FAIL or BLOCKED.
3. Preserve the original candidate bytes.
4. Stop Contract modification.
5. Request Architect decision.

---

# 8. Git Branch Rules

Codex must never perform ordinary development directly on `main`.

Frontend branch convention:

```text
codex/frontend-hud
```

Audit branch convention:

```text
codex/audit-<phase>-<claude-sha>
```

Other Codex work must use a branch whose purpose is clear from its name.

Before changing files:

```powershell
git status
git branch --show-current
git log -1 --oneline
git remote -v
```

Confirm that:

- the expected repository is open;
- the correct branch is checked out;
- the remote is correct;
- unrelated user work will not be overwritten.

Never use:

```text
git reset --hard
git clean -fd
git push --force
git push --force-with-lease
git filter-repo
git filter-branch
```

unless explicitly authorized by the Project Owner.

Never amend or rewrite an existing shared commit merely to make history look cleaner.

---

# 9. Mandatory Commit and Push Workflow

## 9.1 General rule

Every completed atomic change set MUST follow:

```text
edit
→ validate
→ test
→ inspect diff
→ secret/log scan
→ commit
→ push
→ verify remote state
```

An atomic change set means one logically complete change, for example:

```text
fix stale-state boundary logic
add elevator-shaft component
add browser regression test
add QA harness check
update one approved documentation rule
```

Do not commit every keystroke.

But once an atomic change is complete, Codex MUST commit and push it before beginning the next unrelated change.

---

## 9.2 Repository-specific push destinations

When working in:

```text
C:\NST\Software Dev\lms-ng
```

the expected remote repository is:

```text
https://github.com/Meltingth/lms-ng.git
```

When working in:

```text
C:\NST\Software Dev\WhizdomLift
```

the expected remote repository is:

```text
https://github.com/Meltingth/WhizdomLift.git
```

The same repository mapping applies to Dell runtime clones:

```text
D:\lms-ng
→ https://github.com/Meltingth/lms-ng.git

D:\WhizdomLift
→ https://github.com/Meltingth/WhizdomLift.git
```

Before push:

```powershell
git remote get-url origin
```

If the URL does not match the expected repository:

```text
STOP_PUSH
REMOTE_MISMATCH
```

Do not silently change the remote without explicit authorization.

---

## 9.3 Push rule

After every successful atomic commit:

```powershell
git push origin HEAD
```

If the branch has no upstream:

```powershell
git push -u origin <current-branch>
```

only when branch creation/push is allowed by current project instructions.

Then verify:

```powershell
git status
git log -1 --oneline
git rev-parse HEAD
git rev-parse @{u}
```

Local HEAD and upstream HEAD must match before declaring the change delivered.

---

## 9.4 Production Dell exception

The Dell production repositories are deployment/runtime clones.

Normal development commits MUST NOT originate from:

```text
D:\WhizdomLift
D:\lms-ng
```

unless explicitly authorized.

Normal deployment flow is:

```text
DEV branch
→ tests
→ Codex audit
→ Architect review
→ GitHub push
→ approved merge/release
→ SSH to Dell
→ fetch/pull exact approved commit
→ deploy
```

Do not create ad-hoc production-only commits on Dell.

If an emergency production fix is explicitly authorized:

1. capture current production SHA;
2. create a named emergency branch;
3. make the smallest possible change;
4. test it;
5. commit;
6. push to GitHub immediately;
7. back-port/reconcile to DEV;
8. document divergence.

Never leave a production-only code change unpushed.

---

# 10. No Uncommitted Source Changes at Task End

Before reporting completion:

```powershell
git status --short
```

The working tree must contain no unexplained source changes.

Allowed local-only files must be explicitly identified.

If completed source changes remain uncommitted:

```text
TASK_NOT_COMPLETE
```

---

# 11. Commit Message Convention

Use meaningful Conventional Commit-style messages.

Examples:

```text
feat(hud): add elevator shaft primitives
feat(hud): add realtime elevator store
fix(hud): align SIM freshness threshold with contract
test(hud): add stale and heartbeat boundary cases

test(audit): add exact-sha Claude review harness
fix(audit): fail when baseline input is missing
docs(audit): record P1 offline audit findings
```

Avoid:

```text
update
fix stuff
changes
work
final
```

---

# 12. Files That MUST NOT Be Automatically Committed or Pushed

Never commit or push:

```text
.env
.env.*
private keys
TLS private keys
passwords
tokens
API keys
SSH credentials
database credentials
real authentication cookies
secret configuration
```

Never automatically commit continuing operational data:

```text
capture_lift_*.log
capture_launcher.log
*.pid
live telemetry dumps
production database dumps
private task XML exports
raw secrets scans
```

Do not delete these local files merely because they should not be committed.

Use sanitized deterministic fixtures instead.

---

# 13. Operational Log Policy

Live WhizdomLift operational logs are local runtime artifacts.

They must not be included in normal feature commits.

If Git already tracks them:

- do not add new growth to a Codex commit;
- do not delete local runtime copies;
- do not rewrite public Git history without authorization;
- report the condition to the Architect.

Testing must prefer:

```text
tests/fixtures/
```

with sanitized deterministic samples.

---

# 14. Pre-Commit Safety Check

Before every commit:

```powershell
git diff
git diff --cached
git status --short
```

Check for:

- secrets;
- raw operational logs;
- accidental binaries;
- unrelated changes;
- generated build artifacts;
- local paths that should not be public;
- credentials;
- user-specific machine information.

If questionable data appears:

```text
STOP
DO_NOT_COMMIT
```

---

# 15. Security Scan Before Push

Before every push inspect staged/committed changes for:

```text
password
secret
token
api key
private key
bearer credential
connection string
AWS-style key
SSH private key
certificate private key
```

Also inspect for operational telemetry.

If a likely secret is found:

```text
STOP_PUSH
```

Report only file/path and type; do not expose the secret value unnecessarily.

---

# 16. Testing Before Commit

Every code change must run applicable tests before commit.

Minimum Frontend checks:

```text
npm test
npm run build
```

plus targeted tests.

For UI behavior changes, run browser QA where applicable.

If a required test is unavailable:

```text
BLOCKED
or
NOT_RUN
```

Never convert it to PASS.

---

# 17. Testing After Commit

After commit:

```powershell
git status
git show --stat --oneline HEAD
```

For critical changes rerun targeted tests against committed HEAD.

---

# 18. Audit Independence

When auditing Claude, Codex MUST use the exact Claude commit.

Audit reports identify:

```text
ClaudeCommit
ComparisonBase
ContractVersion
ContractHash
AuditBranch
AuditCommit
```

Never audit arbitrary current working-tree contents if they differ from the supplied Claude SHA.

If the exact SHA cannot be obtained:

```text
BLOCKED
```

---

# 19. Audit Report Location

Audit reports:

```text
docs/audit/AUDIT_<PHASE>_<CLAUDE_SHA>.md
```

Include:

```text
AUDIT_RESULT
PASS/FAIL/BLOCKED/NOT_RUN counts
Critical findings
Major findings
Minor findings
Evidence paths
Regression risk
Deployment recommendation
NextAllowedAction
```

---

# 20. WhizdomLift Safety Rules

Without explicit live-gate authorization, Codex MUST NOT:

```text
open a real COM port
write serial data
stop Capture
restart Capture
modify Scheduled Task
flash firmware
change Arduino pins
change relay polarity
change production launcher behavior
modify deployed log_lift.py
start a live Gateway agent
perform live fault injection
```

---

# 21. Frontend Data Truthfulness

Frontend never invents operational facts.

Never calculate floor labels from `floorRaw`.

Use Backend-provided:

```text
floorDisplay
floorKind
floorProfileVersion
displayAnchor
```

Current W-05 known mapping:

```text
1  → B1
2  → 1
47 → 44
```

Codes:

```text
3..46
```

remain uncalibrated until Backend provides authoritative mapping.

---

# 22. Freshness Rules

SIM source state:

```text
age < 30s   → FRESH
age >= 30s  → STALE
```

REAL transport:

```text
age < 75s        → OK
75s <= age < 90s → AGING
age >= 90s       → NO_RXTX
```

REAL source state:

```text
age < 90s   → VALID
age >= 90s  → STALE
```

Gateway heartbeat:

```text
age < 30s   → ONLINE
age >= 30s  → OFFLINE
```

WebSocket disconnect:

```text
SERVER_DISCONNECTED immediately
cancel predictive/render motion immediately
```

A 15-second reconciliation interval does not refresh source telemetry.

---

# 23. Animation Rules

Animation is presentation only.

Allowed:

```text
confirmed Floor 20
new confirmed Floor 21
render 20 → 21 smoothly
```

Forbidden:

```text
direction = UP
therefore invent 22, 23, 24
```

When telemetry is stale:

- stop predictive movement;
- preserve last confirmed position;
- show stale state visibly.

Alarm/status changes must not wait for animation completion.

---

# 24. LIVE / TEST / DEMO Isolation

Views:

```text
LIVE
TEST
DEMO
HISTORY
```

must remain distinguishable.

DEMO must never:

- publish fake data to REAL MQTT;
- contaminate LIVE history;
- generate REAL alarms;
- modify LIVE current state.

---

# 25. Dependency Changes

When adding/updating dependencies:

1. explain why;
2. pin versions;
3. update lockfile;
4. run dependency audit;
5. run tests/build;
6. keep unrelated upgrades separate.

Do not silently upgrade unrelated packages.

---

# 26. Build Artifacts

Do not commit normal generated outputs:

```text
dist/
coverage/
playwright-report/
test-results/
.tmp/
.cache/
```

Formal review screenshots may be committed under an approved evidence directory.

---

# 27. Dell Deployment Workflow

Normal deployment:

```text
C:\NST\Software Dev\lms-ng
or
C:\NST\Software Dev\WhizdomLift
        ↓
development branch
        ↓
tests
        ↓
audit
        ↓
Architect review
        ↓
push GitHub
        ↓
approved merge/release
        ↓
SSH Dell
        ↓
D:\lms-ng
or
D:\WhizdomLift
        ↓
fetch exact approved commit
        ↓
deploy
        ↓
post-deploy verification
```

Production Dell must not become a separate source of truth.

GitHub remains the source of committed code.

---

# 28. Deployment Candidate

Before Dell deployment create:

```text
DEPLOYMENT_CANDIDATE.md
```

containing:

```text
releaseVersion
repository
remoteUrl
sourceBranch
sourceCommit
backendCommit
frontendCommit
contractVersion
contractHash
migrationVersion
testSummary
auditSummary
rollbackProcedure
targetHost
targetPath
```

Then STOP for deployment authorization.

---

# 29. SSH Deployment Safety

When SSH is authorized, start read-only.

Verify:

```text
hostname
OS
IP/network
disk
RAM
current repository path
git remote
current branch
current commit
git status
Docker/runtime
services
containers
volumes
database
certificates
configuration
```

Do not assume Dell contains an empty clone.

Never automatically:

```text
docker system prune
delete volumes
drop database
overwrite production data
change firewall
change hostname
replace certificates
```

---

# 30. Deployment Commit Verification

Before updating Dell:

```powershell
git fetch origin
```

Verify the intended commit exists on GitHub.

Then verify the deployment candidate SHA exactly.

Production deployment must use a specific approved SHA/tag, not merely:

```text
git pull latest
```

or:

```text
checkout whatever main currently is
```

unless explicitly authorized.

After deployment record:

```text
repo
targetPath
previousSHA
deployedSHA
branch/tag
time
migration status
health status
rollback target
```

---

# 31. Database Rules

Static SQL parsing is not execution proof.

Distinguish:

```text
STATIC_VALIDATION
POSTGRES_EXECUTION
```

Do not run Docker/PostgreSQL on the WhizdomLift Gateway merely to satisfy a gate.

---

# 32. Commit Granularity

Prefer small verifiable commits.

Good:

```text
fix(hud): correct SIM freshness boundary
test(hud): add freshness boundary coverage
docs(frontend): record milestone 02 evidence
```

Bad:

```text
feat: update frontend backend docs tests deps
```

---

# 33. No Silent Fixes During Audit

When auditing Claude and finding a Claude-owned defect:

Do not patch it unless explicitly authorized.

Document:

```text
Finding
Severity
Evidence
Reproduction
Expected
Actual
SuggestedFix
```

The Architect decides ownership of the correction.

---

# 34. Production/Development Path Validation Tests

Any deployment or helper script that uses repository roots must support both environments.

Required test cases:

```text
DEV:
C:\NST\Software Dev\lms-ng
C:\NST\Software Dev\WhizdomLift

PRODUCTION:
D:\lms-ng
D:\WhizdomLift
```

Prefer path discovery over equality comparisons.

A test must fail if the tool:

```text
assumes D:\ on DEV
assumes C:\NST\Software Dev on Production
writes to the wrong sibling repository
pushes to the wrong Git remote
```

---

# 35. Cross-Repository Operations

Before any operation involving both repositories, resolve both actual roots independently.

Do not derive one repo by replacing text in the other's path.

Bad:

```text
$Whizdom = $LmsNg.Replace("lms-ng", "WhizdomLift")
```

Good:

```text
explicit config
environment variable
CLI arguments
repository discovery
```

For scripts requiring both repos, support explicit parameters such as:

```powershell
-LmsNgRoot "C:\NST\Software Dev\lms-ng" `
-WhizdomRoot "C:\NST\Software Dev\WhizdomLift"
```

and corresponding Dell paths when authorized.

---

# 36. End-of-Task Mandatory Checklist

Before finishing any task with repository changes:

```text
[ ] Correct machine role identified
[ ] Correct repository path
[ ] Correct Git remote URL
[ ] Correct branch
[ ] Applicable AGENTS.md read
[ ] Frozen Contract untouched unless authorized
[ ] Tests executed
[ ] Build executed where applicable
[ ] Browser QA executed where applicable
[ ] git diff reviewed
[ ] secrets/operational-data scan completed
[ ] Atomic changes committed
[ ] Commits pushed
[ ] Local HEAD equals upstream HEAD
[ ] Working tree clean or exceptions documented
[ ] Commit SHAs recorded
[ ] Evidence paths recorded
[ ] Gate unchanged unless explicitly approved
```

Final response must include:

```text
environment:
repoPath:
remote:
branch:
commit(s):
pushStatus:
tests:
build:
auditResult:
filesChanged:
knownIssues:
gateStatus:
nextAllowedAction:
```

---

# 37. Stop Conditions

STOP and request Architect decision if:

```text
Contract defect
unknown live-system side effect
potential secret exposure
unexpected main-branch modification
database destructive migration risk
Capture safety risk
need to access COM/serial
need to alter Scheduled Task
need to force-push
need to rewrite Git history
remote mismatch
repository path ambiguity
unclear gate authorization
```

Preserve evidence instead of improvising around a safety boundary.

---

# 38. Core Principle

The objective is not merely green tests.

Every meaningful change must remain traceable:

```text
requirement
→ code
→ test
→ evidence
→ commit
→ push
→ audit
→ Architect review
→ approved deployment
```

Development happens primarily on the DEV workstation.

GitHub is the source of committed code.

Dell is the deployment/runtime environment.

Production must never silently become a separate source of truth.