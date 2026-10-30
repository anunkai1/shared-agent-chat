import { describe, expect, it } from "vitest"
import { CommunityMessageResourceSchema, createTaskAuthority, NO_TASK_AUTHORITY_TEXT } from "@alook/shared"
import { redactBotMessage } from "./bot-message-policy"

const message = (authorId = "owner") => CommunityMessageResourceSchema.parse({
  id:"reply",channelId:"channel",seq:2,authorId,createdAt:"2026-10-31T00:00:00Z",type:"chat",content:"Owner reply",
  replyToId:"quoted",clientNonce:null,attachments:[],
  replyTo:{id:"quoted",authorId:"stranger",authorName:"Stranger",text:"UNAUTHORISED_QUOTE"},
  embeds:[{description:"UNPROVENANCED_EMBED"}],
  thread:{id:"thread",name:"Thread",messageCount:1,preview:"UNPROVENANCED_PREVIEW"},
})
const authority = createTaskAuthority({botOwnerUserId:"owner",grants:[]})
describe("bot enriched message policy", () => {
  it("removes another author's quote even when the outer message is owner-authored", () => {
    const result = redactBotMessage(message(),authority)
    expect(result.content).toBe("Owner reply")
    expect(result.replyToId).toBeNull()
    expect(JSON.stringify(result)).not.toContain("UNAUTHORISED_QUOTE")
    expect(JSON.stringify(result)).not.toContain("UNPROVENANCED")
    expect(CommunityMessageResourceSchema.safeParse(result).success).toBe(true)
  })
  it("retains an owner-authored quote", () => {
    const row=message(); row.replyTo!.authorId="owner"
    expect(redactBotMessage(row,authority).replyTo?.text).toBe("UNAUTHORISED_QUOTE")
  })
  it("withholds all outer actionable content for an unauthorised sender", () => {
    const result=redactBotMessage(message("stranger"),authority)
    expect(result.content).toBe(NO_TASK_AUTHORITY_TEXT)
    expect(result.replyToId).toBeNull()
    expect(result.attachments).toEqual([])
  })
  it.each([true,false])("rechecks revoked/expired quoted authors: revoked=%s", (revoked) => {
    const check=createTaskAuthority({botOwnerUserId:"owner",grants:[{granteeUserId:"stranger",channelId:null,expiresAt:new Date(Date.now()+(revoked?60000:-60000)).toISOString(),revokedAt:revoked?new Date().toISOString():null}]})
    expect(redactBotMessage(message(),check).replyTo).toBeUndefined()
  })
  it("does not mutate the original message", () => {
    const row=message(); redactBotMessage(row,authority)
    expect(row.replyTo?.text).toBe("UNAUTHORISED_QUOTE")
  })
})
