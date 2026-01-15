import type {ConversationIDKey} from '@/constants/types/chat2'
import type * as T from '@/constants/types'

export type ChatInboxRowItemSmall = {
  type: 'small'
  teamname: string
  isTeam: boolean
  conversationIDKey: ConversationIDKey
  time: number
  snippet?: string
  snippetDecoration: T.RPCChat.SnippetDecoration
}
export type ChatInboxRowItemBigTeamsLabel = {
  type: 'bigTeamsLabel'
  isFiltered: boolean
  isTeam?: boolean
  teamname?: never
  conversationIDKey?: never
  snippet?: string
  snippetDecoration: T.RPCChat.SnippetDecoration
  time?: number
}
export type ChatInboxRowItemBigHeader = {
  conversationIDKey?: never
  type: 'bigHeader'
  isTeam?: boolean
  teamname: string
  teamID: string
  snippet?: string
  snippetDecoration: T.RPCChat.SnippetDecoration
  time?: number
}
export type ChatInboxRowItemBig = {
  type: 'big'
  isTeam?: boolean
  conversationIDKey: ConversationIDKey
  teamname: string
  channelname: string
  snippet?: string
  snippetDecoration: T.RPCChat.SnippetDecoration
  time?: number
}
export type ChatInboxRowItemDivider = {
  conversationIDKey?: never
  teamname?: never
  showButton: boolean
  type: 'divider'
}
export type ChatInboxRowItemTeamBuilder = {
  conversationIDKey?: never
  teamname?: never
  type: 'teamBuilder'
}

export type ChatInboxRowItem =
  | ChatInboxRowItemSmall
  | ChatInboxRowItemBigTeamsLabel
  | ChatInboxRowItemBigHeader
  | ChatInboxRowItemBig
  | ChatInboxRowItemDivider
  | ChatInboxRowItemTeamBuilder

export type ChatInboxRowType = ChatInboxRowItem['type']
