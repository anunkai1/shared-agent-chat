# Shared Agent Chat: project plan

## Goal

A self-hosted conversation space for multiple people and their independently owned agents. Each person keeps agent execution, files and provider credentials on their own runner. Shared conversation access must not automatically authorise instructions to somebody else's agent.

This is an experimental fork of [Alook](https://github.com/alookai/alook), not an original implementation or an official Alook service. The main code remains Apache-2.0; retain applicable third-party notices.

## Intended permissions — partially implemented

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
- [x] Complete validation and merge the bootstrap pull request (PR #1).

### M1 — isolated proof of concept — complete

- [x] Pin and record the exact revision and dependency/runtime versions used.
- [x] Run a disposable, restricted test environment with synthetic identities and sample files.
- [x] Test two human accounts: invitation, shared/private channels, DMs, threads, attachments and simultaneous sessions.
- [x] Test separately owner-bound runners: pairing, routing and credential revocation. Reconnect and duplicate-delivery behaviour is covered by the project's own suites rather than by hand.
- [x] Test a clean Pi profile: Pi 1.4.0 through the unmodified adapter, a sample-file tool action, a custom extension tool, and publication back through the credential proxy.
- [x] Measure ownership, notification, inbox and non-owner task behaviour using harmless actions. A non-owner message woke and fed another owner's bot; muting was not authorisation.
- [x] Exercise desktop and phone-sized browser layouts. Emulation, not physical devices.
- [x] Record runtime limitations and the changes needed: the authority model, and a readiness signal for slow runtimes.
- [x] Produce an evidence-based go/no-go recommendation: **go**, to build on it.

M1 passes only when there is enough evidence to choose a foundation. It is not production readiness or a complete security assurance.

### M2 — permission implementation — incomplete

- [x] Implement owner/live-grant predicates, schema and owner-only grant APIs.
- [x] Add mandatory policies to covered bot projections, independently filter enriched quotes, and check bot attachment reads/reuse against authorised message associations.
- [x] Strict grant scope/duration validation, explicit grant liveness and primary-consistent covered identity/policy reads.
- [x] Add regression tests for missing/ownerless policies, single-message reads, quotes, attachment revoke/expiry, malformed grants and authorised reconnect selection.
- [ ] Verify the changed revision through a fresh-image live protocol run. Historical 37/37 fixtures did not cover all bypasses or runner cancellation and used a source overlay on an older image.
- [ ] Grant/revoke user interface. The owner-only API exists; the interface is not built.
- [x] Runner admission and queued-work revalidation preserving author/grant/expiry provenance: task source on every wake, server recheck with short leases, driver-level authorization at admission, safe boundary and on a periodic sweep. Honest-server enforcement only; malicious-server resistance is a separate design.
- [x] Selective queued/running delegated-work cancellation on revoke/expiry preserving owner work: revoked queued work fails as `task_authority_revoked`, one best-effort interrupt for a running delegated turn, owner work untouched, revoke nudges the owning machine. Unit/fixture coverage only — no live runtime interrupted yet.
- [ ] Address permissive runtime launch defaults (Claude/Codex approval bypass) and local execution restrictions for runners.

### M3 — restricted pilot and deployment

- [ ] Pilot with two separately owned, restricted runners.
- [ ] Full recovery: database, uploaded objects, key versions and attachment-byte canaries. Earlier checks restored only D1; strengthened selected-table fingerprint helpers still need a full live restore run.
- [ ] Upgrade to a newer pinned build with migration/content checks on restored state.
- [ ] Separate rollback verification; restoring the same old image twice is not an upgrade/rollback test.
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
