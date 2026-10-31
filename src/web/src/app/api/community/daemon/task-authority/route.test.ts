import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const f = vi.hoisted(() => ({ db: { primary: true }, check: vi.fn() }))
vi.mock("@/lib/db", () => ({ getPrimaryDb: () => f.db }))
vi.mock("@/lib/middleware/community-daemon-auth", () => ({ withCommunityDaemonAuth: (handler: unknown) => handler }))
vi.mock("@alook/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@alook/shared")>()
  return { ...actual, checkTaskSource: (...a: unknown[]) => f.check(...a) }
})

import { POST } from "./route"

const ctx = { env: { DB: {} }, machineId: "machine_1", userId: "owner" } as never
const req = (body: unknown) => new NextRequest("http://localhost/api/community/daemon/task-authority", {
  method: "POST",
  body: JSON.stringify(body),
})
const source = {
  messageId: "msg_1",
  authorUserId: "guest",
  channelId: "ch_1",
  grantId: "grant_1",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
}

describe("daemon task-authority route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    f.check.mockResolvedValue({ allowed: true, ownerUserId: "owner", validForMs: 5_000 })
  })

  it("answers with the server's decision for the authenticated machine", async () => {
    const response = await POST(req({ botUserId: "bot_1", source }), ctx)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ allowed: true, ownerUserId: "owner", validForMs: 5_000 })
    expect(f.check).toHaveBeenCalledWith(f.db, {
      botUserId: "bot_1",
      source,
      machineId: "machine_1",
      ownerUserId: "owner",
    })
  })

  it.each([
    ["a missing bot", { source }],
    ["a missing source", { botUserId: "bot_1" }],
    ["an unknown field", { botUserId: "bot_1", source, extra: true }],
    ["a source with an unknown field", { botUserId: "bot_1", source: { ...source, granteeUserId: "guest" } }],
    ["a non-ISO expiry", { botUserId: "bot_1", source: { ...source, expiresAt: "soon" } }],
    ["an empty message id", { botUserId: "bot_1", source: { ...source, messageId: "" } }],
  ])("rejects %s without asking the database", async (_label, body) => {
    expect((await POST(req(body), ctx)).status).toBe(400)
    expect(f.check).not.toHaveBeenCalled()
  })

  it("rejects a non-JSON body", async () => {
    const response = await POST(new NextRequest("http://localhost/api/community/daemon/task-authority", {
      method: "POST",
      body: "not json",
    }), ctx)

    expect(response.status).toBe(400)
    expect(f.check).not.toHaveBeenCalled()
  })

  it("passes a refusal through unchanged", async () => {
    f.check.mockResolvedValue({ allowed: false })
    const response = await POST(req({ botUserId: "bot_1", source }), ctx)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ allowed: false })
  })
})
