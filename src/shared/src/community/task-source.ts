import { z } from "zod";
import { hasTaskAuthority, type TaskGrant } from "./task-authority";

export const TASK_AUTHOR_HEADER = "X-Alook-Task-Author";
export const TaskSourceSchema = z.strictObject({
  messageId: z.string().min(1).max(128),
  authorUserId: z.string().min(1).max(128),
  channelId: z.string().min(1).max(128),
  grantId: z.string().min(1).max(128).nullable(),
  expiresAt: z.iso.datetime().nullable(),
});
export type TaskSource = z.infer<typeof TaskSourceSchema>;
export const TaskSourceCheckRequestSchema = z.strictObject({
  botUserId: z.string().min(1).max(128),
  source: TaskSourceSchema,
});
export const TaskSourceDecisionSchema = z.discriminatedUnion("allowed", [
  z.strictObject({ allowed: z.literal(false) }),
  z.strictObject({ allowed: z.literal(true), ownerUserId: z.string().min(1), validForMs: z.number().int().positive().max(5000).nullable() }),
]);

export function taskSourceForMessage(input: {
  botOwnerUserId: string | null;
  message: { id: string; authorId: string; channelId: string };
  grants: readonly (TaskGrant & { id: string; grantedByUserId: string })[];
  nowMs: number;
}): TaskSource | null {
  const { botOwnerUserId, message, grants, nowMs } = input;
  if (!botOwnerUserId) return null;
  const base = { messageId: message.id, authorUserId: message.authorId, channelId: message.channelId };
  if (message.authorId === botOwnerUserId) return { ...base, grantId: null, expiresAt: null };
  const grant = grants.find(grant => grant.grantedByUserId === botOwnerUserId && hasTaskAuthority({
    botOwnerUserId, authorId: message.authorId, channelId: message.channelId, grants: [grant], nowMs,
  }));
  return grant ? { ...base, grantId: grant.id, expiresAt: grant.expiresAt } : null;
}
