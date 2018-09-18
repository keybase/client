// Used by meta/message/etc
// @flow strict

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

// A pending conversation
export const pendingConversationIDKey = stringToConversationIDKey('PENDING')
// No conversation
export const noConversationIDKey = stringToConversationIDKey('EMPTY')
// A pending conversation that we're looking for a real convo or noConvo but don't know yet
export const pendingWaitingConversationIDKey = stringToConversationIDKey('PENDING-WAITING')

export const isValidConversationIDKey = (id: ConversationIDKey) =>
  id &&
  id !== pendingConversationIDKey &&
  id !== noConversationIDKey &&
  id !== pendingWaitingConversationIDKey
