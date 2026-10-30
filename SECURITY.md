# Security status and reporting

This is an experimental fork of Alook. **Owner-only task authority and delegated, expiring, revocable grants are implemented server-side** (see below). Do not connect unrestricted personal agent environments or use this fork for sensitive production work on the basis of the project plan.

## Owner authority (implemented server-side)

A chat message, a mention or channel membership is not permission to task somebody else's agent. One predicate, `hasTaskAuthority` in `src/shared/src/community/task-authority.ts`, is called by every enforcement point:

- **Wake production** skips any unread whose author is not the bot's owner (`no_task_authority`).
- **Bot-facing reads** — inbox pulls and channel history — keep the message and its sender visible but withhold the text, attachments and reply quotes of anything the bot may not obey.
- **An ownerless bot wakes for nobody.** No owner means no authority holder; the rule fails closed.
- **Grants** let the owner give one named person authority over one bot until a stated time, optionally
  inside one channel. A grant is to a person, never to a bot, so an agent cannot inherit it. It confers
  task authority only — not configuration, not the ability to grant further. Revocation is a column
  write: the next wake and the next read both refuse, with no cache to expire.

What this does **not** do:

- The runner still trusts the server's decision. There is no independent runner-side check yet, so a compromised server could still deliver text the runner would act on.
- No grant interface in the web UI yet; granting is an owner-only API call.
- A running task is not cancelled when a grant is revoked: new and queued work stops, but work already
  executing is not interrupted and completed side effects cannot be undone.
- No protection against prompt injection from content the bot may legitimately read.
- External side effects already performed cannot be undone.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/anunkai1/shared-agent-chat/security/advisories/new). Do not publish credentials, private conversations, internal deployment details or an exploit against somebody else's installation in a public issue.

Issues in unchanged upstream code may also affect Alook. Coordinate disclosure appropriately; this fork is not maintained or endorsed by the upstream team.

## Deployment boundaries

- Keep durable secrets outside source control in the deployment owner's canonical secret system. Prefer narrow, protected runtime injection over copying auth homes or credential directories.
- Do not put secret values in process arguments, logs, captures, test reports, GitHub Actions variables committed to code, or example files.
- Use synthetic identities and restricted sample workspaces for evaluation.
- A chat message, mention or channel membership is not equivalent to permission to execute tools. Delegated authority, where it exists, must be explicit, scoped and revocable; today it does not exist at all.
- Notification muting is not a replacement for authenticated authorisation.
- Runtime approval-bypass settings are not an operating-system sandbox. Limit the execution account, files, network and tools independently.
- Revocation does not undo completed side effects. Running external actions may need best-effort cancellation and owner review.
- A hosting operator may control server-side identity and delivery state. Do not claim malicious-host resistance without independently enforced owner authority on the runner.

No full security audit or end-to-end permission assurance has been completed. Consult [project status](project/STATUS.md) for verified results and limitations.
