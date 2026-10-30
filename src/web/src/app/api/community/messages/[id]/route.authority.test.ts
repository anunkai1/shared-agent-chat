import { beforeEach, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"

const f = vi.hoisted(() => ({ db: {} as any, authorId: "stranger" }))
vi.mock("@alook/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@alook/shared")>()
  return { ...actual, queries: {
    communityMessage: { getMessageByChannelAndSeq: async () => ({
      id: "message", authorId: f.authorId, channelId: "channel", content: "PRIVATE_INSTRUCTION_CANARY",
      createdAt: "2026-01-01T00:00:00.000Z", seq: 1, replyToId: null,
    }) },
    communityAttachment: { listByMessageIds: async () => [{ id: "file", filename: "instructions.txt", contentType: "text/plain", size: 5 }] },
    communityAgentInbox: { toAgentMessage: actual.queries.communityAgentInbox.toAgentMessage },
  } }
})
vi.mock("@/lib/db", () => ({ getDb: () => f.db, getPrimaryDb: () => f.db }))
vi.mock("@/lib/middleware/community-actor", () => ({ withCommunityActor: (handler: any) => (req: any) => handler(req, {
  env: { DB: {} }, actor: { kind: "bot", userId: "bot", ownerUserId: "owner", machineId: "machine" }, params: { id: "resolve" },
}) }))
vi.mock("@/lib/community/permissions", () => ({ requireDMAccess: async () => ({ ok: true }), requireChannelMember: async () => ({ ok: true }), requireMessageSurfaceAccess: vi.fn(), requireServerMember: vi.fn() }))
vi.mock("@/lib/community/resolve-ref", () => ({ resolveTargetForMember: async () => ({ channelId: "channel", type: "text" }) }))
vi.mock("@/lib/community/message-handler", () => ({ isDmTarget: () => false }))
vi.mock("@/lib/community/fanout", () => ({ broadcastToUserSafe: vi.fn(), fanOutToServerMembers: vi.fn() }))
vi.mock("@/lib/community/message-payload", () => ({ readCommunityMessageResource: vi.fn(), readCommunityMessageProfiles: vi.fn() }))
vi.mock("@/lib/community/forum-post-media-cleanup", () => ({ scheduleForumPostMediaCleanup: vi.fn() }))
vi.mock("@/lib/community/read-contract", () => ({ writeCommunityContractJSON: vi.fn() }))
import { GET } from "./route"

beforeEach(() => vi.clearAllMocks())
it.each(["stranger", "owner"])("actual resolve route/projector applies explicit authority to %s text and files", async authorId => {
  f.authorId = authorId
  const results = [
    ...(authorId === "stranger" ? [[]] : []),
    [{ id: "channel", name: "general", type: "text", serverId: "server", parentChannelId: null, parentMessageId: null }],
    [{ id: authorId, name: "Sender", discriminator: "1234" }],
    [{ id: "server", name: "Room", discriminator: "5678" }],
  ]
  f.db = { select: vi.fn(() => ({ from: () => ({ where: async () => results.shift() ?? [] }) })) }
  const res = await GET(new NextRequest("http://localhost/api/community/messages/resolve?ref=%2FRoom%235678%2Fgeneral&seq=1"))
  expect(res.status).toBe(200)
  const body = await res.json()
  if (authorId === "owner") {
    expect(body.message.content.text).toBe("PRIVATE_INSTRUCTION_CANARY")
    expect(body.message.content.attachments[0].id).toBe("file")
  } else {
    expect(JSON.stringify(body)).not.toContain("PRIVATE_INSTRUCTION_CANARY")
    expect(body.message.content.attachments).toBeUndefined()
    expect(body.message.content.text).toContain("withheld")
  }
})
