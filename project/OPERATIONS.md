# Operating this fork

Operating notes: what a deployment needs to be safe and recoverable, and what each check actually proves. Written for
whoever runs an instance, not for developers.

Two rules come before everything else: **recovery needs the database, uploaded objects and the correct secret/key versions**, and **a passing test suite is not a security assurance**.

## Before anyone else uses an instance

1. **Backups, verified by restoring.** A snapshot you have never restored is a hope, not a backup.
   Take one with the SQLite backup API rather than copying a live file — a copy can capture a torn
   write. Derive identity/content fingerprints from that snapshot, not a changing live database.
   After every restore compare those fingerprints, attachment associations and the migration ledger;
   counts alone cannot prove content survived. Restore object storage separately and fetch an attachment
   byte canary with the recovered keys. D1-only checks do not establish full recovery.
2. **A tested upgrade path.** Apply migrations to a restored copy first. If a restore comes back empty
   after you replace a database file, the usual cause is stale `-wal`/`-shm` siblings still sitting
   beside it. Test a newer pinned build and its migrations separately from a same-build restore, and
   separately verify rollback. Do not assume database migrations are reversible.
3. **Owner-only or granted, never ambient.** Membership of a channel grants reading. It does not grant
   the right to task somebody's agent. If your deployment reports otherwise, the version you are
   running has an incomplete or bypassed authority boundary. Even current server filters do not clear
   runner queues or cancel delegated turns after revocation; do not start a real-agent pilot yet.
4. **Runners are restricted environments.** A bot's runner is where arbitrary code actually executes.
   Give it a disposable workspace, no personal credential store, no host socket, no broad home mount,
   and a network path that reaches only what the task needs.
5. **Ingress last.** Add a public route only after the above, with TLS, authentication and an
   invitation policy you have decided deliberately.

## What the project's own checks cover

| Check | What it proves | What it does not |
|---|---|---|
| `pnpm typecheck` | types agree across packages | behaviour |
| `pnpm lint` | style and a set of static traps | behaviour |
| unit and integration suites | the rules hold in isolation | real deployment, real models |
| protocol checks against a live instance | only the explicitly exercised endpoints, credentials, cases and build | untested content paths, runner cancellation, model behaviour or a hostile host |
| D1 snapshot/restore | only the tables/identities/content explicitly compared on each restore | uploaded bytes, key recovery, newer-build upgrade or rollback |

## Environment gotchas worth knowing

- The local development stack (Wrangler/workerd + SQLite) intermittently answers `SQLITE_BUSY`. Treat
  a 5xx during local testing as infrastructure failure, not as an authorisation result, and retry.
- Some daemon tests need the agent-driver package **built** first (its subpath imports resolve to
  `dist`), a real `.git` present (one contract test shells out to `git ls-files`), and a container
  init that reaps zombies — otherwise killed processes still answer `kill(pid, 0)` and process-tree
  tests fail for reasons unrelated to the code.
- A slow model needs a runtime-appropriate readiness signal, not a longer timeout. If a first turn is
  killed for "no response", the runtime never announced that it had started.

## Reporting a security problem

Use GitHub private vulnerability reporting on the fork. Do not put credentials, private conversations
or exploit details in a public issue. See [SECURITY.md](../SECURITY.md).

