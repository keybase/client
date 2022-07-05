// Used by meta/message/etc
export type ConversationIDKey = string
export const stringToConversationIDKey = __DEV__
  ? (s: string): ConversationIDKey => {
      if (!s) {
        throw new Error('Invalid empty converationidkey. Did you mean Constants.noConversationIDKey?')
      }
      return s
    }
  : (s: string): ConversationIDKey => s

export const conversationIDKeyToString = (c: ConversationIDKey): string => c

// No conversation
export const noConversationIDKey = stringToConversationIDKey('EMPTY')
// A pending conversation that we're looking for a real convo or noConvo but don't know yet
export const pendingWaitingConversationIDKey = stringToConversationIDKey('PENDING-WAITING')
// We tried to create a conversation but it failed with an error
export const pendingErrorConversationIDKey = stringToConversationIDKey('PENDING-ERROR')

export const isValidConversationIDKey = (id: ConversationIDKey): boolean =>
  !!id &&
  id !== noConversationIDKey &&
  id !== pendingWaitingConversationIDKey &&
  id !== pendingErrorConversationIDKey
