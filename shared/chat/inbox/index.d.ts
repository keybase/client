import * as React from 'react'
import * as T from '../../constants/types'

export type Props = {
  allowShowFloatingButton: boolean
  inboxNumSmallRows: number
  isSearching: boolean
  navKey: string
  neverLoaded: boolean
  onNewChat: () => void
  onUntrustedInboxVisible: (conversationIDKeys: Array<T.Chat.ConversationIDKey>) => void
  rows: Array<T.Chat.ChatInboxRowItem>
  setInboxNumSmallRows: (rows: number) => void
  smallTeamsExpanded: boolean
  toggleSmallTeamsExpanded: () => void
  unreadIndices: Map<number, number>
  unreadTotal: number
}

export default class Inbox extends React.Component<Props> {}
