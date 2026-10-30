import { it, expect, vi } from "vitest"
import { NextRequest } from "next/server"
import { COMMUNITY_CONTRACT_HEADER, COMMUNITY_RESOURCE_CONTRACT_VERSION } from "@alook/shared"

const f = vi.hoisted(() => ({ quotedAuthor: "stranger", grants: [] as unknown[] }))
vi.mock("@/lib/db", () => ({
  getPrimaryDb: () => ({ select: () => ({ from: () => ({ where: async () => f.grants }) }) }),
  getDb: vi.fn(),
}))
vi.mock("@/lib/middleware/community-actor", () => ({ withCommunityActor: (handler: any) => (req: any) => handler(req, {
  env: { DB: {} }, actor: { kind: "bot", userId: "bot", ownerUserId: "owner" }, params: { id: "channel" },
}) }))
vi.mock("@/lib/community/message-door", () => ({ resolveMessageTarget: async () => ({ ok: true, value: { target: { channelId: "channel" } } }) }))
vi.mock("@/lib/community/message-window.server", () => ({ readCommunityMessageWindow: async () => ({ ok: true, page: {
  messages: [{ id: "owner-reply", channelId: "channel", seq: 2, authorId: "owner", createdAt: "2026-01-01T00:00:00Z",
    type: "chat", content: "I disagree", replyToId: "outside-page", clientNonce: null, attachments: [],
    replyTo: { id: "outside-page", authorId: f.quotedAuthor, authorName: "Sender", text: "QUOTED_INSTRUCTION_CANARY" },
  }],
} }) }))
vi.mock("@/lib/community/read-contract", () => ({
  writeCommunityMessagesRead: (_req: unknown, _channel: unknown, page: unknown) => Response.json(page),
  writeCommunityConversationEntryRead: vi.fn(),
}))
import { GET } from "./route"

it.each(["stranger", "owner"])("actual enriched history route checks %s quote outside an owner-only page", async quotedAuthor => {
  f.quotedAuthor = quotedAuthor
  f.grants = []
  const request = new NextRequest("http://localhost/api/community/channels/channel/messages", {
    headers: { [COMMUNITY_CONTRACT_HEADER]: String(COMMUNITY_RESOURCE_CONTRACT_VERSION) },
  })
  const response = await GET(request)
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.messages[0].content).toBe("I disagree")
  if (quotedAuthor === "owner") {
    expect(body.messages[0].replyTo.text).toBe("QUOTED_INSTRUCTION_CANARY")
  } else {
    expect(body.messages[0].replyToId).toBeNull()
    expect(JSON.stringify(body)).not.toContain("QUOTED_INSTRUCTION_CANARY")
  }
})
