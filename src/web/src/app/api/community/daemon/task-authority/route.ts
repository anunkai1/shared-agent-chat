import { checkTaskSource, TaskSourceCheckRequestSchema } from "@alook/shared"
import { getPrimaryDb } from "@/lib/db"
import { withCommunityDaemonAuth } from "@/lib/middleware/community-daemon-auth"
import { writeJSON, writeError } from "@/lib/middleware/helpers"

export const POST = withCommunityDaemonAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null)
  const parsed = TaskSourceCheckRequestSchema.safeParse(body)
  if (!parsed.success) return writeError("invalid task source", 400)
  const result = await checkTaskSource(getPrimaryDb(ctx.env.DB), {
    ...parsed.data, machineId: ctx.machineId, ownerUserId: ctx.userId,
  })
  return writeJSON(result)
})
