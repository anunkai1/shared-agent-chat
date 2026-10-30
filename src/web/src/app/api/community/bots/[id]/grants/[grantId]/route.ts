import { queries } from "@alook/shared"
import { getPrimaryDb as getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { writeJSON, writeError } from "@/lib/middleware/helpers"

/**
 * DELETE /api/community/bots/{id}/grants/{grantId} — revoke now.
 *
 * Subsequent server decisions recheck the row. This does not invalidate runner
 * admissions/queues, cancel running turns or undo completed side effects.
 */
export const DELETE = withAuth(async (_req, ctx) => {
  const id = ctx.params?.id as string
  const grantId = ctx.params?.grantId as string
  const db = getDb(ctx.env.DB)

  const bot = await queries.communityBot.getBotOwnedBy(db, id, ctx.userId)
  if (!bot) return writeError("bot not found", 404)

  const revoked = await queries.communityGrant.revokeGrant(db, {
    grantId,
    botUserId: id,
    nowIso: new Date().toISOString(),
  })
  if (!revoked) return writeError("grant not found or already revoked", 404)

  return writeJSON({ revoked: true, grantId })
})
