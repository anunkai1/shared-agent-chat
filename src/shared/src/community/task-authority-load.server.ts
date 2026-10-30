import { createTaskAuthority, type TaskAuthorityCheck } from "./task-authority";
import { listActiveGrantsForBot } from "../db/queries/community/grant";
import type { Database } from "../db/index";

/**
 * One place builds the authority check for a bot-facing read, so the inbox, the
 * two message projections and saved marks cannot disagree about who may task a
 * bot — or about which grants were live when the page was read.
 *
 * Returns `undefined` when nothing on the page could need withholding: an
 * owner-only bot whose page contains only the owner's own messages. That is the
 * common case, so it must not pay a grant query per page, and callers pass the
 * result straight into the projection where `undefined` means "no redaction".
 */
export async function loadTaskAuthorityForBot(
  db: Database,
  input: {
    botUserId: string;
    botOwnerUserId: string | null;
    /** Authors on the page, when the caller already has them. */
    authorIds?: readonly (string | null | undefined)[];
    nowMs?: number;
  }
): Promise<TaskAuthorityCheck | undefined> {
  const nowMs = input.nowMs ?? Date.now();

  // No owner means no authority holder, so a grant lookup could not change the
  // answer: the rule refuses everybody.
  if (input.botOwnerUserId === null) return undefined;

  if (input.authorIds !== undefined) {
    const needsGrants = input.authorIds.some(
      (authorId) => authorId != null && authorId !== input.botOwnerUserId
    );
    if (!needsGrants) return undefined;
  }

  const grants = await listActiveGrantsForBot(
    db,
    input.botUserId,
    new Date(nowMs).toISOString()
  );
  return createTaskAuthority({
    botOwnerUserId: input.botOwnerUserId,
    grants,
    nowMs,
  });
}
