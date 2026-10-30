import { z } from "zod";

export const MAX_TASK_GRANT_MINUTES = 24 * 60;
export const TaskGrantRequestSchema = z.strictObject({
  granteeUserId: z.string().trim().min(1).max(128),
  channelId: z.string().trim().min(1).max(128).nullable().optional(),
  minutes: z.number().int().min(1).max(MAX_TASK_GRANT_MINUTES).default(30),
});
