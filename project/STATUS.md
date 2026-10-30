# Project status

Status date: 30/10/2026.

## Current phase

M0: source/project controls. The isolated runtime evaluation has not started. No timed-grant feature has been implemented.

## Verified setup

- Public repository: https://github.com/anunkai1/shared-agent-chat
- GitHub fork parent: alookai/alook.
- Upstream baseline: `4a324e5796bf33ef4822e4053bd222735580aefa`.
- Apache-2.0 licence and upstream history retained.
- main requires pull requests, including for administrators; force pushes and branch deletion are disabled. There is no second-reviewer requirement for this initial single-maintainer project.
- GitHub Actions are disabled while inherited workflows are reviewed. There is no configured automatic deployment.
- GitHub secret scanning, push protection and private vulnerability reporting are enabled. These are safeguards, not proof that all sensitive material is detected.
- Repository owners are this fork's maintainers, not the upstream CODEOWNERS team.

## Findings carried into the evaluation

Source inspection found owner-scoped bot configuration routes, but the inspected message/wake path does not establish owner-only task authorisation. Notification eligibility is not equivalent to task permission.

The inherited Claude and Codex adapters request permissive execution/approval modes. Trial execution must be independently restricted; source code is not a safe default configuration merely because it is open source.

The Pi SDK adapter exists. Compatibility with a particular extension set and authentication arrangement remains untested. Gemini CLI compatibility is unverified.

## Evidence still required

All M1 checklist items in [PLAN.md](PLAN.md): runtime startup, two-user flows, separate runner routing, permission baseline, Pi functionality, reconnect behaviour and browser usability. No source-inspection finding should be reported as a successful end-to-end test.

## Next action

Validate and merge this bootstrap, then prepare the restricted test environment. Keep private host configuration and raw operational evidence outside this public repository.
