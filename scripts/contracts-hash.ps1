<#
.SYNOPSIS
  Computes a reproducible SHA-256 tree hash over the contracts/ bundle.

.DESCRIPTION
  Reads every file under contracts/ (excluding contracts/RELEASE_MANIFEST.json -- a manifest
  cannot hash itself, see that file's own "bundle.note" -- and any file literally named
  SOURCE.md, which is a vendoring pointer written on the CONSUMING side, not bundle content).
  Each file's bytes are LF-normalised (CRLF and lone CR both become LF) before hashing, so the
  result does not depend on which OS or editor wrote the file -- this repo has contributors on
  Windows only so far, but the contract bundle is meant to be vendored into WhizdomLift too
  (see WhizdomLift's own scripts/sync-contracts.ps1), and a hash that silently changed with
  line-ending settings would make G-A approval unreproducible for no real reason.

  Per-file hashes are combined into one manifest text (`relativePath:sha256\n`, sorted
  ordinally by relative path with forward slashes so file system iteration order never
  matters), and the tree hash is SHA-256 over that manifest text. This means the tree hash
  changes if ANY file's content changes, if any file is added or removed, or if any file is
  renamed -- all three are things a "did the contract bundle actually change" check needs to
  catch.

.PARAMETER ContractsPath
  Root to hash. Defaults to <repo>/contracts (this script's own parent's sibling).

.PARAMETER ShowFiles
  Also print the full per-file manifest (path:hash), not just the totals and tree hash. Useful
  when two runs disagree and you need to find which file changed.

.EXAMPLE
  D:\lms-ng\scripts\contracts-hash.ps1
  D:\lms-ng\scripts\contracts-hash.ps1 -ShowFiles
#>
[CmdletBinding()]
param(
    [string]$ContractsPath,
    [switch]$ShowFiles
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot is read here, in the script body, rather than as the param block's default
# value expression -- on this host (Windows PowerShell 5.1, invoked via `-File`) $PSScriptRoot
# reads as empty INSIDE a CmdletBinding() param block's default expression (reproduced with a
# 3-line minimal script; a real host quirk here, not a typo) even though it is populated
# correctly everywhere else in the script, including this line.
if (-not $ContractsPath) {
    # Join-Path only takes one ChildPath segment on Windows PowerShell 5.1 (this host) --
    # -AdditionalChildPath is a PS 6+ addition -- so this chains two calls rather than the
    # single 3-argument form that works on pwsh but not here.
    $ContractsPath = Join-Path (Join-Path $PSScriptRoot '..') 'contracts'
}

$root = (Resolve-Path -LiteralPath $ContractsPath).Path.TrimEnd('\')

# Exclusions -- see the header comment for why each one is excluded, not just that it is.
$excludeNames = @('RELEASE_MANIFEST.json', 'SOURCE.md')

$files = Get-ChildItem -LiteralPath $root -Recurse -File |
    Where-Object { $excludeNames -notcontains $_.Name }

if (-not $files -or $files.Count -eq 0) {
    Write-Error "no files found under $root (after exclusions) -- refusing to hash an empty bundle"
    exit 2
}

# ISO-8859-1 (Latin1) is a 1:1 byte<->char mapping for bytes 0-255, so round-tripping bytes
# through it for the CRLF/CR replacement never corrupts UTF-8 (or any other encoding) content
# the way decoding as UTF-8 text first could if a file were ever not valid UTF-8.
$latin1 = [System.Text.Encoding]::GetEncoding('ISO-8859-1')
$sha256 = [System.Security.Cryptography.SHA256]::Create()

function Get-NormalizedFileHash([System.IO.FileInfo]$file) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $raw = $latin1.GetString($bytes)
    $normalized = $raw -replace "`r`n", "`n" -replace "`r", "`n"
    $normalizedBytes = $latin1.GetBytes($normalized)
    $hashBytes = $sha256.ComputeHash($normalizedBytes)
    return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
}

$entries = foreach ($f in $files) {
    $relPath = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
    [PSCustomObject]@{
        RelPath = $relPath
        Hash    = Get-NormalizedFileHash $f
    }
}

# Ordinal (byte-value) sort, explicitly not culture-aware -- so this produces the same order
# on every machine regardless of locale.
#
# CAUGHT BY tests/test_contracts.py IN THE WHIZDOMLIFT REPO, WHICH REIMPLEMENTS THIS SAME
# ALGORITHM IN PYTHON: `Sort-Object -Property RelPath -CaseSensitive` (the line this replaces)
# does NOT produce a true ordinal/byte-value sort on Windows PowerShell 5.1 -- -CaseSensitive
# only makes case a tie-breaker within an otherwise culture-aware comparison, so e.g.
# "README.md" sorted AFTER "mqtt/..." even though 'R' (0x52) is a lower byte value than 'm'
# (0x6D). Python's plain `list.sort()` on str IS codepoint-ordinal, so the two
# implementations silently produced different manifest orderings and therefore different tree
# hashes for the exact same files -- a real bug, not a hypothetical one; reproduced and fixed
# by hashing the same 38-file tree with both and diffing the per-file line order. Fixed by
# sorting through .NET's actual ordinal string comparer instead of Sort-Object's default.
$sortedPaths = New-Object 'System.Collections.Generic.List[string]'
foreach ($e in $entries) { $sortedPaths.Add($e.RelPath) }
$sortedPaths.Sort([System.StringComparer]::Ordinal)
$hashByPath = @{}
foreach ($e in $entries) { $hashByPath[$e.RelPath] = $e.Hash }
$manifestLines = foreach ($p in $sortedPaths) { "$($p):$($hashByPath[$p])" }
$manifestText = ($manifestLines -join "`n") + "`n"

$treeHashBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($manifestText))
$treeHashHex = ([System.BitConverter]::ToString($treeHashBytes) -replace '-', '').ToLowerInvariant()

if ($ShowFiles) {
    $manifestLines | ForEach-Object { Write-Host $_ }
    Write-Host '---'
}
Write-Host "files: $($sortedPaths.Count) (excluded: $($excludeNames -join ', '))"
Write-Host "treeHash: sha256:$treeHashHex"

# Last line only, unprefixed: this is what a caller (validate-contracts.ps1,
# WhizdomLift's sync-contracts.ps1 -Check) should capture and parse.
Write-Output "sha256:$treeHashHex"
