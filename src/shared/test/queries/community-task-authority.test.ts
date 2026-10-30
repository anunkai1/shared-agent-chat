import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { communityWriteDb } from "../helpers/community-write-db";
import { createGrant, revokeGrant } from "../../src/db/queries/community/grant";
import { createAttachment, getReadableAttachmentById } from "../../src/db/queries/community/attachment";
import { createMessage } from "../../src/db/queries/community/message";
import { getLatestUnreadMessageForAgent } from "../../src/db/queries/community/agent-inbox";

describe("task authority across actual SQLite content queries", () => {
  let f: ReturnType<typeof communityWriteDb>;
  beforeEach(() => {
    f = communityWriteDb();
    f.sqlite.exec(`
      INSERT INTO user(id) VALUES ('stranger');
      UPDATE user SET isBot=1, ownerUserId='author' WHERE id='peer';
      UPDATE community_channel SET server_id='server' WHERE id='channel';
      ALTER TABLE community_server_member ADD COLUMN joined_at TEXT NOT NULL DEFAULT '2000-01-01';
      INSERT INTO community_server_member(id,server_id,user_id) VALUES ('peer-member','server','peer'), ('owner-member','server','author');
      CREATE TABLE community_notification_setting(id TEXT, user_id TEXT, server_id TEXT, channel_id TEXT,level TEXT);
    `);
  });
  afterEach(() => f.sqlite.close());
  const upload = () => createAttachment(f.db, { id: "file", uploaderId: "stranger", filename: "instructions.txt", r2Key: "bytes" });
  const grant = (channelId: string | null = null) => createGrant(f.db, {
    botUserId: "peer", granteeUserId: "stranger", grantedByUserId: "author", channelId,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  const postFile = () => createMessage(f.db, {
    authorId: "stranger", content: "instructions", channelId: "channel", attachmentIds: ["file"],
  });
  const readFile = () => getReadableAttachmentById(f.db, "file", "peer");

  it("withholds a membership-readable attachment until a grant, then denies known IDs after revoke", async () => {
    await upload();
    await postFile();
    expect(await getReadableAttachmentById(f.db, "file", "author")).not.toBeNull();
    expect(await readFile()).toBeNull();
    const g = await grant();
    expect(await readFile()).not.toBeNull();
    await revokeGrant(f.db, { grantId: g.id, botUserId: "peer", nowIso: new Date().toISOString() });
    expect(await readFile()).toBeNull();
  });
  it("accepts an authorised readable association for a forwarded file", async () => {
    await upload();
    await postFile();
    await createMessage(f.db, { authorId: "author", content: "approved copy", channelId: "channel", attachmentIds: ["file"] });
    expect(await readFile()).not.toBeNull();
  });
  it("denies attachment reuse by a bot until a current grant authorises it", async () => {
    await upload();
    await postFile();
    const forward = () => createMessage(f.db, {
      authorId: "peer", content: "forward", channelId: "channel", attachmentIds: ["file"],
    });
    await expect(forward()).rejects.toThrow();
    const g = await grant();
    await expect(forward()).resolves.toBeDefined();
    await revokeGrant(f.db, { grantId: g.id, botUserId: "peer", nowIso: new Date().toISOString() });
    await expect(forward()).rejects.toThrow();
  });
  it("preserves own-upload access", async () => {
    await createAttachment(f.db, { id: "own", uploaderId: "peer", filename: "own.txt", r2Key: "bytes" });
    expect(await getReadableAttachmentById(f.db, "own", "peer")).not.toBeNull();
  });
  it("denies ownerless bots access through someone else's message", async () => {
    await upload();
    await postFile();
    f.sqlite.exec("UPDATE user SET ownerUserId=NULL WHERE id='peer'");
    expect(await readFile()).toBeNull();
  });
  it("denies expired and wrong-channel attachment grants", async () => {
    await upload();
    await postFile();
    f.sqlite.exec("INSERT INTO community_channel(id,type,created_at) VALUES ('other','text','now')");
    const g = await grant("other");
    expect(await readFile()).toBeNull();
    f.sqlite.prepare("UPDATE community_bot_grant SET channel_id=NULL,expires_at=? WHERE id=?")
      .run(new Date(Date.now() - 1000).toISOString(), g.id);
    expect(await readFile()).toBeNull();
  });
  it("reconnect selects older owner work rather than a newer unauthorised unread", async () => {
    const owner = await createMessage(f.db, { authorId: "author", content: "owner task", channelId: "channel", createdAt: "2026-01-01T00:00:01Z" });
    const stranger = await createMessage(f.db, { authorId: "stranger", content: "newer", channelId: "channel", createdAt: "2026-01-01T00:00:02Z" });
    const latest = () => getLatestUnreadMessageForAgent(f.db, "peer", { accessVisibleChannelIds: ["channel"] });
    expect(await latest()).toEqual({ messageId: owner.id });
    const g = await grant();
    expect(await latest()).toEqual({ messageId: stranger.id });
    f.sqlite.prepare("UPDATE community_bot_grant SET expires_at=? WHERE id=?")
      .run(new Date(Date.now() - 1000).toISOString(), g.id);
    expect(await latest()).toEqual({ messageId: owner.id });
  });
});
