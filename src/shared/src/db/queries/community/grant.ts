import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { communityBotGrant } from "../../community-grant-schema";
import { user } from "../../schema";
import type { Database } from "../../index";
import type { TaskGrant } from "../../../community/task-authority";

/**
 * Grants are read on every wake decision and every bot-facing page, so the
 * predicates here are intentionally narrow: no joins, no formatting, one index
 * per access path.
 */

const MAX_GRANT_MS = 24 * 60 * 60 * 1000;

export type GrantRow = TaskGrant & {
  readonly id: string;
  readonly botUserId: string;
  readonly grantedByUserId: string;
  readonly createdAt: string;
};

/**
 * Live grants for one bot: the list the authority rule needs, and nothing more.
 * Expiry is filtered here AND re-checked by the rule itself, because a caller
 * that forgets `nowMs` must not widen the grant set.
 */
export async function listActiveGrantsForBot(
  db: Database,
  botUserId: string,
  nowIso: string
): Promise<GrantRow[]> {
  const rows = await db
    .select({
      id: communityBotGrant.id,
      botUserId: communityBotGrant.botUserId,
      granteeUserId: communityBotGrant.granteeUserId,
      grantedByUserId: communityBotGrant.grantedByUserId,
      channelId: communityBotGrant.channelId,
      expiresAt: communityBotGrant.expiresAt,
      revokedAt: communityBotGrant.revokedAt,
      createdAt: communityBotGrant.createdAt,
    })
    .from(communityBotGrant)
    .where(
      and(
        eq(communityBotGrant.botUserId, botUserId),
        isNull(communityBotGrant.revokedAt),
        gt(communityBotGrant.expiresAt, nowIso)
      )
    );
  return rows;
}

/** Every grant for a bot, including dead ones, so the owner can see history. */
export async function listGrantsForBot(db: Database, botUserId: string): Promise<GrantRow[]> {
  return db
    .select({
      id: communityBotGrant.id,
      botUserId: communityBotGrant.botUserId,
      granteeUserId: communityBotGrant.granteeUserId,
      grantedByUserId: communityBotGrant.grantedByUserId,
      channelId: communityBotGrant.channelId,
      expiresAt: communityBotGrant.expiresAt,
      revokedAt: communityBotGrant.revokedAt,
      createdAt: communityBotGrant.createdAt,
    })
    .from(communityBotGrant)
    .where(eq(communityBotGrant.botUserId, botUserId))
    .orderBy(desc(communityBotGrant.createdAt));
}

export async function createGrant(
  db: Database,
  input: {
    botUserId: string;
    granteeUserId: string;
    grantedByUserId: string;
    channelId?: string | null;
    expiresAt: string;
  }
): Promise<GrantRow> {
  if (input.granteeUserId === input.botUserId) {
    throw new Error("cannot grant task authority to the bot itself");
  }
  if (input.granteeUserId === input.grantedByUserId) {
    throw new Error("the owner already holds authority");
  }
  const ttlMs = Date.parse(input.expiresAt) - Date.now();
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("grant expiry must be in the future");
  }
  if (ttlMs > MAX_GRANT_MS) {
    throw new Error("grant expiry is too far in the future");
  }
  const [row] = await db
    .insert(communityBotGrant)
    .values({
      botUserId: input.botUserId,
      granteeUserId: input.granteeUserId,
      grantedByUserId: input.grantedByUserId,
      channelId: input.channelId ?? null,
      expiresAt: input.expiresAt,
    })
    .returning({
      id: communityBotGrant.id,
      botUserId: communityBotGrant.botUserId,
      granteeUserId: communityBotGrant.granteeUserId,
      grantedByUserId: communityBotGrant.grantedByUserId,
      channelId: communityBotGrant.channelId,
      expiresAt: communityBotGrant.expiresAt,
      revokedAt: communityBotGrant.revokedAt,
      createdAt: communityBotGrant.createdAt,
    });
  if (!row) throw new Error("grant insert returned no row");
  return row;
}

/**
 * Scoped by bot so a caller cannot revoke somebody else's grant by id alone:
 * the ownership check and the write are one statement, not a read then a write.
 */
export async function revokeGrant(
  db: Database,
  input: { grantId: string; botUserId: string; nowIso: string }
): Promise<boolean> {
  const rows = await db
    .update(communityBotGrant)
    .set({ revokedAt: input.nowIso })
    .where(
      and(
        eq(communityBotGrant.id, input.grantId),
        eq(communityBotGrant.botUserId, input.botUserId),
        isNull(communityBotGrant.revokedAt)
      )
    )
    .returning({ id: communityBotGrant.id });
  return rows.length > 0;
}

/**
 * Who may receive a grant. Rejects a bot outright: authority granted to a person
 * must not be inherited by their agents, so a bot can never be the grantee.
 * Returns null for a missing or soft-deleted user so the route can answer 404
 * without distinguishing the two.
 */
export async function findGrantCandidate(
  db: Database,
  userId: string
): Promise<{ id: string; isBot: boolean } | null> {
  const rows = await db
    .select({ id: user.id, isBot: user.isBot, deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) return null;
  return { id: row.id, isBot: row.isBot };
}
