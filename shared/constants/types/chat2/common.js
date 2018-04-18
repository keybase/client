// Used by meta/message/etc
// @flow

export opaque type ConversationIDKey: string = string
export const stringToConversationIDKey = __DEV__
  ? (s: string): ConversationIDKey => {
      if (!s) {
        throw new Error('Invalid empty converationidkey. Did you mean Constants.noConversationIDKey?')
      }
      return s
    }
  : (s: string): ConversationIDKey => s

export const conversationIDKeyToString = (c: ConversationIDKey): string => c

export const pendingConversationIDKey = stringToConversationIDKey('PENDING')
export const noConversationIDKey = stringToConversationIDKey('EMPTY')
