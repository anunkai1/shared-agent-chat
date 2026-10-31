# Runner task-authority verification — 31/10/2026

## Identity and method

- Parent main: `7a7ebdeb9a69e2eb269a069ad89bb727b5aa4489`.
- Application code commit: `15f3d44ce21021e19055dc9dc2ca92422b953b8e`
  (tree `a44ea2ab68080b6226bd3b6ed2ac8399d676b645`).
- `pnpm-lock.yaml` unchanged (SHA-256 `8ee696b72e515fd702e2fa039d0149f1f6886b9b4c3b6ca9a31671fe8f330302`).
- Node **24.22.1**, pnpm **10.33.0**; packed daemon checks used Bun **1.3.11** from the existing
  isolated test image via ignored test-tool storage.
- **No fresh image, live HTTP/WS run, real model run, real runtime interruption, deployment or host
  wake.** All results below are source/package checks, real SQLite and route-handler fixtures, an
  injected-fetch client, and driver/manager tests over controllable non-model lanes.

## Results

Test runs use `NODE_ENV=test`; typecheck adds `--use-openssl-ca --max-old-space-size=4096 --force`.

| Scope | Result |
|---|---|
| `pnpm typecheck --force` | **10/10 tasks, 0 cached** |
| `pnpm lint` | **0 errors**, 1 pre-existing Tailwind warning (`bot-audit-preview.tsx:103`) |
| Shared (`vitest run`) | **190 files / 2,548 tests pass** |
| Web (`vitest run`) | **617 files / 7,147 tests pass** |
| Daemon (`test:unit` + `test:packed`) | **72 files / 1,753 pass**, plus **3 packed files / 7 pass** |
| Agent driver | **62 files / 1,153 pass, 30 skipped** |
| ws-do | **33 files / 584 pass** |

The pre-commit hook was skipped, and this is why: it runs the root suite under the inherited
`NODE_ENV=production`, where `src/daemon/src/cli/daemonStart.lifecycle.test.ts` →
“persists the rotated epoch offline after local start failure…” times out at 10 s. That failure
reproduces on the pristine parent tree (verified by stashing this change), so it predates it and is
**not** claimed as fixed or explained. No root aggregate `pnpm test` pass exists for this revision.

New coverage in this change:

- Pure provenance policy: owner vs exact live grant; revoked/expired/wrong-channel/foreign-issuer
  refusals; ownerless bots; strict schema fields.
- Server recheck (`checkTaskSource`) over a mocked query boundary: bot/machine/owner binding, real
  message author and channel, readability, grant revocation/expiry/replacement, expiry drift.
- Daemon client over an injected `fetch`: lease re-asking after TTL, missed-answer epoch race,
  transport failure refusal, principal/source mismatch, proxy header narrowing, mixed-principal refusal.
- Real daemon wake path: a wake with no provenance and a wake the server refuses both ack
  `task_authority_revoked` and create no session. The 22 existing wake fixtures now carry provenance.
- Driver: refused root admission (lane never started, session released), cross-principal queueing
  instead of steering, revoked queued work failing as `task_authority_revoked` while the owner turn
  and its queued work continue, one interrupt for a running delegated turn, active-task publication.
- Manager: revoked inbox entry dropped without touching the owner's running turn; a revoked delivery
  settles as cancelled instead of stopping the session; an ordinary delivery failure still stops it.
- ws-do: the `agent:authority_changed` nudge forwards only an agent id and rejects extra/missing fields.
- Web: revoke nudges the owning machine and reports `runnerNotified` honestly when the daemon is
  offline or the push throws; the daemon authority route validates strictly and passes refusals through.

## Not verified or not implemented

No live revocation mid-turn, no real reconnect-after-missed-nudge evidence, no measurement of the
idle-session ambient-authority surface, no signature/trust-root against a lying server. Grant UI,
safer runtime launch defaults, exact-build live protocol checks, full object/key recovery and
application upgrade/rollback remain open.

# Permission-hardening verification — 31/10/2026

## Identity and method

- Parent main: `025e7a2907f4d2846e2b01ccdcc350ec91a80970`.
- Final application code commit: `3559a4172ac7a787ea94ca5c5d1430606e8a43ff`.
- That commit's Git tree: `1863fb0112c3d242554a580af53a35b7c9b19715`.
- `pnpm-lock.yaml` SHA-256: `8ee696b72e515fd702e2fa039d0149f1f6886b9b4c3b6ca9a31671fe8f330302` (unchanged).
- Host checks: Linux, Node **24.22.1**, pnpm **10.33.0**. Packed daemon checks additionally used Bun
  **1.3.11**, extracted from the existing isolated test image into ignored test-tool storage, not
  installed into a personal runner.
- **No freshly rebuilt application image, live HTTP/WS rerun, new real-model run, deployment or host
  wake.** These are source/package checks, real SQLite fixtures and mocked-boundary route tests.
- Broad checks ran while remediation was being developed. Final targeted regressions ran after the
  behavioural changes; the broad web run discovered files before the final enriched-history route
  regression was added. Do not describe every broad result as a run of the exact final tree.
- Raw logs and synthetic runtime evidence remain private; no credentials or raw captures accompany
  this record. Subsequent documentation-only commits do not change the code revision above.

## Results

All commands are from the repository root. Successful test runs use `NODE_ENV=test`; typecheck used
`NODE_OPTIONS="--use-openssl-ca --max-old-space-size=4096"` and `--force` to avoid cached results.

| Command / scope | Result | Important qualification |
|---|---|---|
| `pnpm typecheck --force` | **10/10 tasks pass, 0 cached** | Initial attempt exhausted a 2 GB V8 heap; the successful fresh run used 4 GB. |
| `pnpm lint` | **0 errors, 1 existing Tailwind warning** | Four lint tasks; three unchanged-package cache hits. Changed web files and final new route tests also linted directly, with no errors. Shared has no lint script. |
| Shared tests (`vitest run` in shared; also completed in corrected root attempt) | **188 files / 2,522 tests pass** | Includes real SQLite attachment/reconnect queries and explicit-policy/schema regressions. |
| `pnpm --filter @alook/web test` | **1,067 files / 12,347 tests pass** | Test-mode web-node, DOM, auth and runtime workspace; before final history-route regression file. A previous production-mode run failed extensively, including unavailable React `act`; it is not counted as a pass. |
| Final targeted web-node regressions | **14 files / 247 tests pass** | Includes the final actual history/resolve route-plus-policy/projector regressions and owner positive controls. Commands/files below. |
| `pnpm --filter @alook/agent-driver test` | **62 files pass, 2 skipped; 1,149 tests pass, 30 skipped** | Source/package tests; not genuine provider/model execution. |
| `pnpm --filter @alook/daemon test:packed` | **3 files / 7 tests pass** | Packed version, agent-driver bundle isolation and real local self-update handoff/rollback fixtures; not an application database upgrade/rollback. |
| `vitest run --project ci-scripts` | **44 files / 590 tests pass, 10 skipped** | Local script/provenance contracts; not enabling inherited Actions. |
| Root `pnpm test` (corrected to test mode) | **FAIL, exit 1** | Daemon lifecycle test `keeps ownership until a timed-out child has actually exited` times out under the combined run. Turbo then cancels web; later root stages do not run. Individual passes must not be substituted for this failed aggregate gate. |
| `pnpm --filter @alook/daemon test:unit` run separately after the root attempt | **71 files / 1,739 tests pass** | Final code commit; packed files excluded by this command and covered separately above. The lifecycle file also passed 10/10 in a separate targeted run. Neither pass explains away the combined-run failure; no product lifecycle change made. |
| Other packages completed in the corrected root attempt | **test-utils 15; app 80; email-worker 72; queue-worker 97; ws-do 590 pass** | A subset of the root command; not a complete root pass. |

Private recovery helper checks separately pass shell/JavaScript/Python syntax and **four real SQLite
helper tests** for selected-table fingerprints and repeat file restores. The modified live D1 restore
journey and expanded protocol harness have not run. No uploaded-object/key recovery is established.

## Focused regression command

```sh
NODE_ENV=test pnpm exec vitest run --project web-node --maxWorkers=4 \
  'src/web/src/app/api/community/channels/[id]/messages/route.authority.test.ts' \
  'src/web/src/app/api/community/messages/[id]/route.authority.test.ts' \
  'src/web/src/app/api/community/bots/[id]/grants/route.test.ts' \
  'src/web/src/lib/community/bot-message-policy.test.ts' \
  'src/web/src/app/api/community/messages/[id]/route.test.ts' \
  'src/web/src/app/api/community/users/me/marks/route.test.ts' \
  'src/web/src/app/api/community/users/me/inbox/pull/route.test.ts' \
  'src/web/src/app/api/community/channels/[id]/messages/route.test.ts' \
  'src/web/src/app/api/community/channels/[id]/attachments/[attachmentId]/route.test.ts' \
  'src/web/src/app/api/community/channels/[id]/attachments/[attachmentId]/thumbnail/route.test.ts' \
  'src/web/src/app/api/community/daemon/resync-wakes/route.test.ts' \
  'src/web/src/lib/db.test.ts' \
  'src/web/src/lib/middleware/community-actor.test.ts' \
  'src/web/src/lib/middleware/community-daemon-auth.test.ts'
```

The real SQLite cases are `src/shared/test/queries/community-task-authority.test.ts`; loader/schema
cases are under `src/shared/src/community/`. New expectations check missing/ownerless deny, unapproved
single-message text/files, independent quotes, known attachment IDs after revoke, expired/wrong-channel
attachments, attachment reuse, owner/human/own-upload positives, malformed grants, unrestricted liveness
and older authorised reconnect work. They are not runner queue/cancellation tests.

## Not verified or not implemented

Runner provenance/admission, selective queued/running cancellation, grant UI, safer runtime defaults,
exact-build live protocol checks, full object/key recovery and application upgrade/rollback remain
open. There is no claim of independent review, malicious-server resistance, Windows or physical-device
coverage. The failed aggregate gate and remaining dependency advisories still block a pilot.
