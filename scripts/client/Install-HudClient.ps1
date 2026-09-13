<#
.SYNOPSIS
Creates a per-user HUD Desktop shortcut and starts the HUD fullscreen at sign-in.
.DESCRIPTION
Run on each Windows client, as that display's signed-in user, after deployment.
Requires an explicit HTTP(S) server URL. Never starts a browser during setup.
Use -WhatIf to preview, or -Uninstall to remove only this installer's owned files.
TestRoot redirects all output into a temporary fixture, never real user folders.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium', DefaultParameterSetName = 'Install')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Install')]
    [string]$ServerUrl,
    [Parameter(ParameterSetName = 'Install')]
    [string]$EdgePath,
    [Parameter(Mandatory = $true, ParameterSetName = 'Uninstall')]
    [switch]$Uninstall,
    [string]$TestRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ownerId = 'LMS-NG HUD client v1'
$shortcutName = 'LMS-NG HUD.lnk'

function Assert-SafePath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path) -or $Path -match '["\x00-\x1f]') {
        throw 'A filesystem path is empty or contains unsupported characters.'
    }
    # Refuse junctions/symlinks, including existing parent components.
    $cursor = [System.IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            $item = Get-Item -LiteralPath $cursor -Force
            if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                throw "Refusing a reparse-point path: $cursor"
            }
        }
        $parent = [System.IO.Directory]::GetParent($cursor)
        $cursor = if ($parent) { $parent.FullName } else { $null }
    }
}

function Get-HudUrl([string]$Value) {
    $parsed = $null
    if ($Value -match '[\s"\\\x00-\x1f]' -or
        -not [System.Uri]::TryCreate($Value, [System.UriKind]::Absolute, [ref]$parsed) -or
        $parsed.Scheme -notin @('http', 'https') -or
        [string]::IsNullOrWhiteSpace($parsed.Host) -or $parsed.UserInfo -or $parsed.Fragment) {
        throw 'ServerUrl must be an absolute HTTP(S) URL without credentials, fragment, whitespace, backslashes or quotes.'
    }
    # Store no authentication material in shortcuts or the local manifest.
    if ($parsed.Query) {
        throw 'ServerUrl must not contain a query string; use the HUD URL path without tokens or secrets.'
    }
    return $parsed.AbsoluteUri
}

function Resolve-Edge([string]$RequestedPath) {
    $candidates = @()
    if ($RequestedPath) {
        if (-not [System.IO.Path]::IsPathRooted($RequestedPath)) { throw 'EdgePath must be absolute.' }
        $candidates = @($RequestedPath)
    } else {
        foreach ($base in @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)) {
            if ($base) { $candidates += Join-Path $base 'Microsoft\Edge\Application\msedge.exe' }
        }
    }
    foreach ($candidate in $candidates) {
        if ((Split-Path -Leaf $candidate) -ieq 'msedge.exe' -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            Assert-SafePath $candidate
            return [System.IO.Path]::GetFullPath($candidate)
        }
    }
    throw 'Microsoft Edge was not found. Install Edge or supply its absolute msedge.exe path with -EdgePath.'
}

if ($env:OS -ne 'Windows_NT') { throw 'HUD client setup requires Windows.' }
if ($TestRoot) {
    # This option is intentionally limited to an existing directory below TEMP.
    $fixtureRoot = [System.IO.Path]::GetFullPath($TestRoot).TrimEnd('\', '/')
    $temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\', '/') + '\'
    if (-not $fixtureRoot.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $fixtureRoot -PathType Container)) {
        throw 'TestRoot must be an existing child directory of the current TEMP folder.'
    }
    Assert-SafePath $fixtureRoot
    $desktopFolder = Join-Path $fixtureRoot 'Desktop'
    $startupFolder = Join-Path $fixtureRoot 'Startup'
    $installFolder = Join-Path $fixtureRoot 'LocalAppData\LMS-NG\HUD'
} else {
    $desktopFolder = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
    $startupFolder = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup)
    $localFolder = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    if (-not $desktopFolder -or -not $startupFolder -or -not $localFolder) {
        throw 'Current-user Desktop, Startup, and LocalApplicationData folders must be available.'
    }
    $installFolder = Join-Path $localFolder 'LMS-NG\HUD'
}

$desktopLink = Join-Path $desktopFolder $shortcutName
$startupLink = Join-Path $startupFolder $shortcutName
$manifestPath = Join-Path $installFolder 'client-install.json'
$profilePath = Join-Path $installFolder 'EdgeProfile'
foreach ($path in @($desktopLink, $startupLink, $manifestPath, $profilePath)) { Assert-SafePath $path }

# Check every collision before the first write. No manifest paths are trusted for deletion.
if (Test-Path -LiteralPath $manifestPath) {
    $existingManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if (-not ($existingManifest.PSObject.Properties.Name -contains 'owner') -or $existingManifest.owner -cne $ownerId) {
        throw "Refusing to replace an unowned manifest: $manifestPath"
    }
}
$shell = New-Object -ComObject WScript.Shell
try {
    foreach ($linkPath in @($desktopLink, $startupLink)) {
        if (Test-Path -LiteralPath $linkPath) {
            $existingLink = $shell.CreateShortcut($linkPath)
            try {
                if ($existingLink.Description -cne $ownerId) { throw "Refusing to change an unowned shortcut: $linkPath" }
            } finally {
                [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($existingLink)
            }
        }
    }

    if ($Uninstall) {
        if ($PSCmdlet.ShouldProcess("$desktopLink; $startupLink; $manifestPath", 'Remove owned HUD shortcuts and manifest; retain browser profile')) {
            foreach ($ownedFile in @($desktopLink, $startupLink, $manifestPath)) {
                if (Test-Path -LiteralPath $ownedFile -PathType Leaf) { Remove-Item -LiteralPath $ownedFile -Force }
            }
        }
        return
    }

    $hudUrl = Get-HudUrl $ServerUrl
    $edgeExecutable = Resolve-Edge $EdgePath
    # Every dynamic argument is quoted, validated, and ends without a backslash.
    # Shortcuts invoke Edge directly: no cmd.exe, shell interpolation, or runtime script.
    $edgeArguments = '--kiosk "{0}" --edge-kiosk-type=fullscreen --no-first-run --user-data-dir="{1}"' -f $hudUrl, $profilePath
    $plan = [ordered]@{
        owner = $ownerId
        serverUrl = $hudUrl
        edgePath = $edgeExecutable
        arguments = $edgeArguments
        desktopShortcut = $desktopLink
        startupShortcut = $startupLink
        profilePath = $profilePath
        scope = 'current-user'
    }
    if ($PSCmdlet.ShouldProcess("$desktopLink; $startupLink", 'Install HUD Desktop icon and fullscreen launch at current-user sign-in')) {
        foreach ($folder in @($desktopFolder, $startupFolder, $installFolder)) {
            [void][System.IO.Directory]::CreateDirectory($folder)
        }
        foreach ($linkPath in @($desktopLink, $startupLink)) {
            $link = $shell.CreateShortcut($linkPath)
            try {
                $link.TargetPath = $edgeExecutable
                $link.Arguments = $edgeArguments
                $link.WorkingDirectory = Split-Path -Parent $edgeExecutable
                $link.Description = $ownerId
                $link.IconLocation = "$edgeExecutable,0"
                $link.WindowStyle = 1
                $link.Save()
            } finally {
                [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
            }
        }
        $plan | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    }
    [pscustomobject]$plan
} finally {
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
}
