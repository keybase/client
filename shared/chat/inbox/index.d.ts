import * as React from 'react'
import {ConversationIDKey} from '../../constants/types/chat2'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Types from '../../constants/types/chat2'

export type Props = {
  allowShowFloatingButton: boolean
  inboxNumSmallRows: number
  hasBigTeams: boolean
  isLoading: boolean
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
