/**
 * Who may cause a bot to run work.
 *
 * A chat message, a mention or channel membership is not permission to task
 * somebody else's agent. This is the pure/time-injected rule for wake and
 * content projections; taskAuthoritySql applies its owner/live-grant equivalent
 * before attachment association and reconnect candidate selection.
 *
 * Two answers are possible today: the owner, always; and a named person holding
 * a live grant for that bot, optionally narrowed to one channel.
 *
 * Deliberately pure and time-injected. The server passes `nowMs`, so expiry is
 * evaluated against one clock and tests do not have to wait for real time.
 */

export type TaskGrant = {
  readonly granteeUserId: string;
  /** null = every channel the bot can read. */
  readonly channelId: string | null;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
};

export type TaskAuthorityInput = {
  /** The bot's owner. null for an unbound bot, which grants authority to nobody. */
  readonly botOwnerUserId: string | null;
  readonly authorId: string;
  /** Where the message lives; required to narrow a channel-scoped grant. */
  readonly channelId?: string | null;
  readonly grants?: readonly TaskGrant[];
  readonly nowMs?: number;
};

/**
 * A grant is live when it has not been revoked and has not expired. An
 * unparseable `expiresAt` is treated as expired: fail closed, because guessing
 * would silently extend authority nobody approved.
 */
function grantIsLive(
  grant: TaskGrant,
  nowMs: number,
  channelId: string | null | undefined
): boolean {
  if (grant.revokedAt !== null) return false;
  const expiresAtMs = Date.parse(grant.expiresAt);
  if (!Number.isFinite(expiresAtMs)) return false;
  if (expiresAtMs <= nowMs) return false;
  if (grant.channelId === null) return true;
  return channelId !== undefined && channelId !== null && grant.channelId === channelId;
}

export function hasTaskAuthority(input: TaskAuthorityInput): boolean {
  if (input.botOwnerUserId === null) return false;
  if (input.channelId === null) return false;
  if (input.authorId === input.botOwnerUserId) return true;

  const grants = input.grants ?? [];
  if (grants.length === 0) return false;

  const nowMs = input.nowMs ?? Date.now();
  return grants.some(
    (grant) =>
      grant.granteeUserId === input.authorId &&
      grantIsLive(grant, nowMs, input.channelId)
  );
}

export type TaskAuthorityCheck = {
  /** The bot's owner, so callers can label a message without re-reading it. */
  readonly ownerUserId: string | null;
  mayTask(authorId: string, channelId: string | null | undefined): boolean;
};

/**
 * Bind the rule to one bot and one instant, so a read of many messages cannot
 * straddle an expiry boundary or re-derive the rule per row.
 */
export function createTaskAuthority(input: {
  botOwnerUserId: string | null;
  grants: readonly TaskGrant[];
  nowMs?: number;
}): TaskAuthorityCheck {
  const nowMs = input.nowMs ?? Date.now();
  return {
    ownerUserId: input.botOwnerUserId,
    mayTask: (authorId, channelId) =>
      hasTaskAuthority({
        botOwnerUserId: input.botOwnerUserId,
        authorId,
        channelId,
        grants: input.grants,
        nowMs,
      }),
  };
}

/**
 * Stands in for text a bot may not obey. The agent still sees that somebody
 * spoke, in which channel and at which sequence, so it can follow the
 * conversation without receiving instructions it has no authority to act on.
 */
export const NO_TASK_AUTHORITY_TEXT = "[withheld: this sender has no authority to task this bot]";
