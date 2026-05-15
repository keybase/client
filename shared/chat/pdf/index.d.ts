import type * as React from 'react'
import type * as T from '@/constants/types'

export type Props = {
  conversationIDKey?: T.Chat.ConversationIDKey
  messageID: T.Chat.MessageID
  url?: string
}
declare const ChatPDF: (p: Props) => React.ReactNode
export default ChatPDF
