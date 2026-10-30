import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadTaskAuthorityForBot } from "./task-authority-load.server";
const listActive = vi.hoisted(() => vi.fn(async () => []));
vi.mock("../db/queries/community/grant", () => ({ listActiveGrantsForBot: listActive }));

describe("bot read authority loader", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns an explicit deny policy without querying grants for an ownerless bot", async () => {
    const policy = await loadTaskAuthorityForBot({} as never, { botUserId: "bot", botOwnerUserId: null });
    expect(policy.mayTask("anyone", "channel")).toBe(false);
    expect(listActive).not.toHaveBeenCalled();
  });
  it("skips the grant query, not the policy, on an owner-only page", async () => {
    const policy = await loadTaskAuthorityForBot({} as never, { botUserId: "bot", botOwnerUserId: "owner", authorIds: ["owner"] });
    expect(policy.mayTask("owner", "channel")).toBe(true);
    expect(policy.mayTask("stranger", "channel")).toBe(false);
    expect(listActive).not.toHaveBeenCalled();
  });
  it("loads grants when a quoted author is not the owner", async () => {
    await loadTaskAuthorityForBot({} as never, { botUserId: "bot", botOwnerUserId: "owner", authorIds: ["owner", "quoted"] });
    expect(listActive).toHaveBeenCalledOnce();
  });
});
