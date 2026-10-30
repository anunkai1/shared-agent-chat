import { describe, it, expect } from "vitest";
import { hasTaskAuthority, createTaskAuthority } from "./task-authority";

describe("hasTaskAuthority", () => {
  it("grants the owner", () => {
    expect(hasTaskAuthority({ botOwnerUserId: "owner_1", authorId: "owner_1" })).toBe(true);
  });

  it("refuses another member of the same channel", () => {
    expect(hasTaskAuthority({ botOwnerUserId: "owner_1", authorId: "u_other" })).toBe(false);
  });

  it("refuses everything when the bot has no owner", () => {
    expect(hasTaskAuthority({ botOwnerUserId: null, authorId: "owner_1" })).toBe(false);
  });

  it("does not treat two unbound bots as sharing authority", () => {
    expect(hasTaskAuthority({ botOwnerUserId: null, authorId: null as unknown as string })).toBe(false);
  });
});

/**
 * Grants are the only thing besides ownership that can produce authority, so the
 * boundary between them is the whole risk surface: expiry, revocation, channel
 * scope, and a grant to the wrong person.
 */
describe("hasTaskAuthority — delegated grants", () => {
  const now = Date.parse("2026-10-30T12:00:00.000Z");
  const later = new Date(now + 30 * 60_000).toISOString();
  const earlier = new Date(now - 1).toISOString();

  const grant = (over: Partial<{ granteeUserId: string; channelId: string | null; expiresAt: string; revokedAt: string | null }> = {}) => ({
    granteeUserId: "u_alice",
    channelId: null,
    expiresAt: later,
    revokedAt: null,
    ...over,
  });

  const ask = (over: Partial<Parameters<typeof hasTaskAuthority>[0]> = {}) =>
    hasTaskAuthority({
      botOwnerUserId: "owner_1",
      authorId: "u_alice",
      channelId: "ch_1",
      grants: [grant()],
      nowMs: now,
      ...over,
    });

  it("allows a live grant holder", () => {
    expect(ask()).toBe(true);
  });

  it("refuses once the grant has expired", () => {
    expect(ask({ grants: [grant({ expiresAt: earlier })] })).toBe(false);
  });

  it("refuses at the exact expiry instant", () => {
    expect(ask({ grants: [grant({ expiresAt: new Date(now).toISOString() })] })).toBe(false);
  });

  it("refuses a revoked grant even before it expires", () => {
    expect(ask({ grants: [grant({ revokedAt: new Date(now - 60_000).toISOString() })] })).toBe(false);
  });

  it("refuses a channel-scoped grant in a different channel", () => {
    expect(ask({ grants: [grant({ channelId: "ch_other" })] })).toBe(false);
  });

  it("allows a channel-scoped grant in its own channel", () => {
    expect(ask({ grants: [grant({ channelId: "ch_1" })] })).toBe(true);
  });

  it("refuses when the message channel is unknown and the grant is scoped", () => {
    expect(ask({ channelId: undefined, grants: [grant({ channelId: "ch_1" })] })).toBe(false);
  });

  it("ignores a grant held by somebody else", () => {
    expect(ask({ authorId: "u_bob" })).toBe(false);
  });

  it("fails closed on an unparseable expiry rather than guessing", () => {
    expect(ask({ grants: [grant({ expiresAt: "not-a-date" })] })).toBe(false);
  });

  it("still gives the owner authority with no grants at all", () => {
    expect(ask({ authorId: "owner_1", grants: [] })).toBe(true);
  });

  it("refuses everybody when the bot has no owner, grants or not", () => {
    expect(ask({ botOwnerUserId: null })).toBe(false);
  });
});

describe("createTaskAuthority", () => {
  it("binds one instant, so a page read cannot straddle an expiry", () => {
    const now = Date.now();
    const check = createTaskAuthority({
      botOwnerUserId: "owner_1",
      grants: [{ granteeUserId: "u_alice", channelId: null, expiresAt: new Date(now + 5).toISOString(), revokedAt: null }],
      nowMs: now,
    });
    expect(check.mayTask("u_alice", "ch_1")).toBe(true);
    expect(check.mayTask("u_bob", "ch_1")).toBe(false);
    expect(check.ownerUserId).toBe("owner_1");
  });
});
