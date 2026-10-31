import { queries } from "@alook/shared"
import { getPrimaryDb as getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { writeJSON, writeError } from "@/lib/middleware/helpers"
import { pushAgentAuthorityChangedToMachine } from "@/lib/community/bot-push"

/**
 * DELETE /api/community/bots/{id}/grants/{grantId} — revoke now.
 *
 * Revocation is enforced in three places, each of which can fail independently:
 *   1. Server decisions (wake build, inbox/history/marks projection, attachment
 *      SQL) stop authorising NEW work from this grant — already the case before
 *      this route could notify anyone.
 *   2. The owning machine is nudged with `agent:authority_changed`, so the
 *      runner drops queued delegated work and interrupts a running delegated
 *      turn at its next safe boundary. A disconnected runner misses the nudge;
 *      it converges on reconnect and via the task-authority recheck it performs
 *      itself, because this route's D1 write is the authority, not the nudge.
 *   3. Work already executed, model output already produced and bytes already
 *      delivered are NOT undone. Interruption is best-effort at a boundary.
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

  const notified = bot.machineId
    ? await pushAgentAuthorityChangedToMachine(ctx.env, bot.machineId, id)
    : { sent: 0 }

  return writeJSON({ revoked: true, grantId, runnerNotified: notified.sent > 0 })
})
