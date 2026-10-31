import type { Database } from "../db";
import { getBotWakeContext } from "../db/queries/community/bot";
import { getWakeMessageScopeById } from "../db/queries/community/message";
import { canBotReadWakeScope } from "../db/queries/community/member";
import { listActiveGrantsForBot } from "../db/queries/community/grant";
import { taskSourceForMessage, type TaskSource } from "./task-source";

export async function checkTaskSource(db: Database, input: {
  botUserId: string; machineId: string; ownerUserId: string; source: TaskSource; nowMs?: number;
}): Promise<{ allowed: false } | { allowed: true; ownerUserId: string; validForMs: number | null }> {
  const nowMs = input.nowMs ?? Date.now();
  const bot = await getBotWakeContext(db, input.botUserId);
  if (bot.state !== "ready" || bot.machineId !== input.machineId || bot.ownerUserId !== input.ownerUserId) return { allowed: false };
  const message = await getWakeMessageScopeById(db, input.source.messageId);
  if (!message || message.authorId !== input.source.authorUserId || message.channelId !== input.source.channelId) return { allowed: false };
  if (!await canBotReadWakeScope(db, input.botUserId, { channelId: message.channelId })) return { allowed: false };
  const grants = input.source.grantId === null ? [] :
    (await listActiveGrantsForBot(db, input.botUserId, new Date(nowMs).toISOString()))
      .filter(grant => grant.id === input.source.grantId);
  const current = taskSourceForMessage({ botOwnerUserId: bot.ownerUserId, message, grants, nowMs });
  if (!current || current.grantId !== input.source.grantId || current.expiresAt !== input.source.expiresAt) return { allowed: false };
  return {
    allowed: true, ownerUserId: input.ownerUserId,
    validForMs: current.expiresAt === null ? null : Math.min(5000, Date.parse(current.expiresAt) - nowMs),
  };
}
