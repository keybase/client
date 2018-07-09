// @flow
import * as React from 'react'
import {isDarwin} from '../../../../constants/platform'
import ChatFilterRow from '../chat-filter-row'
import StartNewChat from '../start-new-chat'

type Props = {
  filter: string,
  filterFocusCount: number,
  isLoading: boolean,
  onHotkey: (cmd: string) => void,
  onNewChat: () => void,
  onSelectDown: () => void,
  onSelectUp: () => void,
  onSetFilter: (filter: string) => void,
  showNewChat: boolean,
}

const ChatInboxHeader = (props: Props) =>
  props.showNewChat ? (
    <StartNewChat onNewChat={props.onNewChat} />
  ) : (
    <ChatFilterRow
      isLoading={props.isLoading}
      filter={props.filter}
      onNewChat={props.onNewChat}
      onSetFilter={props.onSetFilter}
      hotkeys={isDarwin ? ['command+n', 'command+k'] : ['ctrl+n', 'ctrl+k']}
      onHotkey={props.onHotkey}
      filterFocusCount={props.filterFocusCount}
      onSelectUp={props.onSelectUp}
      onSelectDown={props.onSelectDown}
    />
  )

export default ChatInboxHeader
