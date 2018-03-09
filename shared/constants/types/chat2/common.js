// Used by meta/message/etc
// @flow
export opaque type ConversationIDKey: string = string
export const stringToConversationIDKey = (s: string): ConversationIDKey => s
export const conversationIDKeyToString = (c: ConversationIDKey): string => c
