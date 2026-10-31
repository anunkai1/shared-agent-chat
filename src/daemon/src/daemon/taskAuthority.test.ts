import { describe, expect, it, vi } from "vitest";
import { TaskAuthorityClient, TaskAuthorityRevokedError } from "./taskAuthority";
import type { AgentMessage } from "@alook/agent-driver";

const SOURCE = {
  messageId: "msg_1",
  authorUserId: "guest",
  channelId: "ch_1",
  grantId: "grant_1",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};
const OWNER_SOURCE = { ...SOURCE, authorUserId: "owner", grantId: null, expiresAt: null };

function message(source: typeof SOURCE | null, principal?: string): AgentMessage {
  return {
    id: `cmd-${source?.grantId ?? "owner"}`,
    kind: "user",
    text: "do the thing",
    ...(source === null ? {} : {
      authorization: { principal: principal ?? (source.grantId === null ? "owner" : `grant:${source.grantId}`), data: source },
    }),
  };
}

function client(decisions: Array<Response | Error>, overrides: Partial<{ now: () => number; positiveTtlMs: number }> = {}) {
  const fetchMock = vi.fn(async () => {
    const next = decisions.shift();
    if (next === undefined) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return next;
  });
  return {
    client: new TaskAuthorityClient({
      serverUrl: "https://server.test",
      machineKey: "machine-key",
      fetch: fetchMock as unknown as typeof fetch,
      ...overrides,
    }),
    fetchMock,
  };
}

const allow = (ownerUserId = "owner") => Response.json({ allowed: true, ownerUserId, validForMs: 4_000 });
const deny = () => Response.json({ allowed: false });

describe("daemon task authority client", () => {
  it("accepts a delegated wake only after the server revalidates the source", async () => {
    const { client: c, fetchMock } = client([allow()]);
    await expect(c.prepareWake("bot_1", SOURCE)).resolves.toEqual({
      principal: "grant:grant_1",
      data: SOURCE,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refuses a wake the server denies, and refuses a malformed source without asking", async () => {
    const { client: c, fetchMock } = client([deny()]);
    await expect(c.prepareWake("bot_1", SOURCE)).rejects.toBeInstanceOf(TaskAuthorityRevokedError);
    await expect(c.prepareWake("bot_1", { ...SOURCE, grantId: undefined })).rejects.toBeInstanceOf(TaskAuthorityRevokedError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails closed when the authority endpoint is unreachable", async () => {
    const { client: c } = client([new Error("connection refused")]);
    await expect(c.authorizeMessage("bot_1", message(SOURCE))).resolves.toBe(false);
  });

  it("refuses a message whose principal label disagrees with its source", async () => {
    const { client: c, fetchMock } = client([allow()]);
    await expect(c.authorizeMessage("bot_1", message(SOURCE, "owner"))).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a message carrying no provenance at all", async () => {
    const { client: c, fetchMock } = client([allow()]);
    await expect(c.authorizeMessage("bot_1", message(null))).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-asks the server once the positive lease expires", async () => {
    let now = 0;
    const { client: c, fetchMock } = client([allow(), deny()], { now: () => now, positiveTtlMs: 1_000 });
    await expect(c.authorizeMessage("bot_1", message(OWNER_SOURCE))).resolves.toBe(true);
    await expect(c.authorizeMessage("bot_1", message(OWNER_SOURCE))).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    now = 1_001;
    await expect(c.authorizeMessage("bot_1", message(OWNER_SOURCE))).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("drops cached and in-flight approvals when the server signals an authority change", async () => {
    let release!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
    const c = new TaskAuthorityClient({
      serverUrl: "https://server.test",
      machineKey: "machine-key",
      fetch: fetchMock as unknown as typeof fetch,
      positiveTtlMs: 60_000,
    });

    const inFlight = c.authorizeMessage("bot_1", message(SOURCE));
    c.invalidate("bot_1");
    release(allow());
    await expect(inFlight).resolves.toBe(false);
  });

  it("narrows child traffic to the active task author", async () => {
    const { client: c } = client([allow()]);
    const policy = c.policyFor("bot_1");
    const active = message(SOURCE);
    await expect(policy.authorize(active)).resolves.toBe(true);
    policy.onActiveMessages!([active]);
    await expect(c.proxyHeaders("bot_1")).resolves.toEqual({ "x-alook-task-author": "guest" });
  });

  it("leaves an idle session unnarrowed, and refuses traffic once its task is revoked", async () => {
    const { client: c } = client([allow(), deny()]);
    await expect(c.proxyHeaders("bot_1")).resolves.toEqual({});

    const policy = c.policyFor("bot_1");
    const active = message(SOURCE);
    await expect(policy.authorize(active)).resolves.toBe(true);
    policy.onActiveMessages!([active]);

    c.invalidate("bot_1");
    await expect(c.proxyHeaders("bot_1")).rejects.toBeInstanceOf(TaskAuthorityRevokedError);
  });

  it("refuses child traffic for a mixed-principal turn", async () => {
    const { client: c } = client([allow()]);
    const policy = c.policyFor("bot_1");
    await expect(policy.authorize(message(SOURCE))).resolves.toBe(true);
    policy.onActiveMessages!([message(SOURCE), message({ ...OWNER_SOURCE })]);
    await expect(c.proxyHeaders("bot_1")).rejects.toBeInstanceOf(TaskAuthorityRevokedError);
  });
});
