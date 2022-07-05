import {ConversationIDKey} from '../../../constants/types/chat2'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'

export type ChatInboxRowItemSmall = {
  type: 'small'
  teamname: string
  isTeam: boolean
  conversationIDKey: ConversationIDKey
  selected: boolean
  time: number
  snippet?: string
  snippetDecoration: RPCChatTypes.SnippetDecoration
}
export type ChatInboxRowItemBigTeamsLabel = {
  type: 'bigTeamsLabel'
  isFiltered: boolean
  isTeam?: boolean
  teamname?: never
  conversationIDKey?: never
  snippet?: string
  snippetDecoration: RPCChatTypes.SnippetDecoration
  time?: number
}
export type ChatInboxRowItemBigHeader = {
  type: 'bigHeader'
  isTeam?: boolean
  teamname: string
  teamID: string
  conversationIDKey?: never
  snippet?: string
  snippetDecoration: RPCChatTypes.SnippetDecoration
  time?: number
}
export type ChatInboxRowItemBig = {
  type: 'big'
  isTeam?: boolean
  conversationIDKey: ConversationIDKey
  selected: boolean
  teamname: string
  channelname: string
  snippet?: string
  snippetDecoration: RPCChatTypes.SnippetDecoration
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
