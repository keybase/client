import type {ConversationIDKey} from '@/constants/types/chat'

export type InboxSmallTeamRow = {
  type: 'small'
  conversationIDKey: ConversationIDKey
}

export type InboxBigChannelRow = {
  type: 'big'
  conversationIDKey: ConversationIDKey
}

export type InboxBigHeaderRow = {
  type: 'bigHeader'
  teamname: string
  teamID: string
}

export type InboxDividerRow = {
  type: 'divider'
  showButton: boolean
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
