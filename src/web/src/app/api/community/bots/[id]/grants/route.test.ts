import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const f = vi.hoisted(() => ({
  db: { primary: true }, owner: vi.fn(), candidate: vi.fn(), channel: vi.fn(), create: vi.fn(), list: vi.fn(), revoke: vi.fn(),
  push: vi.fn(),
}))
vi.mock("@/lib/db", () => ({ getPrimaryDb: () => f.db }))
vi.mock("@/lib/middleware/auth", () => ({ withAuth: (handler: unknown) => handler }))
vi.mock("@/lib/broadcast", () => ({ wsDoFetch: f.push }))
vi.mock("@alook/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@alook/shared")>()
  return { ...actual, queries: {
    communityBot: { getBotOwnedBy: f.owner },
    communityChannel: { getChannel: f.channel },
    communityGrant: { findGrantCandidate: f.candidate, createGrant: f.create, listGrantsForBot: f.list, revokeGrant: f.revoke },
  } }
})
import { GET, POST } from "./route"
import { DELETE } from "./[grantId]/route"
const ctx = { env: { DB: {} }, userId: "owner", params: { id: "bot", grantId: "grant" } } as any
const req = (body?: unknown) => new NextRequest("http://localhost/api/community/bots/bot/grants", {
  method: body === undefined ? "GET" : "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

describe("owner-only grant API", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    f.owner.mockResolvedValue({ id: "bot" })
    f.candidate.mockResolvedValue({ id: "friend", isBot: false })
    f.channel.mockResolvedValue({ id: "channel" })
    f.create.mockImplementation(async (_db, input) => ({ id: "grant", ...input }))
    f.revoke.mockResolvedValue(true)
    f.push.mockResolvedValue(Response.json({ sent: 1 }))
    f.list.mockResolvedValue([])
  })
  it.each([null, [], "string", { granteeUserId: "friend", channelId: 123 }, { granteeUserId: "friend", channelId: "" }, { granteeUserId: "friend", minutes: 0 }, { granteeUserId: "friend", minutes: 1441 }])("rejects malformed requests without creating a grant: %j", async body => {
    expect((await POST(req(body), ctx)).status).toBe(400)
    expect(f.create).not.toHaveBeenCalled()
  })
  it.each([undefined, null, "channel"])("preserves deliberate scope %j and defaults to 30 minutes", async channelId => {
    const start = Date.now()
    const response = await POST(req({ granteeUserId: "friend", channelId }), ctx)
    expect(response.status).toBe(201)
    expect(f.create).toHaveBeenCalledWith(f.db, expect.objectContaining({ botUserId: "bot", granteeUserId: "friend", grantedByUserId: "owner", channelId: channelId ?? null }))
    expect(Date.parse(f.create.mock.calls[0][1].expiresAt) - start).toBeGreaterThanOrEqual(30 * 60000)
    expect(f.owner).toHaveBeenCalledWith(f.db, "bot", "owner")
  })
  it.each(["bot", "owner"])("rejects self grants to %s", async granteeUserId => {
    expect((await POST(req({ granteeUserId }), ctx)).status).toBe(400)
    expect(f.create).not.toHaveBeenCalled()
  })
  it("rejects bot grantees and unknown channel scope", async () => {
    f.candidate.mockResolvedValue({ id: "other-bot", isBot: true })
    expect((await POST(req({ granteeUserId: "other-bot" }), ctx)).status).toBe(400)
    f.candidate.mockResolvedValue({ id: "friend", isBot: false })
    f.channel.mockResolvedValue(null)
    expect((await POST(req({ granteeUserId: "friend", channelId: "missing" }), ctx)).status).toBe(404)
    expect(f.create).not.toHaveBeenCalled()
  })
  it("lists live unrestricted grants without an ambiguous aggregate effective flag", async () => {
    f.list.mockResolvedValue([
      { id: "live", channelId: null, revokedAt: null, expiresAt: new Date(Date.now() + 60000).toISOString() },
      { id: "expired", channelId: null, revokedAt: null, expiresAt: new Date(Date.now() - 1000).toISOString() },
      { id: "revoked", channelId: "channel", revokedAt: "now", expiresAt: new Date(Date.now() + 60000).toISOString() },
    ])
    const body = await (await GET(req(), ctx)).json()
    expect(body.grants.map((grant: any) => grant.live)).toEqual([true, false, false])
    expect(body.grants.every((grant: any) => !("effective" in grant))).toBe(true)
  })
  it("scopes revocation to the owned bot", async () => {
    expect((await DELETE(req(), ctx)).status).toBe(200)
    expect(f.revoke).toHaveBeenCalledWith(f.db, { botUserId: "bot", grantId: "grant", nowIso: expect.any(String) })
  })
  it("hides an unknown or already revoked grant", async () => {
    f.revoke.mockResolvedValue(false)
    expect((await DELETE(req(), ctx)).status).toBe(404)
  })
  it("refuses foreign-owner listing, creation and revocation before querying grants", async () => {
    f.owner.mockResolvedValue(null)
    expect((await GET(req(), ctx)).status).toBe(404)
    expect((await POST(req({ granteeUserId: "friend" }), ctx)).status).toBe(404)
    expect((await DELETE(req(), ctx)).status).toBe(404)
    expect(f.list).not.toHaveBeenCalled()
    expect(f.create).not.toHaveBeenCalled()
    expect(f.revoke).not.toHaveBeenCalled()
  })

  it("nudges the owning runner so it drops queued work and interrupts a revoked turn", async () => {
    f.owner.mockResolvedValue({ id: "bot", machineId: "machine" })

    const response = await DELETE(req(), ctx)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ revoked: true, grantId: "grant", runnerNotified: true })
    expect(f.push).toHaveBeenCalledWith(
      ctx.env,
      "/community-machine/by-id/machine/push-agent-authority-changed",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ agentId: "bot" }) }),
      { label: "machine", type: "agent:authority_changed" },
    )
  })

  it("still revokes when the runner is offline, reporting the nudge honestly", async () => {
    f.owner.mockResolvedValue({ id: "bot", machineId: "machine" })
    f.push.mockResolvedValue(Response.json({ sent: 0 }))

    const response = await DELETE(req(), ctx)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ revoked: true, grantId: "grant", runnerNotified: false })
  })

  it("survives a nudge that throws, because the D1 revoke is the authority", async () => {
    f.owner.mockResolvedValue({ id: "bot", machineId: "machine" })
    f.push.mockRejectedValue(new Error("do unavailable"))

    const response = await DELETE(req(), ctx)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ revoked: true, grantId: "grant", runnerNotified: false })
  })

  it("does not attempt a nudge for a bot with no machine", async () => {
    f.owner.mockResolvedValue({ id: "bot", machineId: null })

    await DELETE(req(), ctx)

    expect(f.push).not.toHaveBeenCalled()
  })
})
