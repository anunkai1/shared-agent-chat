# Shared Agent Chat: project plan

## Goal

A self-hosted conversation space for multiple people and their independently owned agents. Each person keeps agent execution, files and provider credentials on their own runner. Shared conversation access must not automatically authorise instructions to somebody else's agent.

This is an experimental fork of [Alook](https://github.com/alookai/alook), not an original implementation or an official Alook service. The main code remains Apache-2.0; retain applicable third-party notices.

## Intended permissions — not implemented yet

- Owner-only agent instructions by default.
- An owner can grant a specific authenticated person access to a specific agent, optionally scoped to a channel and capability set.
- Time-limited grants, such as 30 minutes, with early revocation.
- Configuration, granting further access and sensitive-action approval remain owner-only unless independently delegated.
- Another agent does not inherit a human user's grant; no unsolicited bot-to-bot work by default.
- Enforce grants in both the server and runner, including active inbox reads and follow-up instructions, not just wake events.
- Expiry/revocation rejects new requests and cancels queued delegated requests. Attempt to pause/cancel running delegated work; do not claim this can undo completed side effects or instantly stop every external process.
- Task permission is separate from access to files, tools and operating-system privileges.

## Milestones

### M0 — source and project controls

- [x] Public GitHub fork with upstream history and licence retained.
- [x] Operating notes for whoever runs an instance: [OPERATIONS.md](OPERATIONS.md).
- [x] Recorded upstream baseline and separate owner-maintained project brief.
- [x] Feature branches and required pull requests; no force pushes/deleting main.
- [x] Inherited Actions disabled pending review; no automatic deployment or package publication.
- [x] Secret scanning/push protection and private vulnerability reporting enabled.
- [ ] Complete validation and merge the bootstrap pull request.

### M1 — isolated proof of concept

- [ ] Pin and record the exact revision and dependency/runtime versions used.
- [ ] Run a disposable, restricted test environment with synthetic identities and sample files.
- [ ] Test two human accounts: invitation, shared/private channels, DMs, threads, attachments and simultaneous sessions.
- [ ] Test separately owner-bound runners: pairing, routing, disconnect/reconnect and duplicate delivery.
- [ ] Test a clean Pi profile with representative non-secret tools/commands, subject to suitable narrowly scoped authentication.
- [ ] Measure current ownership, notification, inbox and non-owner task behaviour using harmless actions.
- [ ] Exercise desktop/mobile browser layouts; distinguish emulation from genuine device/OS testing.
- [ ] Record private-control/shared-result options, runtime limitations and the changes needed for timed grants.
- [ ] Produce an evidence-based go/no-go recommendation.

M1 passes only when there is enough evidence to choose a foundation. It is not production readiness or a complete security assurance.

### M2 — permission implementation, conditional on M1

- [ ] Design grants, authenticated identity, expiry/revocation and local runner enforcement.
- [ ] Address permissive runtime launch defaults and local execution restrictions.
- [ ] Add tests for cross-owner calls, forged/stale grants, expiry, revocation, queued/running work and active inbox access.
- [ ] Test user-visible grant/revoke flows end to end before describing them as available.

### M3 — restricted pilot and deployment

- [ ] Pilot with two separately owned, restricted runners.
- [ ] Verify backup/restore and upgrades, including database migrations.
- [ ] Review production ingress, invitation policy and operational controls separately.
- [ ] Deploy only a tested revision; do not automatically follow upstream or unreviewed pull requests.

## Evaluation boundaries

- Existing privileged agent environments, production chat history and personal files are outside the trial.
- No passwordless sudo, Docker-host socket, SSH-agent forwarding or broad host/auth-directory mounts inside test runners.
- Source and example configuration may be public. Runtime databases, account secrets, auth tokens, private infrastructure and unsanitised evidence must not be committed.
- Durable secrets belong to the deployment owner's canonical secret system, supplied only through narrow runtime interfaces. Do not expose secrets in commands, logs, browser captures or public issues.
- No purchases or new paid subscriptions are part of the trial.
- Unavailable account consent, MFA, friend-device access and actual-device testing are recorded as blocked/untested, not bypassed.
- Record whether a result comes from source inspection, a mock, browser emulation or a real end-to-end test.
- Do not assume that a runner is safe from a malicious hosting operator. Establish that boundary explicitly if required.

## Success criteria

The application is a worthwhile foundation if self-hosting is reproducible, independently owned runners work, core Pi workflows are usable, and the required permission boundary can be implemented without replacing most of the platform. Otherwise recommend a different foundation rather than forcing the fork to fit.
