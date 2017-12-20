// Used by meta/message/etc
// @flow

// TODO put back
// export opaque type ConversationIDKey: string = string
export type ConversationIDKey = string
export const stringToConversationIDKey = (s: string): ConversationIDKey => s
