import type * as React from 'react'
import type * as T from '@/constants/types'

export type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  initialMessage?: T.Chat.MessageAttachment
  ordinal: T.Chat.Ordinal
  showHeader?: boolean
}
declare const Fullscreen: (p: Props) => React.ReactNode
export default Fullscreen
