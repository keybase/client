import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {namedConnect, isMobile, isTablet} from '../../../util/container'
import ChatInboxHeader from '.'
import HiddenString from '../../../util/hidden-string'
import {appendNewChatBuilder} from '../../../actions/typed-routes'

type OwnProps = {
  context: 'chat-header' | 'inbox-header'
}

export default namedConnect(
  state => {
    const hasLoadedEmptyInbox =
      state.chat2.inboxHasLoaded &&
      !!state.chat2.inboxLayout &&
      (state.chat2.inboxLayout.smallTeams || []).length === 0 &&
      (state.chat2.inboxLayout.bigTeams || []).length === 0
    const showEmptyInbox = !state.chat2.inboxSearch && hasLoadedEmptyInbox
    const showStartNewChat = !isMobile && showEmptyInbox
    return {
      isSearching: !!state.chat2.inboxSearch,
      showFilter: !showEmptyInbox,
      showStartNewChat,
    }
  },
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onEnsureSelection: () => dispatch(Chat2Gen.createInboxSearchSelect({})),
    onNewChat: () => dispatch(appendNewChatBuilder()),
    onQueryChanged: (query: string) => dispatch(Chat2Gen.createInboxSearch({query: new HiddenString(query)})),
    onSelectDown: () => dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: true})),
    onSelectUp: () => dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: false})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    isSearching: stateProps.isSearching,
    onBack: dispatchProps.onBack,
    onEnsureSelection: dispatchProps.onEnsureSelection,
    onNewChat: dispatchProps.onNewChat,
    onQueryChanged: dispatchProps.onQueryChanged,
    onSelectDown: dispatchProps.onSelectDown,
    onSelectUp: dispatchProps.onSelectUp,
    showFilter: stateProps.showFilter,
    showNewChat: ownProps.context == 'chat-header',
    showSearch: ownProps.context == 'chat-header' ? !isTablet : isMobile,
    showStartNewChat: stateProps.showStartNewChat,
  }),
  'ChatInboxHeaderContainer'
)(ChatInboxHeader)
