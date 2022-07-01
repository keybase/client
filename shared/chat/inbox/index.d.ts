import * as React from 'react'
import {ConversationIDKey} from '../../constants/types/chat2'
import * as Types from '../../constants/types/chat2'

export type Props = {
  allowShowFloatingButton: boolean
  inboxNumSmallRows: number
  isSearching: boolean
  navKey: string
  neverLoaded: boolean
  onNewChat: () => void
  onUntrustedInboxVisible: (conversationIDKeys: Array<ConversationIDKey>) => void
  rows: Array<Types.ChatInboxRowItem>
  setInboxNumSmallRows: (rows: number) => void
  smallTeamsExpanded: boolean
  toggleSmallTeamsExpanded: () => void
  unreadIndices: Map<number, number>
  unreadTotal: number
}

export default class Inbox extends React.Component<Props> {}
