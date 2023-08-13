import * as C from '../../../constants'
import {appendNewChatBuilder} from '../../../actions/typed-routes'
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
  const _appendNewChatBuilder = () => {
    appendNewChatBuilder()
  }
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
    appendNewChatBuilder: _appendNewChatBuilder,
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
