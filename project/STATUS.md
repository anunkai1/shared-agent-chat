# Project status

Status date: 30/10/2026. Evaluation revision: `09947e71fa78a67ffc5fa9e6319653aef33d1564`.

## Current phase

M1 (isolated proof of concept) is **partly complete**, and M2 has started: **owner-only task authority
is now implemented on the server** (see below). Delegated, expiring grants — the rest of M2 — are still
planned, not implemented.

Labels used below: **API** — real HTTP with synthetic authenticated accounts; **WS** — real
WebSocket control plane; **fixture** — a protocol-level machine client that speaks the real
protocol but runs no model or tools; **real runner** — the actual daemon, the unmodified Pi adapter,
Pi SDK 1.4.0, a real model and real tool calls. Only the last row is end-to-end runtime evidence.

## Verified setup

- Public repository: https://github.com/anunkai1/shared-agent-chat (fork of `alookai/alook`).
- Upstream baseline: `4a324e5796bf33ef4822e4053bd222735580aefa`; Apache-2.0 licence and history retained.
- `main` requires pull requests including for administrators; force pushes and deletion are disabled.
  There is no second-reviewer requirement for this single-maintainer project.
- GitHub Actions remain disabled pending review of inherited workflows; there is no automatic
  deployment or package publication.
- Secret scanning, push protection and private vulnerability reporting are enabled. These are
  safeguards, not proof that all sensitive material is detected.

## Evaluation results

### What works

| Result | Method |
|---|---|
| Self-hosted instance starts from a source-pinned build in a restricted container, with no host ports published. | runtime |
| Two synthetic users exchange messages in a shared channel and a thread; authors are recorded correctly; a retry with the same nonce does not duplicate a message. | API, browser |
| A client-supplied `authorId` cannot impersonate another user. | API |
| Private-channel messages, posting and member listing are denied to a non-member, the channel is absent from their directory, and its content never reaches their WebSocket. | API, WS |
| A bot without private-channel membership cannot read that channel. | fixture |
| Cross-owner isolation of machines and bots holds: another user cannot create a bot on someone's machine, reconfigure it, reset its session or delete the machine; a machine credential cannot enrol another owner's bot; a reset reaches only the intended machine. | API, WS, fixture |
| Pairing tokens are single-use, and a revoked machine credential is refused afterwards. | API, fixture |
| Chat sessions and message history survive a restart of the instance. | runtime |
| Desktop and phone-sized layouts are usable; this was browser emulation, not physical-device testing. | browser |
| A real runner detects the installed Pi 1.4.0, reports it healthy, connects, pairs a machine, enrols a bot and joins a room using a clean profile with no personal credentials. | real runner |
| A real model, driven by the real chat message, reads a sample file with Pi's tool suite and runs a harmless command in a disposable workspace. | real runner |
| A user-installed extension loads, and its custom tool is called by the model. | real runner |
| The agent publishes its result back to the channel itself, through the daemon's real credential proxy — it holds a per-launch voucher, not the machine key. | real runner |
| A second chat message in the same session is handled without a respawn, and the agent remembers earlier context. | real runner |
| Stopping the daemon waits for the session to close, and revoking the machine removes its bot and refuses the credential. | real runner |

### Owner authority — implemented, unit-verified

One predicate decides who may cause a bot to run work: `hasTaskAuthority` in
`src/shared/src/community/task-authority.ts`. Three gates call it, so the rule cannot drift between
them:

| Gate | Behaviour |
|---|---|
| Wake production | an unread from a non-owner never produces an `agent:wake` (`no_task_authority`) |
| Inbox pull | the message and sender stay visible; text, attachments and reply quotes are withheld |
| Channel history (bot reads) | same withholding, so re-reading a room is not a way around the inbox |

An ownerless bot wakes for nobody. Covered by unit tests — `hasTaskAuthority` itself, the wake gate,
and `toAgentMessages` withholding — and the shared suite is 2,482 tests green with `tsc` clean.
**Not yet re-verified end-to-end** against a running instance; that is the next check.

### What does not work yet

| Result | Method |
|---|---|
| There is no delegated access: a second person cannot be granted authority even temporarily, and there is nothing to expire or revoke. | by construction |
| The runner trusts the server's decision. A compromised or malicious server could still deliver text the runner would act on. | source inspection |
| A slow model's first turn is aborted unless the daemon's startup watchdog is raised — **fixed** in `94d9100`, where the SDK lane now reports readiness when it opens rather than when the model first speaks. | real runner |
| The local development stack returns intermittent HTTP 500/503 from SQLite contention, so some test steps need retries. | API |

The first row is the remaining product gap. Rows two and four are honest limits, not defects.

## Known risks carried into any decision

- The Claude and Codex adapters request approval-bypass and full-access execution modes. Open source
  is not a safe default configuration; runner containment must be independent.
- The system prompt encourages an agent to continue work without an explicit request, which is the
  opposite of the intended default.
- Production dependency audit reports 1 critical, 15 high, 25 moderate and 8 low findings. One
  critical advisory is confirmed on an installed path (`@streamdown/mermaid` → `mermaid` →
  `dompurify@3.4.16`, patched in 3.4.17). Applicability depends on specific features; exploitability
  in this application has **not** been demonstrated. `proxy-addr` is 2.0.8 on the traced production
  path.
- An earlier version of this file described `proxy-addr` as a runtime-critical alert. That claim was
  too strong for the traced path and has been corrected.

## Test gates

- `pnpm typecheck`: **passes**.
- Shared-package tests: **pass** (2,472).
- Root `pnpm test`: **fails** (exit 1). WebSocket and shared suites pass; daemon lifecycle/update,
  repository invocation-contract, daemon creation and PII tests fail. Some PII failures pass in
  isolation, so at least part is suite ordering rather than a proven upstream defect.
- Lint: **not run**.
- A failing suite is recorded as a failing gate, not a passing one.

## Not established

- No full security audit, no independent review, no penetration test.
- No physical phone, tablet or Windows-device testing; no genuine second-person onboarding.
- No test of resistance to a malicious hosting operator.
- Nothing here shows that a model would refuse an instruction it is technically able to receive.

## Next action

Decide whether to fund M2 — server-side grants plus runner-side enforcement, revocation that also
covers queued and running delegated work, and a readiness signal that works for slow runtimes — or
to compare an alternative foundation first. No production route, no real agents and no personal
credentials will be attached before that decision.
