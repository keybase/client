// @flow
import * as React from 'react'
import ChatFilterRow from '../chat-filter-row/container'
import StartNewChat from '../start-new-chat'

type Props = {
  isSearching: boolean,
  onCancel: () => void,
  onNewChat: () => void,
  showNewChat: boolean,
  onSelectUp: () => void,
  onSelectDown: () => void,
  onEnsureSelection: () => void,
  onQueryChanged: string => void,
}

type State = {
  filterFocusCount: number,
  query: string,
}

class ChatInboxHeader extends React.Component<Props, State> {
  state = {
    filterFocusCount: 0,
    query: '',
  }
  _focusFilter = () => {
    this.setState(p => ({filterFocusCount: p.filterFocusCount + 1}))
  }
  _setQuery = query => {
    this.setState({query})
    this.props.onQueryChanged(query)
  }
  _onCancel = () => {
    this.setState({query: ''})
    this.props.onCancel()
  }
  componentDidUpdate(prevProps: Props) {
    if (prevProps.isSearching && !this.props.isSearching) {
      this.setState({query: ''})
    }
  }
  render() {
    return this.props.showNewChat ? (
      <StartNewChat onNewChat={this.props.onNewChat} />
    ) : (
      <ChatFilterRow
        onCancel={this._onCancel}
        onNewChat={this.props.onNewChat}
        focusFilter={this._focusFilter}
        filterFocusCount={this.state.filterFocusCount}
        onSelectUp={this.props.onSelectUp}
        onSelectDown={this.props.onSelectDown}
        onEnsureSelection={this.props.onEnsureSelection}
        onQueryChanged={this._setQuery}
        query={this.state.query}
      />
    )
  }
}

export default ChatInboxHeader
