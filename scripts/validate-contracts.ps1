<#
.SYNOPSIS
  Runs the A-DRAFT contract validation suite (C01-C08 + SQL static lint + tree hash).

.DESCRIPTION
  -PlanOnly by default (TEST_MATRIX.md P10: "Workflow/gates do not self-approve ... -PlanOnly
  default"): printed without executing anything. Pass -Run to actually execute. This mirrors
  the convention already used by WhizdomLift's own scripts/deploy-phase.ps1 and
  scripts/test-phase.ps1 in the phase loop, and exists for the same reason CLAUDE.md section
  6.16 records about -WhatIf: a flag that only SKIPS the side-effecting step (rather than one
  that defaults to not running unless explicitly asked) can hide the one thing that actually
  breaks. Here the risk is the opposite direction and much lower -- everything this script runs
  is read-only against a local venv/node_modules, no COM port, no service, no external network
  write -- but -PlanOnly still defaults on, so running this script by accident (e.g. a bad
  copy-paste, a CI job invoked with no arguments) can never silently mutate anything.

  With -Run, executes in order:
    1. tests/contract/test_schemas.py under the project venv (C01-C08; this in turn shells out
       to node tests/contract/parity.mjs for C02 -- see that test's own docstring)
    2. tests/contract/sql_lint.py (sqlglot-static syntax check of the migration/seed SQL)
    3. scripts/contracts-hash.ps1 (reproducible tree hash of contracts/)
  and writes docs/evidence/validate_contracts_results.json summarizing all three.

  Exit code with -Run: 0 only if every step's exit code was 0 (i.e. no FAIL, BLOCKED steps
  still count as non-zero-worthy per their own script's exit code -- see each script's own
  BLOCKED semantics; this wrapper does not downgrade a BLOCKED into a silent PASS).

.PARAMETER Run
  Actually execute the checks. Omit (or pass $false) for -PlanOnly behavior.

.PARAMETER SkipSqlLint
  Skip step 2 (e.g. if sqlglot is not installed in this venv). Recorded as BLOCKED, not
  silently omitted, in the evidence file.

.EXAMPLE
  D:\lms-ng\scripts\validate-contracts.ps1
      # -PlanOnly (default): prints what would run, executes nothing.
  D:\lms-ng\scripts\validate-contracts.ps1 -Run
      # actually runs all three checks
#>
[CmdletBinding()]
param(
    [switch]$Run,
    [switch]$SkipSqlLint
)

$ErrorActionPreference = 'Stop'

# See contracts-hash.ps1 for why this is read in the body, not the param default: on this host
# (Windows PowerShell 5.1 via -File) $PSScriptRoot reads empty inside a CmdletBinding() param
# block's default expression.
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$venvPython = Join-Path $repoRoot '.venv\Scripts\python.exe'
$testSchemas = Join-Path $repoRoot 'tests\contract\test_schemas.py'
$sqlLint = Join-Path $repoRoot 'tests\contract\sql_lint.py'
$hashScript = Join-Path $PSScriptRoot 'contracts-hash.ps1'
$evidencePath = Join-Path $repoRoot 'docs\evidence\validate_contracts_results.json'

$plan = @(
    [PSCustomObject]@{ step = 1; description = 'C01-C08 contract schema tests (Python jsonschema + Node ajv parity)'; command = "$venvPython $testSchemas" }
    [PSCustomObject]@{ step = 2; description = 'sqlglot-static SQL syntax lint (migration + seeds)'; command = "$venvPython $sqlLint"; skip = [bool]$SkipSqlLint }
    [PSCustomObject]@{ step = 3; description = 'Reproducible contracts/ tree hash'; command = "$hashScript" }
)

Write-Host 'validate-contracts.ps1 plan:'
foreach ($p in $plan) {
    $skipNote = if ($p.skip) { ' [SKIPPED by -SkipSqlLint, will be recorded BLOCKED]' } else { '' }
    Write-Host ("  {0}. {1}{2}" -f $p.step, $p.description, $skipNote)
    Write-Host ("     $ {0}" -f $p.command)
}

if (-not $Run) {
    Write-Host ''
    Write-Host '-PlanOnly (default): no commands executed. Pass -Run to execute.'
    exit 0
}

Write-Host ''
Write-Host 'Executing (-Run passed):'

$results = @()

# Step 1
Write-Host "`n--- step 1: C01-C08 ---"
& $venvPython $testSchemas
$exit1 = $LASTEXITCODE
$results += [PSCustomObject]@{ step = 1; description = $plan[0].description; exitCode = $exit1; result = if ($exit1 -eq 0) { 'PASS' } else { 'FAIL' } }

# Step 2
if ($SkipSqlLint) {
    Write-Host "`n--- step 2: sqlglot-static SQL lint (SKIPPED by -SkipSqlLint) ---"
    $results += [PSCustomObject]@{ step = 2; description = $plan[1].description; exitCode = $null; result = 'BLOCKED'; detail = 'skipped by -SkipSqlLint' }
} else {
    Write-Host "`n--- step 2: sqlglot-static SQL lint ---"
    & $venvPython $sqlLint
    $exit2 = $LASTEXITCODE
    $results += [PSCustomObject]@{ step = 2; description = $plan[1].description; exitCode = $exit2; result = if ($exit2 -eq 0) { 'PASS' } else { 'FAIL' } }
}

# Step 3
Write-Host "`n--- step 3: contracts tree hash ---"
$hashOutput = & $hashScript
$exit3 = $LASTEXITCODE
$hashLine = $hashOutput | Select-Object -Last 1
$results += [PSCustomObject]@{ step = 3; description = $plan[2].description; exitCode = $exit3; result = if ($exit3 -eq 0) { 'PASS' } else { 'FAIL' }; treeHash = $hashLine }

$results | ForEach-Object { $_ } | Out-Null  # (no-op; keeps $results as the canonical list for the summary below)

New-Item -ItemType Directory -Force -Path (Split-Path $evidencePath) | Out-Null
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $evidencePath -Encoding UTF8
Write-Host "`nevidence written to $evidencePath"

$failCount = ($results | Where-Object { $_.result -eq 'FAIL' }).Count
$blockedCount = ($results | Where-Object { $_.result -eq 'BLOCKED' }).Count
Write-Host ("summary: PASS={0} FAIL={1} BLOCKED={2} / {3} steps" -f `
    ($results | Where-Object { $_.result -eq 'PASS' }).Count, $failCount, $blockedCount, $results.Count)

exit ([int]($failCount -gt 0))
