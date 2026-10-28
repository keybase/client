// A conversation ID key (the app's and the chat API's id) is the hex of the ConversationID bytes the
// chat RPCs take.
export const convIDBytes = (conversationIDKey: string) => {
  if (!/^(?:[0-9a-f]{2})+$/.test(conversationIDKey)) throw new Error(`not a conversation ID key: ${conversationIDKey}`)
  return Buffer.from(conversationIDKey, 'hex')
}
