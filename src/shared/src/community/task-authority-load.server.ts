import { createTaskAuthority, type TaskAuthorityCheck } from "./task-authority";
import { listActiveGrantsForBot } from "../db/queries/community/grant";
import type { Database } from "../db/index";

/**
 * One place builds the authority check for a bot-facing read, so the inbox, the
 * two message projections and saved marks cannot disagree about who may task a
 * bot — or about which grants were live when the page was read.
 */
export async function loadTaskAuthorityForBot(
  db: Database,
  input: { botUserId: string; botOwnerUserId: string | null; nowMs?: number }
): Promise<TaskAuthorityCheck> {
  const nowMs = input.nowMs ?? Date.now();
  // The owner needs no lookup: they hold authority unconditionally, so an
  // owner-only bot (the common case) pays no extra query per page.
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
