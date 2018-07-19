// @flow
import * as React from 'react'
import * as Inbox from '../..'
import ChatFilterRow from '../chat-filter-row/container'
import StartNewChat from '../start-new-chat'

type Props = {
  onNewChat: () => void,
  filterFocusCount: number,
  focusFilter: () => void,
  isLoading: boolean,
  rows: Array<Inbox.RowItem>,
  showNewChat: boolean,
}

const ChatInboxHeader = (props: Props) =>
  props.showNewChat && !props.isLoading ? (
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
