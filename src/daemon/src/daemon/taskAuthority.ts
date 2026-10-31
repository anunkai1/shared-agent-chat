import { TaskSourceSchema, TaskSourceDecisionSchema, TASK_AUTHOR_HEADER, type TaskSource } from "@alook/shared";
import type { AgentExecutionPolicy, AgentMessage } from "@alook/agent-driver";

export class TaskAuthorityRevokedError extends Error {
  readonly code = "task_authority_revoked";
  constructor(message = "task_authority_revoked") {
    super(message);
    this.name = "TaskAuthorityRevokedError";
  }
}

export interface TaskAuthorityService {
  /** Admission check for an `agent:wake`; throws when the task is not authorised. */
  prepareWake(agentId: string, source: unknown): Promise<AgentMessage["authorization"]>;
  authorizeMessage(agentId: string, message: Pick<AgentMessage, "authorization">): Promise<boolean>;
  policyFor(agentId: string): AgentExecutionPolicy;
  /** Host-controlled headers for child traffic through the credential proxy. */
  proxyHeaders(agentId: string): Promise<Record<string, string>>;
  invalidate(agentId: string): void;
  setOwner(agentId: string, ownerUserId: string): void;
}

/**
 * Asks the server whether a task source still authorises work for a bot.
 *
 * The runner never decides authority locally. Two things are cached:
 *   - the bot's owner id, learned from the server (`/daemon/bots` and every
 *     successful check), used only to label a task as owner- or grant-sourced;
 *   - recent POSITIVE decisions, for at most `positiveTtlMs`.
 *
 * Nothing negative is cached and every cached decision is dropped by
 * `invalidate()` (the server's `agent:authority_changed` nudge) and by any
 * epoch bump that raced the request, so a revoked or expired task stops being
 * accepted within roughly one lease — never for the life of the process.
 */
export class TaskAuthorityClient implements TaskAuthorityService {
  private readonly epochs = new Map<string, number>();
  private readonly owners = new Map<string, string>();
  private readonly active = new Map<string, readonly AgentMessage[]>();
  private readonly positive = new Map<string, number>();
  private machineOwnerUserId?: string;

  constructor(
    private readonly options: {
      serverUrl: string;
      machineKey: string;
      fetch?: typeof fetch;
      timeoutMs?: number;
      positiveTtlMs?: number;
      now?: () => number;
    },
  ) {}

  setOwner(agentId: string, ownerUserId: string): void {
    this.owners.set(agentId, ownerUserId);
    this.machineOwnerUserId ??= ownerUserId;
  }

  invalidate(agentId: string): void {
    this.epochs.set(agentId, (this.epochs.get(agentId) ?? 0) + 1);
    for (const key of this.positive.keys()) if (key.startsWith(`${agentId}\u0000`)) this.positive.delete(key);
  }

  private ownerFor(agentId: string): string | undefined {
    return this.owners.get(agentId) ?? this.machineOwnerUserId;
  }

  private async check(agentId: string, source: TaskSource): Promise<boolean> {
    const cacheKey = `${agentId}\u0000${source.grantId ?? "owner"}\u0000${source.authorUserId}`;
    const now = this.options.now?.() ?? Date.now();
    const cachedAt = this.positive.get(cacheKey);
    if (cachedAt !== undefined && now - cachedAt < (this.options.positiveTtlMs ?? 1_000)) return true;

    const epoch = this.epochs.get(agentId) ?? 0;
    try {
      const response = await (this.options.fetch ?? fetch)(
        `${this.options.serverUrl}/api/community/daemon/task-authority`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${this.options.machineKey}`, "content-type": "application/json" },
          body: JSON.stringify({ botUserId: agentId, source }),
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 2_000),
        },
      );
      if (!response.ok) return false;
      const parsed = TaskSourceDecisionSchema.safeParse(await response.json());
      if (!parsed.success || !parsed.data.allowed) return false;
      // A revoke/expiry nudge that landed while this request was in flight wins:
      // its check must not be resurrected by our stale answer.
      if (epoch !== (this.epochs.get(agentId) ?? 0)) return false;
      this.setOwner(agentId, parsed.data.ownerUserId);
      this.positive.set(cacheKey, now);
      return true;
    } catch {
      return false;
    }
  }

  async prepareWake(agentId: string, value: unknown): Promise<NonNullable<AgentMessage["authorization"]>> {
    const parsed = TaskSourceSchema.safeParse(value);
    if (!parsed.success || !(await this.check(agentId, parsed.data))) throw new TaskAuthorityRevokedError();
    return {
      principal: parsed.data.grantId === null ? "owner" : `grant:${parsed.data.grantId}`,
      data: parsed.data,
    };
  }

  async authorizeMessage(agentId: string, message: Pick<AgentMessage, "authorization">): Promise<boolean> {
    const data = message.authorization?.data;
    const parsed = TaskSourceSchema.safeParse(data);
    if (!parsed.success) return false;
    const expectedPrincipal = parsed.data.grantId === null ? "owner" : `grant:${parsed.data.grantId}`;
    if (message.authorization!.principal !== expectedPrincipal) return false;
    if (parsed.data.grantId === null && parsed.data.expiresAt !== null) return false;
    return this.check(agentId, parsed.data);
  }

  policyFor(agentId: string): AgentExecutionPolicy {
    return {
      authorize: message => this.authorizeMessage(agentId, message),
      onActiveMessages: messages => {
        this.active.set(agentId, messages);
      },
      checkIntervalMs: 1_000,
    };
  }

  /**
   * Headers the credential proxy stamps on the child's own server calls.
   *
   * With an active task the child is narrowed to that task's initiating author
   * and refused outright once the task is no longer authorised. With NO active
   * task nothing is narrowed and nothing is refused: an idle kept-warm session
   * retains the ambient bot authority it always had (see SECURITY.md), which
   * this change neither creates nor closes.
   */
  async proxyHeaders(agentId: string): Promise<Record<string, string>> {
    const active = this.active.get(agentId);
    if (!active?.length) return {};
    const principals = new Set(active.map(message => message.authorization?.principal ?? "owner"));
    if (principals.size !== 1) throw new TaskAuthorityRevokedError("mixed task principals");
    if (!(await Promise.all(active.map(message => this.authorizeMessage(agentId, message)))).every(Boolean)) {
      throw new TaskAuthorityRevokedError();
    }
    const sources = active.map(message => TaskSourceSchema.safeParse(message.authorization?.data));
    const first = sources[0];
    const authorUserId = first?.success ? first.data.authorUserId : this.ownerFor(agentId);
    if (!authorUserId) throw new TaskAuthorityRevokedError("task author unavailable");
    if (sources.some(source => !source.success || source.data.authorUserId !== authorUserId)) {
      throw new TaskAuthorityRevokedError("mixed task authors");
    }
    return { [TASK_AUTHOR_HEADER.toLowerCase()]: authorUserId };
  }
}
