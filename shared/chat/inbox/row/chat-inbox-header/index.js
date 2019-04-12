// @flow
import * as React from 'react'
import ChatFilterRow from '../chat-filter-row/container'
import StartNewChat from '../start-new-chat'

type Props = {
  onNewChat: () => void,
  showNewChat: boolean,
  onSelectUp: () => void,
  onSelectDown: () => void,
  onEnsureSelection: () => void,
}

type State = {
  filterFocusCount: number,
}

class ChatInboxHeader extends React.Component<Props, State> {
  state = {
    filterFocusCount: 0,
  }
  _focusFilter = () => {
    this.setState(p => ({filterFocusCount: p.filterFocusCount + 1}))
  }
  render() {
    return this.props.showNewChat ? (
      <StartNewChat onNewChat={this.props.onNewChat} />
    ) : (
      <ChatFilterRow
        onCancel={this.props.onCancel}
        onNewChat={this.props.onNewChat}
        focusFilter={this._focusFilter}
        filterFocusCount={this.state.filterFocusCount}
        onSelectUp={this.props.onSelectUp}
        onSelectDown={this.props.onSelectDown}
        onEnsureSelection={this.props.onEnsureSelection}
      />
    )
  }
}

export default ChatInboxHeader
