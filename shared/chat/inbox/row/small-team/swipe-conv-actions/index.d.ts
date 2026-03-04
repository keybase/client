import type * as React from 'react'
import type {ConversationIDKey} from '@/constants/types/chat'
export type Props = {
  children: React.ReactNode
  conversationIDKey: ConversationIDKey
  isMuted: boolean
  onPress?: () => void
}
declare const SwipeConvActions: (p: Props) => React.ReactNode
export default SwipeConvActions
