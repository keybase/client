import * as React from 'react'
import * as I from 'immutable'
import {ConversationIDKey} from '../../constants/types/chat2'

export type RowItemSmall = {
  type: 'small'
  teamname: string
  isTeam: boolean
  conversationIDKey: ConversationIDKey
  time: number
  snippet?: string
  snippetDecoration?: string
}
export type RowItemBigTeamsLabel = {
  type: 'bigTeamsLabel'
  isFiltered: boolean
  isTeam?: boolean
  teamname?: never
  conversationIDKey?: never
  snippet?: string
  snippetDecoration?: string
  time?: number
}
export type RowItemBigHeader = {
  type: 'bigHeader'
  isTeam?: boolean
  teamname: string
  teamID: string
  conversationIDKey?: never
  snippet?: string
  snippetDecoration?: string
  time?: number
}
export type RowItemBig = {
  type: 'big'
  isTeam?: boolean
  conversationIDKey: ConversationIDKey
  teamname: string
  channelname: string
  snippet?: string
  snippetDecoration?: string
  time?: number
}
export type RowItemDivider = {
  conversationIDKey?: never
  teamname?: never
  showButton: boolean
  type: 'divider'
}

export type RowItem = RowItemSmall | RowItemBigTeamsLabel | RowItemBigHeader | RowItemBig | RowItemDivider

export type RouteState = I.RecordOf<{
  smallTeamsExpanded: boolean
}>

export type Props = {
  allowShowFloatingButton: boolean
  navKey: string
  neverLoaded: boolean
  onNewChat: () => void
  onUntrustedInboxVisible: (conversationIDKeys: Array<ConversationIDKey>) => void
  rows: Array<RowItem>
  smallTeamsExpanded: boolean
  toggleSmallTeamsExpanded: () => void
  unreadIndices: Array<number>
  isSearching: boolean
  isLoading: boolean
}

export default class Inbox extends React.Component<Props> {}
