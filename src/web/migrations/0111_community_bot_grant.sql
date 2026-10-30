-- A grant lets a named person cause a specific bot to run work, for a bounded
-- time. The owner never needs a row: owner authority is implicit and so cannot
-- be expired, revoked by accident, or lost in a migration.
PRAGMA foreign_keys = ON;

CREATE TABLE community_bot_grant (
  id TEXT PRIMARY KEY NOT NULL,
  bot_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  grantee_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  granted_by_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  -- NULL means every channel the bot can read; a value narrows the grant.
  channel_id TEXT REFERENCES community_channel(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  -- A grant to yourself is meaningless; the owner already has authority.
  CHECK (grantee_user_id <> bot_user_id),
  CHECK (granted_by_user_id <> grantee_user_id)
);

CREATE INDEX idx_community_bot_grant_lookup
  ON community_bot_grant (bot_user_id, grantee_user_id, expires_at);

CREATE INDEX idx_community_bot_grant_grantee
  ON community_bot_grant (grantee_user_id, expires_at);

CREATE INDEX idx_community_bot_grant_bot_live
  ON community_bot_grant (bot_user_id, revoked_at, expires_at);
