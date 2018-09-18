// @flow
import * as React from 'react'
import type {RowItem} from '../../index.types'
import ChatFilterRow from '../chat-filter-row/container'
import StartNewChat from '../start-new-chat'

type Props = {
  filterFocusCount: number,
  focusFilter: () => void,
  onNewChat: () => void,
  neverLoaded: boolean,
  rows: Array<RowItem>,
  showNewChat: boolean,
}

const ChatInboxHeader = (props: Props) =>
  props.showNewChat && !props.neverLoaded ? (
    <StartNewChat onNewChat={props.onNewChat} />
  ) : (
    <ChatFilterRow
      onNewChat={props.onNewChat}
      focusFilter={props.focusFilter}
      filterFocusCount={props.filterFocusCount}
      rows={props.rows}
    />
  )

export default ChatInboxHeader
