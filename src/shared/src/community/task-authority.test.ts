import { describe, it, expect } from "vitest";
import { hasTaskAuthority } from "./task-authority";

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
