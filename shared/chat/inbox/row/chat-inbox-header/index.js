// @flow
import * as React from 'react'
import ChatFilterRow from '../chat-filter-row/container'
import StartNewChat from '../start-new-chat'

type Props = {
  filterFocusCount: number,
  focusFilter: () => void,
  onNewChat: () => void,
  showNewChat: boolean,
  onSelectUp: () => void,
  onSelectDown: () => void,
}

const ChatInboxHeader = (props: Props) =>
  props.showNewChat ? (
    <StartNewChat onNewChat={props.onNewChat} />
  ) : (
    <ChatFilterRow
      onNewChat={props.onNewChat}
      focusFilter={props.focusFilter}
      filterFocusCount={props.filterFocusCount}
      onSelectUp={props.onSelectUp}
      onSelectDown={props.onSelectDown}
    />
  )

export default ChatInboxHeader
