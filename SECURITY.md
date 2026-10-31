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
- Every `agent:wake` carries a task source: the initiating message, its author, its channel, and either the owner or the exact grant that authorised it. The daemon refuses a wake with no provenance or whose probe is refused, before any session is created.

These statements describe implemented paths and regression coverage, not a comprehensive security guarantee. See [project status](project/STATUS.md) for verification limits.

## Runner-side authority enforcement

Provenance travels with the work, not just with the conversation:

- `POST /api/community/daemon/task-authority` rechecks a task source against the authenticated machine: bot binding and owner, the real message author and channel, bot readability, and — for delegated work — that the **same** grant id is still live and unexpired. A replacement grant cannot resurrect work done under an older one.
- The daemon caches only positive decisions, for about one second, and drops them whenever the server signals `agent:authority_changed`. Refusals are never cached; a timeout, network error or malformed answer denies.
- The driver authorises before root admission, again before the physical lane starts (after any asynchronous open), and at every safe-boundary or steering delivery. A periodic sweep rechecks queued, steering, safe-boundary and running work.
- Revoked or expired queued work is dropped with `task_authority_revoked` and a running delegated turn is interrupted once. Owner work is never dropped, interrupted or requeued by this path, and a delegated message is never merged or steered into an owner turn.
- The credential proxy stamps the initiating author on the child's own server calls and refuses them once the task's authority is gone, so a child cannot keep reading as the bot after its turn is revoked.

## Revocation limits — important

Revocation updates the server grant row, nudges the owning machine and is rechecked by the runner. It still does **not**:

- recall bytes already delivered or undo completed side effects, including tool calls, uploads, external requests or files written;
- stop a runtime instantly. Interruption is a best-effort request at a boundary the driver can act on; a delegated turn can keep working until that boundary or until the process exits;
- apply to a runner that is offline when the nudge is sent — it converges on reconnect or within roughly one lease of its own revalidation, not instantly;
- remove the ambient authority of an idle kept-warm session. A child with no active task gets no narrowing header and retains the bot authority it always had; this change neither creates nor closes that surface;
- protect against a server that lies to the runner. Signatures are not used: resistance to a malicious hosting operator needs an independently trusted owner-authority mechanism, which is not established here.

An in-flight read may also have taken its policy snapshot before a revoke.

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
