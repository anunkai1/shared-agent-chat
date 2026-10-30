# Security status and reporting

This is an experimental fork of Alook. **Not ready for a real-agent pilot.** Owner-only task rules and expiring grants exist, but end-to-end authority enforcement is incomplete. Do not connect unrestricted personal environments or sensitive production work.

## Implemented server boundaries

Conversation membership and task authority are separate. An owner can grant one named human task authority over one bot, optionally in one channel, for up to 24 hours (30 minutes by default). Grants do not confer bot configuration rights, onward delegation or authority on the grantee's bots. The owner's own authority is implicit.

- Wake production rechecks owner/live-grant authority. Queue items are hints, not authorisation.
- Bot inbox, history, single-message resolution and saved marks require an explicit policy; an absent policy cannot allow message content. Ownerless policies deny all message authors.
- Enriched history independently checks quoted authors. Unprovenanced embeds and thread previews are omitted from bot responses.
- Attachment downloads, thumbnails and attachment reuse require a membership-readable, task-authorised associated message for bots. An active uploader retains access to their own upload. Human membership rules remain in place.
- Bot identity and covered policy reads start primary-consistent D1 sessions, rather than relying on lagging replicas after a revoke.
- Grant requests are strictly validated; malformed scope is rejected, not widened. Grant listing reports `live`, not a misleading channel-independent `effective` value.

These statements describe implemented paths and regression coverage, not a comprehensive security guarantee. See [project status](project/STATUS.md) for verification limits.

## Revocation limits — important

Revocation updates the server grant row. Subsequent covered reads/wake decisions reject that grant; it does **not** recall bytes already delivered, clear runner queues, revalidate runner admission or interrupt executing delegated work. Those runner controls are not implemented. An in-flight read may already have taken its policy snapshot before a revoke.

The runner still trusts server delivery. Honest-server admission/queue revalidation does not inherently need signatures. Resistance to a malicious hosting operator is a separate problem requiring an independently trusted owner-authority mechanism on the runner; it is not established here.

Other limits:

- No grant-management web UI yet.
- No protection against prompt injection in legitimately authorised content.
- Claude/Codex launch defaults include approval bypass/full access; this is not an OS sandbox.
- No claim that completed external effects can be undone or every subprocess stopped instantly.
- Database-only recovery checks are not uploaded-object/key recovery or upgrade/rollback proof.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/anunkai1/shared-agent-chat/security/advisories/new). Do not publish credentials, private conversations, internal deployment details or an exploit against somebody else's installation in a public issue.

Issues in unchanged upstream code may also affect Alook. Coordinate disclosure appropriately; this fork is not maintained or endorsed by the upstream team.

## Deployment boundaries

- Keep durable secrets in the deployment owner's canonical secret system. Use narrow runtime injection, not auth-home copies or broad credential mounts.
- Never put secret values in process arguments, logs, captures, reports or source control.
- Use synthetic identities, restricted workspaces and independently limited files, network and tools for evaluation. No host socket or SSH-agent forwarding.
- Notifications, mentions and membership are not execution permission.
- Keep deployment separately approved and pinned; passing tests are not permission to expose a pilot.

A scoped review of fork changes found authority gaps; this is not a full inherited-code audit, independent review or penetration test. End-to-end permission assurance remains incomplete.
