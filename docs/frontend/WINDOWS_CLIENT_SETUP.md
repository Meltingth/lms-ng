# Windows HUD client setup

Status: client setup prepared for review; Dell deployment and installation on real client user profiles are **NOT_RUN**. The current local HUD uses simulated TEST data. This setup does not connect that build to real telemetry or change gate status.

The owner requested a Desktop icon and automatic fullscreen display when a Windows user signs in. After an authorized Dell deployment, run the installer once on each display client while signed in as the Windows user who will view the HUD. Installing on Dell alone, or merely opening the web page, cannot create shortcuts on another Windows computer.

## Install after deployment

Requirements: Windows 10/11, Microsoft Edge installed, Windows PowerShell 5.1 or PowerShell 7, and the deployed HUD URL reachable from the client. Use the organization-approved script execution process; no administrator privileges or machine-wide execution-policy change is needed. Run from the release package/repository directory containing `scripts/client/Install-HudClient.ps1`.

```powershell
# Paste the actual approved Dell HUD URL when prompted. No URL is assumed here.
$hudServerUrl = Read-Host 'Approved HUD URL (HTTP/HTTPS, including any deployment path)'

# Review the exact Desktop and Startup paths without creating files.
.\scripts\client\Install-HudClient.ps1 -ServerUrl $hudServerUrl -WhatIf

# Install for this signed-in Windows user.
.\scripts\client\Install-HudClient.ps1 -ServerUrl $hudServerUrl
```

`-ServerUrl` accepts an absolute HTTP(S) URL, including a port and path. It rejects embedded credentials, query strings, fragments, raw spaces, control characters, backslashes, and quotes. This prevents storing authentication tokens in the shortcut/configuration. No query parameter is needed for the HUD display layout. Use HTTPS and the approved deployment URL. If Edge is outside the standard installation directories, add `-EdgePath` with its absolute `msedge.exe` path.

The installer creates:

| Location | Result |
| --- | --- |
| Current user's Desktop | `LMS-NG HUD.lnk`, using the Edge application icon |
| Current user's Startup folder | `LMS-NG HUD.lnk` to open the same HUD at user sign-in |
| `%LOCALAPPDATA%\LMS-NG\HUD\client-install.json` | The selected URL, Edge executable, and owned shortcut configuration |
| `%LOCALAPPDATA%\LMS-NG\HUD\EdgeProfile` | Dedicated browser data location, created by Edge when launched |

Both shortcuts invoke Edge directly with `--kiosk "<approved-url>" --edge-kiosk-type=fullscreen --no-first-run --user-data-dir="<dedicated-profile>"`. This uses the [documented Microsoft Edge fullscreen kiosk options](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-configure-kiosk-mode). The current-user Startup folder is the [Windows-supported shortcut mechanism for sign-in startup](https://support.microsoft.com/en-US/Windows/Experience/Startup-Boot/configure-startup-applications-in-windows).

Double-click **LMS-NG HUD** on the Desktop to launch immediately. The installer itself does not launch Edge. The next Windows sign-in opens it through the Startup shortcut; this does not log a user into Windows or display before sign-in. Windows/organization startup settings can disable the shortcut and must be checked during client acceptance.

## Operation and limitations

- The page's Full Screen button is available when browsing normally. Edge kiosk startup already controls fullscreen at browser level. Its fullscreen state is independent of the page's Fullscreen API; Microsoft documents that kiosk mode blocks F11. Use **Alt+F4** to close the kiosk window.
- Edge kiosk uses **InPrivate** sessions, so persistent cookies, saved passwords, and a normal browser login session must not be assumed. Test the approved production authentication flow on the client before rollout. This installer adds no credentials and bypasses no authentication.
- The dedicated profile flag separates the HUD browser data from normal Edge use when enterprise policy permits it. An enforced [Edge UserDataDir policy overrides the command-line profile path](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/userdatadir). The deployment operator must verify that policy does not redirect the kiosk to a normal user profile.
- The client must have network connectivity and the Dell website must be available when the browser loads. There is no background readiness probe, retry supervisor, or process watchdog in this installer. If startup precedes network/server readiness, reload after connectivity returns, or close and reopen the Desktop icon. Recovery of a loaded HUD's data connection remains the application's responsibility.
- This setup does not change registry startup entries, scheduled tasks, services, auto-login, firewall, browser policy, or any backend configuration. Paths through filesystem junctions/symlinks are rejected; review redirected Desktop/Startup arrangements with the operator before installation.

## Update or remove

Run the same install command with a new approved URL to update both owned shortcuts. An unrelated shortcut or manifest using the same filename causes setup to stop before writing. The ownership marker is `LMS-NG HUD client v1`.

```powershell
# Preview removal, then remove the two owned shortcuts and configuration.
.\scripts\client\Install-HudClient.ps1 -Uninstall -WhatIf
.\scripts\client\Install-HudClient.ps1 -Uninstall
```

Uninstall leaves the browser profile and unrelated files intact and does not terminate a running browser. Close the HUD window separately. A changed or unrelated shortcut is preserved and causes an error for operator review. No recursive directory deletion occurs in the installer.

## Verification

```powershell
# Uses a new disposable TEMP fixture, including real COM-created .lnk files.
# Does not modify actual Desktop/Startup folders or start Edge.
.\tests\client\test-hud-client.ps1
```

The `-TestRoot` option is for integration tests only. It accepts an existing child directory under the current TEMP folder and redirects Desktop, Startup, and LocalAppData into that directory. `-WhatIf` creates neither directories nor files.

| Check | Status |
| --- | --- |
| 37 temporary-fixture checks: URL rejection, quoting, shortcut metadata, idempotent update, dry runs, ownership collisions, safe uninstall/profile retention | PASS on PowerShell 7.6.5 and Windows PowerShell 5.1 |
| Shortcut creation on real Desktop/Startup folders | NOT_RUN |
| Launch actual kiosk and verify fullscreen on target Windows client | NOT_RUN |
| Sign out/in and verify automatic launch on target Windows client | NOT_RUN |
| Production authentication, network readiness, policy, 1080p/4K client acceptance | NOT_RUN |
| Dell deployment | NOT_RUN |

Client acceptance after authorized deployment: verify the actual URL/authentication, launch the Desktop icon, confirm the five-lift display fits the physical screen at its Windows scaling setting, then sign out/in to verify Startup. Repeat on each display client. Local fixture checks do not approve deployment or field acceptance.
