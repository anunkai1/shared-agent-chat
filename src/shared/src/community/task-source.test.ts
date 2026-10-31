import { describe, expect, it } from "vitest";
import { TaskSourceSchema, taskSourceForMessage } from "./task-source";
import type { TaskGrant } from "./task-authority";

const NOW = Date.parse("2026-10-31T00:00:00.000Z");
const message = { id: "msg_1", authorId: "guest", channelId: "ch_1" };

function grant(overrides: Partial<TaskGrant & { id: string; grantedByUserId: string }> = {}) {
  return {
    id: "grant_1",
    granteeUserId: "guest",
    grantedByUserId: "owner",
    channelId: null,
    expiresAt: new Date(NOW + 60_000).toISOString(),
    revokedAt: null,
    ...overrides,
  } as TaskGrant & { id: string; grantedByUserId: string };
}

describe("task source provenance", () => {
  it("marks the bot owner's own message as an owner task", () => {
    expect(taskSourceForMessage({
      botOwnerUserId: "owner",
      message: { ...message, authorId: "owner" },
      grants: [],
      nowMs: NOW,
    })).toEqual({ messageId: "msg_1", authorUserId: "owner", channelId: "ch_1", grantId: null, expiresAt: null });
  });

  it("binds a delegated task to the exact grant that authorised it", () => {
    const g = grant();
    expect(taskSourceForMessage({ botOwnerUserId: "owner", message, grants: [g], nowMs: NOW })).toEqual({
      messageId: "msg_1", authorUserId: "guest", channelId: "ch_1", grantId: "grant_1", expiresAt: g.expiresAt,
    });
  });

  it.each([
    ["no grant", () => [] as ReturnType<typeof grant>[]],
    ["revoked grant", () => [grant({ revokedAt: new Date(NOW - 1_000).toISOString() })]],
    ["expired grant", () => [grant({ expiresAt: new Date(NOW - 1_000).toISOString() })]],
    ["grant scoped to another channel", () => [grant({ channelId: "ch_other" })]],
    ["grant issued by someone other than the bot owner", () => [grant({ grantedByUserId: "someone_else" })]],
  ])("refuses a stranger's message with %s", (_label, grants) => {
    expect(taskSourceForMessage({ botOwnerUserId: "owner", message, grants: grants(), nowMs: NOW })).toBeNull();
  });

  it("refuses an ownerless bot outright", () => {
    expect(taskSourceForMessage({
      botOwnerUserId: null,
      message: { ...message, authorId: "owner" },
      grants: [grant()],
      nowMs: NOW,
    })).toBeNull();
  });

  it("rejects a source with unknown fields or a non-ISO expiry", () => {
    expect(TaskSourceSchema.safeParse({
      messageId: "m", authorUserId: "a", channelId: "c", grantId: null, expiresAt: null, extra: true,
    }).success).toBe(false);
    expect(TaskSourceSchema.safeParse({
      messageId: "m", authorUserId: "a", channelId: "c", grantId: "g", expiresAt: "soon",
    }).success).toBe(false);
  });
});
