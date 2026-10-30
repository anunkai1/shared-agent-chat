import { describe, expect, it } from "vitest";
import { TaskGrantRequestSchema } from "./task-grant-request";

describe("task grant request", () => {
  it.each([null, [], 123, {}, {granteeUserId:"friend",channelId:123}, {granteeUserId:"friend",channelId:""}, {granteeUserId:"friend",channelId:"  "}, {granteeUserId:"friend",minutes:0}, {granteeUserId:"friend",minutes:1441}, {granteeUserId:"friend",minutes:1.5}, {granteeUserId:"friend",extra:true}])("rejects malformed requests: %j", (body) => {
    expect(TaskGrantRequestSchema.safeParse(body).success).toBe(false);
  });
  it("defaults only omitted duration and preserves an explicit channel", () => {
    expect(TaskGrantRequestSchema.parse({granteeUserId:"friend",channelId:"channel"})).toEqual({granteeUserId:"friend",channelId:"channel",minutes:30});
  });
  it.each([{}, {channelId:null}])("permits an explicitly unrestricted grant: %j", (scope) => {
    expect(TaskGrantRequestSchema.safeParse({granteeUserId:"friend",...scope}).success).toBe(true);
  });
});
