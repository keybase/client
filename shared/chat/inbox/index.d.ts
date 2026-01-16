import type * as React from 'react'
import type * as T from '@/constants/types'
import type {ChatInboxRowItem} from './rowitem'

export type Props = {
  allowShowFloatingButton: boolean
  selectedConversationIDKey: T.Chat.ConversationIDKey
  inboxNumSmallRows: number
  isSearching: boolean
  navKey: string
  neverLoaded: boolean
  onNewChat: () => void
  onUntrustedInboxVisible: (conversationIDKeys: Array<T.Chat.ConversationIDKey>) => void
  rows: Array<ChatInboxRowItem>
  setInboxNumSmallRows: (rows: number) => void
  smallTeamsExpanded: boolean
  toggleSmallTeamsExpanded: () => void
  unreadIndices: Map<number, number>
  unreadTotal: number
}

declare const Inbox: (p: Props) => React.ReactNode
export default Inbox
