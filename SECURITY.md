# Security status and reporting

This is an experimental fork of Alook. Owner-only task authorisation and time-limited delegated access are planned, not implemented. Do not connect unrestricted personal agent environments or use this fork for sensitive production work on the basis of the project plan.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/anunkai1/shared-agent-chat/security/advisories/new). Do not publish credentials, private conversations, internal deployment details or an exploit against somebody else's installation in a public issue.

Issues in unchanged upstream code may also affect Alook. Coordinate disclosure appropriately; this fork is not maintained or endorsed by the upstream team.

## Deployment boundaries

- Keep durable secrets outside source control in the deployment owner's canonical secret system. Prefer narrow, protected runtime injection over copying auth homes or credential directories.
- Do not put secret values in process arguments, logs, captures, test reports, GitHub Actions variables committed to code, or example files.
- Use synthetic identities and restricted sample workspaces for evaluation.
- A chat message, mention or channel membership is not equivalent to permission to execute tools.
- Notification muting is not a replacement for authenticated authorisation.
- Runtime approval-bypass settings are not an operating-system sandbox. Limit the execution account, files, network and tools independently.
- Revocation does not undo completed side effects. Running external actions may need best-effort cancellation and owner review.
- A hosting operator may control server-side identity and delivery state. Do not claim malicious-host resistance without independently enforced owner authority on the runner.

No full security audit or end-to-end permission assurance has been completed. Consult [project status](project/STATUS.md) for verified results and limitations.
