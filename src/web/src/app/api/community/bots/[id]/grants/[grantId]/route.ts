import { queries } from "@alook/shared"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { writeJSON, writeError } from "@/lib/middleware/helpers"

/**
 * DELETE /api/community/bots/{id}/grants/{grantId} — revoke now.
 *
 * Revocation is a write on the grant row, so the next wake decision and the next
 * bot-facing read both refuse: there is no cache to expire and nothing to
 * restart. Work already running is a separate concern — the server stops
 * queuing it, and completed side effects cannot be undone.
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
