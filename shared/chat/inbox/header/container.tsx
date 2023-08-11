import * as C from '../../../constants'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import ChatInboxHeader from '.'
import {appendNewChatBuilder} from '../../../actions/typed-routes'

type OwnProps = {
  headerContext: 'chat-header' | 'inbox-header'
}

export default (ownProps: OwnProps) => {
  const hasLoadedEmptyInbox = Constants.useState(
    s =>
      s.inboxHasLoaded &&
      !!s.inboxLayout &&
      (s.inboxLayout.smallTeams || []).length === 0 &&
      (s.inboxLayout.bigTeams || []).length === 0
  )
  const showEmptyInbox = Constants.useState(s => !s.inboxSearch && hasLoadedEmptyInbox)
  const showStartNewChat = !Container.isMobile && showEmptyInbox
  const isSearching = Constants.useState(s => !!s.inboxSearch)
  const showFilter = !showEmptyInbox

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }

  const inboxSearchSelect = Constants.useState(s => s.dispatch.inboxSearchSelect)
  const inboxSearch = Constants.useState(s => s.dispatch.inboxSearch)
  const inboxSearchMoveSelectedIndex = Constants.useState(s => s.dispatch.inboxSearchMoveSelectedIndex)
  const onEnsureSelection = () => {
    inboxSearchSelect()
  }
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
