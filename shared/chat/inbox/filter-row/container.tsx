import * as C from '../../../constants'
import ConversationFilterInput from '.'

type OwnProps = {
  onEnsureSelection: () => void
  onNewChat: () => void
  onSelectDown: () => void
  onSelectUp: () => void
  onQueryChanged: (arg0: string) => void
  query: string
  showNewChat: boolean
  showSearch: boolean
}

export default (ownProps: OwnProps) => {
  const filter = ownProps.query
  const isSearching = C.useChatState(s => !!s.inboxSearch)

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const toggleInboxSearch = C.useChatState(s => s.dispatch.toggleInboxSearch)
  const onStartSearch = () => {
    toggleInboxSearch(true)
  }
  const onStopSearch = () => {
    toggleInboxSearch(false)
  }
  const props = {
    appendNewChatBuilder,
    filter,
    isSearching,
    onBack: onBack,
    onEnsureSelection: ownProps.onEnsureSelection,
    onNewChat: ownProps.showNewChat ? ownProps.onNewChat : null,
    onSelectDown: ownProps.onSelectDown,
    onSelectUp: ownProps.onSelectUp,
    onSetFilter: ownProps.onQueryChanged,
    onStartSearch: onStartSearch,
    onStopSearch: onStopSearch,
    showNewChat: ownProps.showNewChat,
    showSearch: ownProps.showSearch,
  }
  return <ConversationFilterInput {...props} />
}
