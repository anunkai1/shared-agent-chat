import { beforeEach, describe, expect, it, vi } from "vitest";

const mockBot = vi.fn();
const mockMessage = vi.fn();
const mockReadable = vi.fn();
const mockGrants = vi.fn();

vi.mock("../db/queries/community/bot", () => ({ getBotWakeContext: (...a: unknown[]) => mockBot(...a) }));
vi.mock("../db/queries/community/message", () => ({ getWakeMessageScopeById: (...a: unknown[]) => mockMessage(...a) }));
vi.mock("../db/queries/community/member", () => ({ canBotReadWakeScope: (...a: unknown[]) => mockReadable(...a) }));
vi.mock("../db/queries/community/grant", () => ({ listActiveGrantsForBot: (...a: unknown[]) => mockGrants(...a) }));

import { checkTaskSource } from "./task-source.server";
import type { Database } from "../db";

const db = {} as Database;
const NOW = Date.parse("2026-10-31T00:00:00.000Z");
const future = new Date(NOW + 60_000).toISOString();
const past = new Date(NOW - 1_000).toISOString();

const liveGrant = {
  id: "grant_1",
  granteeUserId: "guest",
  grantedByUserId: "owner",
  channelId: null,
  expiresAt: future,
  revokedAt: null,
};
const delegatedSource = {
  messageId: "msg_1",
  authorUserId: "guest",
  channelId: "ch_1",
  grantId: "grant_1",
  expiresAt: future,
};
const ownerSource = { ...delegatedSource, authorUserId: "owner", grantId: null, expiresAt: null };

const check = (source: unknown) => checkTaskSource(db, {
  botUserId: "bot_1",
  machineId: "machine_1",
  ownerUserId: "owner",
  source: source as never,
  nowMs: NOW,
});

describe("server task-source recheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBot.mockResolvedValue({ state: "ready", botUserId: "bot_1", machineId: "machine_1", ownerUserId: "owner" });
    mockMessage.mockResolvedValue({ id: "msg_1", authorId: "owner", channelId: "ch_1" });
    mockReadable.mockResolvedValue(true);
    mockGrants.mockResolvedValue([liveGrant]);
  });

  it("accepts the owner's own task with no lease", async () => {
    await expect(check(ownerSource)).resolves.toEqual({ allowed: true, ownerUserId: "owner", validForMs: null });
    expect(mockGrants).not.toHaveBeenCalled();
  });

  it("accepts a live grant and reports a lease capped at five seconds", async () => {
    mockMessage.mockResolvedValue({ id: "msg_1", authorId: "guest", channelId: "ch_1" });
    await expect(check(delegatedSource)).resolves.toEqual({ allowed: true, ownerUserId: "owner", validForMs: 5_000 });
  });

  it.each([
    ["the bot is bound to another machine", () => mockBot.mockResolvedValue({ state: "ready", botUserId: "bot_1", machineId: "machine_2", ownerUserId: "owner" })],
    ["the bot is not ready", () => mockBot.mockResolvedValue({ state: "bot_inactive" })],
    ["the bot changed owner", () => mockBot.mockResolvedValue({ state: "ready", botUserId: "bot_1", machineId: "machine_1", ownerUserId: "someone" })],
    ["the message author does not match the source", () => mockMessage.mockResolvedValue({ id: "msg_1", authorId: "stranger", channelId: "ch_1" })],
    ["the message no longer exists", () => mockMessage.mockResolvedValue(null)],
    ["the channel scope does not match the source", () => mockMessage.mockResolvedValue({ id: "msg_1", authorId: "owner", channelId: "ch_other" })],
    ["the bot cannot read the channel", () => mockReadable.mockResolvedValue(false)],
  ])("refuses when %s", async (_label, arrange) => {
    arrange();
    await expect(check(ownerSource)).resolves.toEqual({ allowed: false });
  });

  it.each([
    ["revoked", [{ ...liveGrant, revokedAt: new Date(NOW).toISOString() }]],
    ["expired", [{ ...liveGrant, expiresAt: past }]],
    ["scoped elsewhere", [{ ...liveGrant, channelId: "ch_other" }]],
    ["issued by another owner", [{ ...liveGrant, grantedByUserId: "someone" }]],
    ["replaced by a different grant", [{ ...liveGrant, id: "grant_2" }]],
    ["absent", []],
  ])("refuses a delegated source whose grant is %s", async (_label, grants) => {
    mockMessage.mockResolvedValue({ id: "msg_1", authorId: "guest", channelId: "ch_1" });
    mockGrants.mockResolvedValue(grants);
    await expect(check(delegatedSource)).resolves.toEqual({ allowed: false });
  });

  it("refuses a source whose recorded expiry drifted from the live grant", async () => {
    mockMessage.mockResolvedValue({ id: "msg_1", authorId: "guest", channelId: "ch_1" });
    await expect(check({ ...delegatedSource, expiresAt: new Date(NOW + 120_000).toISOString() }))
      .resolves.toEqual({ allowed: false });
  });

  it("refuses an owner task that carries a grant id", async () => {
    await expect(check({ ...ownerSource, grantId: "grant_1", expiresAt: future }))
      .resolves.toEqual({ allowed: false });
  });
});
