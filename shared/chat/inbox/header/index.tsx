import * as React from 'react'
import ChatFilterRow from '../filter-row/container'
import StartNewChat from '../row/start-new-chat'

type Props = {
  isSearching: boolean
  onBack: () => void
  onNewChat: () => void
  showFilter: boolean
  showNewChat: boolean
  showSearch: boolean
  showStartNewChat: boolean
  onSelectUp: () => void
  onSelectDown: () => void
  onEnsureSelection: () => void
  onQueryChanged: (arg0: string) => void
}

type State = {
  query: string
}

class ChatInboxHeader extends React.Component<Props, State> {
  state = {
    query: '',
  }
  _setQuery = (query: string) => {
    this.setState({query})
    this.props.onQueryChanged(query)
  }
  componentDidUpdate(prevProps: Props) {
    if (prevProps.isSearching && !this.props.isSearching) {
      this.setState({query: ''})
    }
  }
  render() {
    return (
      <>
        {!!this.props.showStartNewChat && (
          <StartNewChat onBack={this.props.onBack} onNewChat={this.props.onNewChat} />
        )}
        {!!this.props.showFilter && (
          <ChatFilterRow
            onNewChat={this.props.onNewChat}
            onSelectUp={this.props.onSelectUp}
            onSelectDown={this.props.onSelectDown}
            onEnsureSelection={this.props.onEnsureSelection}
            onQueryChanged={this._setQuery}
            query={this.state.query}
            showNewChat={this.props.showNewChat}
            showSearch={this.props.showSearch}
          />
        )}
      </>
    )
  }
}

export default ChatInboxHeader
