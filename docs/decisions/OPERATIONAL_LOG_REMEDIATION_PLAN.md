---
docType: REMEDIATION_PLAN
status: PROPOSED_NOT_EXECUTED
appliesTo: "D:\\WhizdomLift capture_lift_1.log, capture_lift_2.log, capture_lift_2_before_gnd_fix.log, capture_lift_2_uncontrolled.log, capture_lift_3.log, capture_lift_3_part1.log, capture_lift_5.log, capture_launcher.log"
preparedAt: 2026-09-13
---

# Operational log remediation plan — proposal only, nothing executed

This is a plan for a **future, safe phase**. Nothing in this document has been carried out.
Per the owner's decision this round: no history rewrite now, `user=Administrator` alone is not
grounds for one, no future growth of these files gets committed/pushed, and no local file the
logger or any analysis tool is using gets deleted. If a real credential or personal identifier
is found in these files at any point, this plan stops and that becomes its own security
decision — this plan does not cover that case.

## The conflict this plan resolves

Two of the owner's own standing instructions currently point opposite directions:

- WhizdomLift `CLAUDE.md` §10, reaffirmed 13 Sep 2026: *"งานนี้ไม่มีความลับ... ห้ามเพิ่มของที่เป็นงานลง
  `.gitignore`"* — commit and push everything, including logs, always, without being asked.
- LMS-NG Revised Execution Pack, same day: R17 — *"ห้าม publish raw logs/secrets/config ลูกค้าสู่
  public repo"* — do not auto-publish raw operational logs to the public repo.

This plan does not decide which standing rule wins going forward — only the owner can settle
that. It gives a mechanism that satisfies **either** answer once chosen: it stops future log
bytes from reaching the public remote without deleting anything or rewriting anything that is
already there.

## Step 1 — untrack from the Git index without touching the files on disk

```
git rm --cached capture_lift_1.log capture_lift_2.log capture_lift_2_before_gnd_fix.log \
                capture_lift_2_uncontrolled.log capture_lift_3.log capture_lift_3_part1.log \
                capture_lift_5.log capture_launcher.log
```

`git rm --cached` removes a path from Git's index (what gets committed next) while leaving the
actual file on disk completely untouched — no file handle is closed, no bytes are deleted, no
process holding the file open is affected in any way. This is the mechanism, not a proposal to
delete anything.

## Step 2 — add ignore rules

Add the eight filenames (or a pattern covering them, e.g. `capture_lift_*.log` and
`capture_launcher.log`) to `.gitignore`. This is the same *mechanism* the repo already uses for
`STOP_CAPTURE` and `capture_lift_*.pid` — an ignore rule that keeps a live operational file out
of the index without touching its content.

## Step 3 — preserve logger/analysis compatibility (verified, not assumed)

`log_lift.py`, `capture_status.py`, `lift_health.py`, `trips.py`, `audit.py`, and every other
tool that reads or writes these files does so by **file path**, opened directly against the
filesystem — none of them query Git, check tracked/untracked status, or behave differently
based on whether a path is in the index. Untracking a file changes nothing about how any running
process interacts with it. This is confirmed by the tools' own documented behavior in
CLAUDE.md (`log_lift.py` opens its target path directly with `dtr=False, rts=False`;
`capture_status.py` reads the file and the process table, "ไม่แตะพอร์ตเลย") — none of that
description involves Git at any point.

## Step 4 — replace long-lived logs in source control with sanitized, deterministic fixtures

Where the project wants a *committed* example of real capture-log shape for documentation or
onboarding (distinct from the *live, growing, operational* files Step 1/2 stop tracking), the
existing `contracts/mqtt/examples/*.json` and `contracts/fixtures/{valid,invalid}/*.json`
pattern already demonstrates the right shape: small, hand-authored, `TEST`-tagged, deterministic
files that show the format without being a slice of real building operational history. A
WhizdomLift-side equivalent (e.g. `docs/examples/capture_line_format_sample.log`, a handful of
synthetic `ST <ms> <mask>` lines with a made-up `board_ms` sequence) would serve the same
documentation purpose the current huge tracked logs incidentally serve, without carrying live
operational volume. This is a proposal for what such a fixture would look like, not a fixture
created by this round.

## What this plan explicitly does not do

- Does not delete `capture_lift_*.log` or `capture_launcher.log` from disk, at any step.
- Does not touch `vendor/`, `capture_lift_*.pid`, `STOP_CAPTURE`, or any other file's tracked
  status.
- Does not rewrite any existing Git commit or force-push anything.
- Does not execute Steps 1-2 — they are described so a future, explicitly-authorized session
  can run them in one pass, not so this session runs them now.

## Escalation rule this plan carries forward

If a future inspection (this session's own §5 scan, a later one, or the owner's own review)
finds an actual credential, private key, or personal identifier beyond the generic
`user=Administrator` account name already reviewed and accepted as low-sensitivity — stop
immediately, do not proceed with any part of this plan or any related git operation, and raise
it as its own, separate security decision rather than folding it into this remediation.
