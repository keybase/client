import type * as React from 'react'
import type * as T from '../../../constants/types'

export type Props = {
  conversationIDKey: T.Chat.ConversationIDKey // needed by page
  ordinal: T.Chat.Ordinal
}
declare const Fullscreen: (p: Props) => React.ReactNode
export default Fullscreen
