# Integration checks write only into a new temporary fixture and never launch Edge.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$installer = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\scripts\client\Install-HudClient.ps1'))
$temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\', '/') + '\'
$fixtureRoot = Join-Path $temporaryRoot ('LMS HUD fixture ' + [guid]::NewGuid().ToString('N'))
[void][System.IO.Directory]::CreateDirectory($fixtureRoot)
$script:passCount = 0
$script:passedChecks = @()

function Check([bool]$Condition, [string]$Name) {
    if (-not $Condition) { throw "FAIL: $Name" }
    $script:passCount++
    $script:passedChecks += $Name
}
function Reject([scriptblock]$Action, [string]$Name) {
    $rejected = $false
    try { & $Action | Out-Null } catch { $rejected = $true }
    Check $rejected $Name
}
function Read-Link([string]$Path) {
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($Path)
    try {
        [pscustomobject]@{ Target = $link.TargetPath; Arguments = $link.Arguments; Description = $link.Description; Icon = $link.IconLocation }
    } finally {
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
    }
}

try {
    $plan = & $installer -ServerUrl 'https://hud.example.test/building-a/' -TestRoot $fixtureRoot -WhatIf
    Check (@(Get-ChildItem -LiteralPath $fixtureRoot -Force).Count -eq 0) 'WhatIf creates no files or folders'
    Check ($plan.serverUrl -eq 'https://hud.example.test/building-a/') 'Plan preserves an explicit server path'
    Check ($plan.desktopShortcut.StartsWith($fixtureRoot) -and $plan.startupShortcut.StartsWith($fixtureRoot)) 'Fixture redirects both shortcuts away from current-user folders'

    foreach ($badUrl in @('file:///C:/Windows/notepad.exe', 'javascript:alert(1)', '--no-sandbox', 'https://user:secret@hud.example.test/', 'https://hud.example.test/?token=secret', 'https://hud.example.test/#secret', 'https://hud.example.test/" --no-sandbox', 'https://hud.example.test/ space', "https://hud.example.test/`n", 'https:\hud.example.test\')) {
        Reject { & $installer -ServerUrl $badUrl -TestRoot $fixtureRoot } ('Rejects unsafe URL: ' + $badUrl.Replace("`n", '\n'))
    }
    Check (@(Get-ChildItem -LiteralPath $fixtureRoot -Force).Count -eq 0) 'Rejected URLs leave no install artifacts'
    Reject { & $installer -ServerUrl 'https://hud.example.test/' -EdgePath 'relative\msedge.exe' -TestRoot $fixtureRoot } 'Rejects relative executable paths'
    Reject { & $installer -ServerUrl 'https://hud.example.test/' -TestRoot $temporaryRoot } 'Rejects TEMP itself as a test fixture root'

    $plan = & $installer -ServerUrl 'https://hud.example.test/building-a/' -TestRoot $fixtureRoot
    Check ((Test-Path -LiteralPath $plan.desktopShortcut -PathType Leaf) -and (Test-Path -LiteralPath $plan.startupShortcut -PathType Leaf)) 'Creates both Desktop and Startup shortcuts in the fixture'
    $desktop = Read-Link $plan.desktopShortcut
    $startup = Read-Link $plan.startupShortcut
    Check ($desktop.Target -eq $plan.edgePath -and $startup.Target -eq $plan.edgePath) 'Both shortcuts invoke Edge directly'
    Check ($desktop.Arguments -eq $plan.arguments -and $startup.Arguments -eq $plan.arguments) 'Both saved shortcuts preserve identical launch arguments'
    Check ($desktop.Arguments.Contains('--kiosk "https://hud.example.test/building-a/" --edge-kiosk-type=fullscreen --no-first-run')) 'Uses the documented Edge fullscreen kiosk flags'
    Check ($desktop.Arguments.Contains(('--user-data-dir="{0}"' -f $plan.profilePath))) 'Quotes the dedicated profile path with spaces'
    Check ($desktop.Description -eq 'LMS-NG HUD client v1' -and $desktop.Icon.EndsWith(',0')) 'Shortcut includes ownership marker and Desktop icon'
    Check (-not (Test-Path -LiteralPath $plan.profilePath)) 'Setup never launches Edge or creates its profile'

    $manifest = Join-Path (Split-Path -Parent $plan.profilePath) 'client-install.json'
    $beforeWhatIf = Get-FileHash -LiteralPath $manifest
    & $installer -ServerUrl 'https://changed.example.test/' -TestRoot $fixtureRoot -WhatIf | Out-Null
    Check ((Get-FileHash -LiteralPath $manifest).Hash -eq $beforeWhatIf.Hash) 'WhatIf update leaves the existing configuration unchanged'
    $updated = & $installer -ServerUrl 'http://hud.example.test:8080/hud/' -TestRoot $fixtureRoot
    Check ((Read-Link $updated.startupShortcut).Arguments.Contains('"http://hud.example.test:8080/hud/"')) 'Repeated install updates the server URL including port and path'
    Check (@(Get-ChildItem -LiteralPath (Split-Path -Parent $updated.desktopShortcut) -Filter '*.lnk').Count -eq 1) 'Repeated install does not create duplicate shortcuts'

    [void][System.IO.Directory]::CreateDirectory($updated.profilePath)
    $profileSentinel = Join-Path $updated.profilePath 'keep-profile.txt'
    Set-Content -LiteralPath $profileSentinel -Value 'preserve browser data'
    $otherFile = Join-Path (Split-Path -Parent $manifest) 'unrelated.txt'
    Set-Content -LiteralPath $otherFile -Value 'preserve unrelated file'
    & $installer -Uninstall -TestRoot $fixtureRoot -WhatIf
    Check ((Test-Path -LiteralPath $updated.desktopShortcut) -and (Test-Path -LiteralPath $manifest)) 'WhatIf uninstall preserves the installation'
    & $installer -Uninstall -TestRoot $fixtureRoot
    Check (-not (Test-Path -LiteralPath $updated.desktopShortcut) -and -not (Test-Path -LiteralPath $updated.startupShortcut) -and -not (Test-Path -LiteralPath $manifest)) 'Uninstall removes only the two owned shortcuts and manifest'
    Check ((Test-Path -LiteralPath $profileSentinel) -and (Test-Path -LiteralPath $otherFile)) 'Uninstall preserves the browser profile and unrelated files'
    & $installer -Uninstall -TestRoot $fixtureRoot
    Check (Test-Path -LiteralPath $profileSentinel) 'Repeated uninstall remains safe'

    Set-Content -LiteralPath $manifest -Value '{"owner":"someone else"}'
    Reject { & $installer -ServerUrl 'https://hud.example.test/' -TestRoot $fixtureRoot } 'Install refuses an unowned manifest'
    Reject { & $installer -Uninstall -TestRoot $fixtureRoot } 'Uninstall refuses an unowned manifest'
    Check ((Get-Content -LiteralPath $manifest -Raw).Contains('someone else')) 'Unowned manifest remains intact'
    Remove-Item -LiteralPath $manifest

    $shell = New-Object -ComObject WScript.Shell
    $unowned = $shell.CreateShortcut($updated.desktopShortcut)
    try {
        $unowned.TargetPath = $updated.edgePath
        $unowned.Description = 'Unrelated user shortcut'
        $unowned.Save()
    } finally {
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($unowned)
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
    }
    Reject { & $installer -ServerUrl 'https://hud.example.test/' -TestRoot $fixtureRoot } 'Install refuses an unowned shortcut'
    Reject { & $installer -Uninstall -TestRoot $fixtureRoot } 'Uninstall refuses an unowned shortcut'
    Check ((Read-Link $updated.desktopShortcut).Description -eq 'Unrelated user shortcut') 'Unowned shortcut remains intact'
    Check (-not (Test-Path -LiteralPath $updated.startupShortcut)) 'Collision preflight prevents partial installation'

    [pscustomobject]@{ result = 'PASS'; tests = $script:passCount; checks = $script:passedChecks; actualUserInstall = 'NOT_RUN'; edgeLaunch = 'NOT_RUN'; signIn = 'NOT_RUN'; dellDeployment = 'NOT_RUN' } | ConvertTo-Json -Depth 3
} finally {
    # Delete only this exact random test directory, after validating the resolved boundary.
    $resolvedFixture = [System.IO.Path]::GetFullPath($fixtureRoot)
    if ($resolvedFixture.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path -Leaf $resolvedFixture) -match '^LMS HUD fixture [a-f0-9]{32}$') {
        Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
    } else {
        throw 'Refusing test cleanup outside the verified temporary fixture.'
    }
}
