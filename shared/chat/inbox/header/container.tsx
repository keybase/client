import * as React from 'react'
import * as C from '../../../constants'
import * as Container from '../../../util/container'
import ChatInboxHeader from '.'

type OwnProps = {
  headerContext: 'chat-header' | 'inbox-header'
}

export default React.memo(function ChatHeaderContainer(ownProps: OwnProps) {
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
  const onBack = React.useCallback(() => {
    navigateUp()
  }, [navigateUp])

  const inboxSearchSelect = C.useChatState(s => s.dispatch.inboxSearchSelect)
  const inboxSearch = C.useChatState(s => s.dispatch.inboxSearch)
  const inboxSearchMoveSelectedIndex = C.useChatState(s => s.dispatch.inboxSearchMoveSelectedIndex)
  const onEnsureSelection = React.useCallback(() => {
    inboxSearchSelect()
  }, [inboxSearchSelect])

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const onNewChat = React.useCallback(() => {
    appendNewChatBuilder()
  }, [appendNewChatBuilder])
  const onQueryChanged = inboxSearch
  const onSelectDown = React.useCallback(() => {
    inboxSearchMoveSelectedIndex(true)
  }, [inboxSearchMoveSelectedIndex])
  const onSelectUp = React.useCallback(() => {
    inboxSearchMoveSelectedIndex(false)
  }, [inboxSearchMoveSelectedIndex])
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
})
