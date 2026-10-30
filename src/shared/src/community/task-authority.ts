/**
 * Who may cause a bot to run work.
 *
 * A chat message, a mention or channel membership is not permission to task
 * somebody else's agent. This is the single predicate every enforcement point
 * calls — wake production, inbox pulls and channel history — so the rule cannot
 * drift between them, and so delegated grants can extend one function rather
 * than three.
 *
 * Today the answer is only ever the bot's owner. Delegated, expiring grants are
 * the next milestone; until then an absent owner (unbound bot) means nobody.
 */
export function hasTaskAuthority(input: {
  botOwnerUserId: string | null;
  authorId: string;
}): boolean {
  return input.botOwnerUserId !== null && input.authorId === input.botOwnerUserId;
}

/**
 * Stands in for text a bot may not obey. The agent still sees that somebody
 * spoke, in which channel and at which sequence, so it can follow the
 * conversation without receiving instructions it has no authority to act on.
 */
export const NO_TASK_AUTHORITY_TEXT = "[withheld: this sender has no authority to task this bot]";
