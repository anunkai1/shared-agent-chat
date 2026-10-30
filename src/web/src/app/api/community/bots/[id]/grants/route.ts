import { queries, TaskGrantRequestSchema } from "@alook/shared"
import { getPrimaryDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth"
import { writeJSON, writeError } from "@/lib/middleware/helpers"

export const GET = withAuth(async (_req, ctx) => {
  const id = ctx.params?.id as string
  const db = getPrimaryDb(ctx.env.DB)
  const bot = await queries.communityBot.getBotOwnedBy(db, id, ctx.userId)
  if (!bot) return writeError("bot not found", 404)

  const grants = await queries.communityGrant.listGrantsForBot(db, id)
  const nowMs = Date.now()
  return writeJSON({
    ownerUserId: ctx.userId,
    grants: grants.map((grant) => ({
      id: grant.id,
      granteeUserId: grant.granteeUserId,
      channelId: grant.channelId,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
      createdAt: grant.createdAt,
      live: grant.revokedAt === null && Date.parse(grant.expiresAt) > nowMs,
    })),
  })
})

export const POST = withAuth(async (req, ctx) => {
  const id = ctx.params?.id as string
  const db = getPrimaryDb(ctx.env.DB)
  const bot = await queries.communityBot.getBotOwnedBy(db, id, ctx.userId)
  if (!bot) return writeError("bot not found", 404)

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return writeError("invalid request body", 400)
  }
  const parsed = TaskGrantRequestSchema.safeParse(raw)
  if (!parsed.success) return writeError("invalid grant request", 400)
  const { granteeUserId, minutes, channelId = null } = parsed.data
  if (granteeUserId === id) return writeError("a bot cannot be granted authority over itself", 400)
  if (granteeUserId === ctx.userId) return writeError("the owner already holds authority", 400)

  const grantee = await queries.communityGrant.findGrantCandidate(db, granteeUserId)
  if (!grantee) return writeError("grantee not found", 404)
  if (grantee.isBot) return writeError("grants belong to people", 400)
  if (channelId !== null && !await queries.communityChannel.getChannel(db, channelId)) {
    return writeError("channel not found", 404)
  }
  const grant = await queries.communityGrant.createGrant(db, {
    botUserId: id,
    granteeUserId,
    grantedByUserId: ctx.userId,
    channelId,
    expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
  })
  return writeJSON({ grant }, 201)
})
