# Connect the LMS-NG TEST machine to Codex

Prepared 4 October 2026. This is a TEST-host setup guide, not authorization to deploy on Dell or change the live Gateway. The owner has authorized coordination with the future TEST session. That session must first become visible through a connected host/project; merely installing a second app does not connect its tasks to this chat.

## Minimum owner preparation

1. Identify the operating system and hostname. Confirm this is the separate TEST machine, not the Capture/Gateway machine or an existing production database host.
2. Keep the machine powered and reachable. Use an ordinary dedicated development account; administrative elevation is only needed for specific installations/configuration the operator approves.
3. Install/sign in to the current OpenAI desktop app with Codex access if using the desktop route. Use the same ChatGPT account and workspace as the controlling machine.
4. Install Git and provide repository access using the normal Git credential manager. For this repository the Node engine requirement is at least 22.12; match the tested repository toolchain rather than upgrading dependencies. Python 3 is needed for the offline SQL-bundle generator. The remote agent can inspect/install missing project tools after connection.
5. Do not install all backend services speculatively. First connect Codex and inventory the host. PostgreSQL 16 in a disposable TEST database is the first database prerequisite; Redis/MQTT/API settings follow the reviewed implementation plan.

## Windows PC / desktop Remote route

On the TEST host, open **Settings > Connections > Control this PC**, choose **Set up/Add**, and complete the app's pairing/security flow. On the controlling computer use **Settings > Connections > Control other devices** to add the host where this feature is available. Use the host's keep-awake option where available.

Open/add the LMS-NG repository as a project on the TEST host. Give the host a recognizable TEST label. The app must be running and online. If desktop UI automation is needed later, the Windows user session must be available for it.

Menu labels and availability can differ by app rollout. Follow the current [official Remote connections guide](https://learn.chatgpt.com/docs/remote-connections); the guide documents Windows/Mac host pairing, desktop-to-desktop access and SSH alternatives. This guide does not assert that the feature is enabled for this account. At preparation time this conversation could see only local projects.

## SSH route for a server or when desktop pairing is unavailable

Configure authenticated SSH using a normal dedicated account and trusted key. Confirm `ssh <your-test-host-alias>` works from the controlling computer before adding it to Codex. On the TEST host install and authenticate Codex CLI and confirm `codex` is on the remote login shell's PATH. In the controlling app use **Settings > Connections > SSH**, add/enable the host and select its repository folder.

The official guide describes concrete aliases in the controlling user's SSH config and starting the remote Codex app server through SSH. It advises using a VPN/private route when needed and not exposing the app-server transport directly. See [official SSH setup](https://learn.chatgpt.com/docs/remote-connections#connect-to-an-ssh-host).

No SSH hostname, firewall rule or account is configured by this document. Once the OS is supplied, provide OS-specific steps; do not run Linux installation commands blindly on Windows Server or assume that RDP alone connects Codex sessions.

## Repository setup after host connection

Use a fresh TEST development checkout, not the Dell production runtime folders. Select an appropriate development directory explicitly. The commands below are repository operations; run the clone only when the intended new directory does not already contain work:

```text
git clone --branch codex/frontend-hud https://github.com/Meltingth/lms-ng.git <new-test-checkout>
```

Open that directory as the remote project. The first remote task must read its `AGENTS.md`, verify hostname/root/origin/branch/HEAD/status, and record TEST/DEV role. Do not check out main and begin editing. The controller and remote implementation task should use separate branches/worktrees and exchange pinned commits through GitHub.

The user can create a task named **LMS-NG TEST bootstrap** on that host and provide this initial instruction:

> Read AGENTS.md. This is the separate LMS-NG TEST machine. Start with read-only inventory: hostname/OS, repository root/origin/branch/SHA/status, Git/Node/Python/psql/Docker availability, running PostgreSQL/Redis/MQTT services, CPU/RAM/free disk and network identity. Do not install, migrate, deploy, open COM, change Capture/Scheduled Tasks or modify Contracts yet. Report non-secret findings and the exact host/project identity so the coordinating task can send the reviewed next step.

Once the host/project/task is visible to the controller, it can send scoped work using the owner's authorization and read returned results. Cross-device task visibility and tools must be verified; a shared account by itself is not proof that this session can reach the other host. No remote task has yet been created or contacted by this guide.

## Completion check

- The controlling app displays the TEST host as connected and its LMS-NG project/task is discoverable.
- A read-only remote command reports the TEST hostname, not the current development laptop.
- The repository origin is `https://github.com/Meltingth/lms-ng.git`; its exact SHA is reported.
- TEST host is confirmed separate from live Capture/Gateway; database targets and permissions are explicit.
- Authentication stays in the app/Git/SSH or approved local secret configuration. Do not put passwords, private keys or tokens in messages, repository files or evidence.

After this check, proceed with a specific TEST bootstrap plan. Physical lift integration and deployment remain separate gated actions.
