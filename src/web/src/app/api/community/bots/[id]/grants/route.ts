import { queries, loadTaskAuthority } from "@alook/shared"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { writeJSON, writeError } from "@/lib/middleware/helpers"

/** Longest grant this server will issue. Delegation is meant to be temporary. */
export const MAX_GRANT_MINUTES = 24 * 60

/**
 * GET /api/community/bots/{id}/grants — the owner's view of who may task this bot.
 *
 * Answers from the same predicate the enforcement points use, so the panel can
 * never claim a grant is live when the wake path would refuse it.
 */
export const GET = withAuth(async (_req, ctx) => {
  const id = ctx.params?.id as string
  const db = getDb(ctx.env.DB)

  const bot = await queries.communityBot.getBotOwnedBy(db, id, ctx.userId)
  if (!bot) return writeError("bot not found", 404)

  const grants = await queries.communityGrant.listGrantsForBot(db, id)
  const authority = await loadTaskAuthority(db, { botUserId: id, botOwnerUserId: ctx.userId })
  const nowMs = Date.now()

  return writeJSON({
    ownerUserId: ctx.userId,
    grants: grants.map((grant) => {
      const expiresAtMs = Date.parse(grant.expiresAt)
      const live =
        grant.revokedAt === null &&
        Number.isFinite(expiresAtMs) &&
        expiresAtMs > nowMs
      return {
        id: grant.id,
        granteeUserId: grant.granteeUserId,
        channelId: grant.channelId,
        expiresAt: grant.expiresAt,
        revokedAt: grant.revokedAt,
        createdAt: grant.createdAt,
        live,
        // The enforcement answer for the exact channel this grant covers, so a
        // channel-scoped grant cannot be displayed as broader than it is.
        effective: authority.mayTask(grant.granteeUserId, grant.channelId),
      }
    }),
  })
})

/**
 * POST /api/community/bots/{id}/grants — owner grants a named person authority
 * to task this bot until `expiresAt` (ISO-8601), optionally narrowed to one
 * channel.
 *
 * Only the owner may create grants. A grant never confers configuration rights,
 * never lets the grantee create further grants, and never lets the grantee's own
 * bots inherit it.
 */
export const POST = withAuth(async (req, ctx) => {
  const id = ctx.params?.id as string
  const db = getDb(ctx.env.DB)

  const bot = await queries.communityBot.getBotOwnedBy(db, id, ctx.userId)
  if (!bot) return writeError("bot not found", 404)

  let body: {
    granteeUserId?: unknown
    channelId?: unknown
    minutes?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return writeError("invalid request body", 400)
  }

  const granteeUserId = typeof body.granteeUserId === "string" ? body.granteeUserId.trim() : ""
  if (!granteeUserId) return writeError("granteeUserId is required", 400)
  if (granteeUserId === id) return writeError("a bot cannot be granted authority over itself", 400)
  if (granteeUserId === ctx.userId) return writeError("the owner already holds authority", 400)

  const grantee = await queries.communityGrant.findGrantCandidate(db, granteeUserId)
  if (!grantee) return writeError("grantee not found", 404)
  if (grantee.isBot) {
    return writeError("a bot cannot be granted authority: grants belong to people", 400)
  }

  const minutes = body.minutes === undefined ? 30 : body.minutes
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > MAX_GRANT_MINUTES
  ) {
    return writeError(`minutes must be an integer between 1 and ${MAX_GRANT_MINUTES}`, 400)
  }

  const channelId = typeof body.channelId === "string" && body.channelId ? body.channelId : null

  const grant = await queries.communityGrant.createGrant(db, {
    botUserId: id,
    granteeUserId,
    grantedByUserId: ctx.userId,
    channelId,
    expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
  })

  return writeJSON({ grant }, 201)
})
