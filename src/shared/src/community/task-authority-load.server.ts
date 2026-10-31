import { createTaskAuthority, type TaskAuthorityCheck } from "./task-authority";
import { listActiveGrantsForBot } from "../db/queries/community/grant";
import type { Database } from "../db/index";

export async function loadTaskAuthorityForBot(
  db: Database,
  input: {
    botUserId: string;
    botOwnerUserId: string | null;
    authorIds?: readonly (string | null | undefined)[];
    nowMs?: number;
    onlyAuthorUserId?: string;
  }
): Promise<TaskAuthorityCheck> {
  const nowMs = input.nowMs ?? Date.now();
  const needsGrants = input.botOwnerUserId !== null && (
    input.authorIds === undefined || input.authorIds.some(
      (authorId) => authorId != null && authorId !== input.botOwnerUserId
    )
  );
  const grants = needsGrants
    ? await listActiveGrantsForBot(db, input.botUserId, new Date(nowMs).toISOString())
    : [];
  const policy = createTaskAuthority({ botOwnerUserId: input.botOwnerUserId, grants, nowMs });
  return {
    ownerUserId: policy.ownerUserId,
    mayTask: (authorId, channelId) =>
      (input.onlyAuthorUserId === undefined || input.onlyAuthorUserId === authorId) && policy.mayTask(authorId, channelId),
  };
}
