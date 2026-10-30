import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import { user } from "./schema";
import { communityChannel } from "./community-schema";

// community_bot_grant — delegated task authority. One row lets one named person
// cause one bot to run work until `expiresAt`, optionally only inside one
// channel. The owner is deliberately absent: owner authority is implicit, so it
// cannot be expired, revoked by mistake or left behind by a failed migration.
//
// Hand-maintained in lockstep with migration 0111 (no drizzle-kit generate in
// this repo).
export const communityBotGrant = sqliteTable(
  "community_bot_grant",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    botUserId: text("bot_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    granteeUserId: text("grantee_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    grantedByUserId: text("granted_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channelId: text("channel_id").references(() => communityChannel.id, {
      onDelete: "cascade",
    }),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_community_bot_grant_lookup").on(t.botUserId, t.granteeUserId, t.expiresAt),
    index("idx_community_bot_grant_grantee").on(t.granteeUserId, t.expiresAt),
  ]
);
