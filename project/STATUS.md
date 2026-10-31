# Project status

Status date: 31/10/2026. **Useful foundation; not ready for a real-agent pilot.**

## Current phase

The isolated evaluation supports continuing with Alook. M2 permissions are **incomplete**, not
“server side complete”. A scoped review found bypasses in single-message reads, attachments and quoted
content, plus grant/reconnect defects and missing runner revocation controls. Server hardening and the
first runner-side authority enforcement are now covered by targeted regressions, but a fresh-image live
verification of these changes remains outstanding — including any real runtime being interrupted.
M3 pilot/deployment has not started.

The review covered fork changes and relevant callers, not all inherited code, host security, every
adapter or dependency exploitability. It was not an independent second-person review or penetration test.

## Source and project controls

- Fork: https://github.com/anunkai1/shared-agent-chat; upstream `alookai/alook`.
- Baseline: `4a324e5796bf33ef4822e4053bd222735580aefa`; Apache-2.0 history/licence retained.
- Main requires PRs, including administrators; force-push/deletion disabled. There is no required
  second reviewer. Historical self-merges are not independent approval.
- Inherited Actions remain disabled; no automatic publication or deployment.
- Secret scanning/push protection/private vulnerability reporting are enabled, not proof of safety.
- Privileged personal agent environments remain separate from evaluation runners.

## Historical evaluation — do not extrapolate to the current build

Initial image/source baseline: `09947e71fa78a67ffc5fa9e6319653aef33d1564`. Later protocol runs used
modified-source overlays in that older image. Their stored source label was not an exact identity of
the overlaid code; they are not fresh-image verification of the final merged changes.

| Evidence | Method and limit |
|---|---|
| Restricted self-hosted instance; synthetic users exchange channel/thread messages; author spoof rejected; nonce retries deduplicate. | Real HTTP, 28 initial human checks; selected browser flows. |
| Private membership/read/post/upload boundaries; cross-owner machine/bot create/config/reset/delete boundaries; single-use pairing and credential revocation. | Real HTTP/WS protocol fixtures, including 23 initial runner checks. No model/tools in fixtures. |
| Sessions/history survive same-container restart; selected desktop/phone-size flows work. | Browser emulation, not physical devices; not all navigation attempts passed. A dedicated private-content WS exclusion run was not demonstrated. |
| One actual Pi 1.4.0 daemon/adapter run used a clean profile, read a sample file, ran bash, loaded a custom extension tool, published a result through the credential proxy and retained context on a follow-up. | Real model/tool execution, 11 checks, **with the harness handshake timeout raised to 600 seconds**. It preceded the readiness fix. Slash-command and other real adapters were not tested. |
| SDK readiness fix `94d9100`: initialise at SDK send admission rather than first model output. | Focused host/logical-session tests, 154 passing. No genuine post-fix/default-timeout model rerun was demonstrated. |
| Grants allow a named person, optional channel, expiry and early revoke; selected wake/inbox/history/marks paths were checked. | 37 live protocol fixture checks. Did **not** establish expired-grant read withholding, single resolve, attachment revoke, nested quote filtering or runner cancellation. |
| A D1 snapshot was restored twice using the same old image. | First compared counts/ledger; second checked users only. No uploaded-object/key recovery, newer-build migration upgrade or rollback proof. |

## Server hardening in this change

- Bot message projection requires an explicit policy; missing/unowned policies fail closed without
  removing the owner-only-page optimisation that avoids unnecessary grant queries.
- Single-message resolve applies the same policy as inbox/history/marks.
- Enriched history checks quoted authors independently, including targets outside the current page;
  unprovenanced embeds/thread previews are omitted.
- Shared attachment SQL checks bot authority for associated messages as well as membership, covering
  downloads, thumbnails and file reuse in outgoing messages. Active uploaders retain their own uploads.
- Covered bot identity/policy reads use primary-consistent D1 sessions. No remote replica-lag experiment
  has been run; session selection has regression coverage.
- Strict request schemas reject malformed scopes/bodies/durations instead of broadening access.
  Grant listing reports `live`; the misleading scope-independent `effective` flag was removed.
- Reconnect filters authorised candidates **before** selecting the newest unread, so a newer stranger
  or expired grantee does not hide older owner work.

New tests include real SQLite queries, real route/projector combinations with synthetic identity/DB
fixtures, pure-policy tests and request/handler tests. None is a live deployment or real-model rerun.
See the change's verification record for exact revision/tree/lockfile identity, commands and outcomes.

## Runner authority in this change

- `agent:wake` carries the initiating message, author, channel and either the owner or the exact grant.
  The daemon refuses a wake with no provenance, or one the server will not confirm, before creating a
  session.
- A daemon-authenticated route rechecks the source against the real message, the bot's machine/owner
  binding, its readability of the channel and (for delegated work) the same live grant id. Answers are
  short leases; only positive decisions are cached, only for about a second, and any authority-change
  nudge drops them.
- The driver authorises at root admission, again before the physical lane starts, and at every
  safe-boundary/steering delivery, with a periodic sweep over queued, steering and running work.
- Revoked queued work fails with `task_authority_revoked`; a running delegated turn is interrupted once.
  Owner work is not dropped, interrupted or requeued, and delegated text is never merged or steered into
  an owner turn.
- Revocation nudges the owning machine (`agent:authority_changed`). A disconnected runner converges on
  reconnect or its own revalidation, not instantly; interruption is best effort at a boundary and does
  not undo completed effects.

Coverage is unit and fixture level: real SQLite/route handler tests, injected-fetch client tests, and
fake-lane driver/manager tests that drive the real admission, queue and interrupt code paths. No live
server, model or runtime was interrupted end to end.

## Verification limits

The earlier package run covered shared, web-node, agent-driver and daemon **unit** tests; daemon packed
version/bundle/self-update tests were excluded. It was not a complete root-suite pass. The old dependency
count and test counts are historical snapshots, not current security/build status.

Current checks and their failures are recorded in [VERIFICATION.md](VERIFICATION.md). A passing focused
suite does not erase a root-suite failure. An environment repair or isolated retry must be labelled as
such, not silently substituted for the failed run.

## Remaining gates

1. **Runner authority evidence:** the logic exists and is unit/fixture tested, but no live runtime has
   been revoked mid-turn. End-to-end interruption, reconnect convergence after a missed nudge, and the
   idle-session ambient-authority surface all still need real evidence. Already delivered bytes and
   completed side effects cannot be recalled.
2. Honest-server runner enforcement is separate from malicious-server resistance. Signatures are not
   inherently necessary for the former; no independent trust-root guarantee exists for the latter.
3. Grant-management UI, safer runtime launch defaults and independently restricted runners. Claude/Codex
   still request approval-bypass/full-access modes; prompts encourage unsolicited continuation.
4. Exact-revision fresh-image HTTP/WS checks, including revoked/expired reads, known attachment IDs,
   nested quotes and reconnect; then end-to-end runner cancellation evidence.
5. Complete root/packed/runtime gates, remaining dependency advisories and local SQLite contention.
   DOM tests need test-mode React, and process tests need reliable child reaping. Neither is permission
   to suppress failing tests.
6. Full object/key/database recovery, attachment-byte canaries, a real newer-build upgrade and a
   separate rollback test. Stronger fingerprint helpers alone do not establish these journeys.
7. Independent review, two actual people, separately owned restricted runners, Windows and physical-device
   coverage; separately approved ingress/TLS/auth/invitation/rate-limit policy before deployment.

No production route or real-agent pilot is authorised by these implementation results.
