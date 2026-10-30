import { NO_TASK_AUTHORITY_TEXT, type CommunityMessageResource, type TaskAuthorityCheck } from "@alook/shared"

export function redactBotMessage(message: CommunityMessageResource, authority: TaskAuthorityCheck): CommunityMessageResource {
  const { replyTo, embeds: _embeds, thread, ...rest } = message
  const mayRead = authority.mayTask(message.authorId, message.channelId)
  const mayReadQuote = mayRead && replyTo?.authorId !== undefined &&
    authority.mayTask(replyTo.authorId, message.channelId)
  return {
    ...rest,
    ...(thread ? { thread: { ...thread, preview: undefined } } : {}),
    content: mayRead ? message.content : NO_TASK_AUTHORITY_TEXT,
    attachments: mayRead ? message.attachments : [],
    replyToId: mayReadQuote ? message.replyToId : null,
    ...(mayReadQuote ? { replyTo } : {}),
  }
}
