import * as C from '../../../constants'
import * as Container from '../../../util/container'
import ChatInboxHeader from '.'

type OwnProps = {
  headerContext: 'chat-header' | 'inbox-header'
}

export default (ownProps: OwnProps) => {
  const hasLoadedEmptyInbox = C.useChatState(
    s =>
      s.inboxHasLoaded &&
      !!s.inboxLayout &&
      (s.inboxLayout.smallTeams || []).length === 0 &&
      (s.inboxLayout.bigTeams || []).length === 0
  )
  const showEmptyInbox = C.useChatState(s => !s.inboxSearch && hasLoadedEmptyInbox)
  const showStartNewChat = !Container.isMobile && showEmptyInbox
  const isSearching = C.useChatState(s => !!s.inboxSearch)
  const showFilter = !showEmptyInbox

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }

  const inboxSearchSelect = C.useChatState(s => s.dispatch.inboxSearchSelect)
  const inboxSearch = C.useChatState(s => s.dispatch.inboxSearch)
  const inboxSearchMoveSelectedIndex = C.useChatState(s => s.dispatch.inboxSearchMoveSelectedIndex)
  const onEnsureSelection = () => {
    inboxSearchSelect()
  }

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const onNewChat = () => {
    appendNewChatBuilder()
  }
  const onQueryChanged = inboxSearch
  const onSelectDown = () => {
    inboxSearchMoveSelectedIndex(true)
  }
  const onSelectUp = () => {
    inboxSearchMoveSelectedIndex(false)
  }
  const props = {
    isSearching: isSearching,
    onBack: onBack,
    onEnsureSelection: onEnsureSelection,
    onNewChat: onNewChat,
    onQueryChanged: onQueryChanged,
    onSelectDown: onSelectDown,
    onSelectUp: onSelectUp,
    showFilter: showFilter,
    showNewChat: ownProps.headerContext == 'chat-header',
    showSearch: ownProps.headerContext == 'chat-header' ? !Container.isTablet : Container.isMobile,
    showStartNewChat: showStartNewChat,
  }
  return <ChatInboxHeader {...props} />
}
