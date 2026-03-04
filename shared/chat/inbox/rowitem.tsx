import type {ConversationIDKey} from '@/constants/types/chat'
import type * as T from '@/constants/types'

export type InboxSmallTeamRow = {
  type: 'small'
  conversationIDKey: ConversationIDKey
  teamname: string
  isTeam: boolean
  participants: ReadonlyArray<string>
  snippet: string
  snippetDecoration: T.RPCChat.SnippetDecoration
  typingSnippet: string
  timestamp: number
  isMuted: boolean
  isLocked: boolean
  badge: number
  unread: number
  draft: string
  hasResetUsers: boolean
  youNeedToRekey: boolean
  youAreReset: boolean
  participantNeedToRekey: boolean
  trustedState: string
}

export type InboxBigChannelRow = {
  type: 'big'
  conversationIDKey: ConversationIDKey
  teamname: string
  channelname: string
  badge: number
  unread: number
  isMuted: boolean
  hasDraft: boolean
  isError: boolean
  snippetDecoration: number
}

export type InboxBigHeaderRow = {
  type: 'bigHeader'
  teamname: string
  teamID: string
}

export type InboxDividerRow = {
  type: 'divider'
  showButton: boolean
  badgeCount: number
  hiddenCount: number
}

export type InboxTeamBuilderRow = {
  type: 'teamBuilder'
}

export type ChatInboxRowItem =
  | InboxSmallTeamRow
  | InboxBigChannelRow
  | InboxBigHeaderRow
  | InboxDividerRow
  | InboxTeamBuilderRow

export type ChatInboxRowType = ChatInboxRowItem['type']
