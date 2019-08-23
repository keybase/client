import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Constants from '../../../../constants/chat2'
import {namedConnect, isMobile} from '../../../../util/container'
import ChatInboxHeader from '.'
import HiddenString from '../../../../util/hidden-string'
import {appendNewChatBuilder} from '../../../../actions/typed-routes'

const mapStateToProps = state => {
  const hasLoadedEmptyInbox =
    state.chat2.inboxHasLoaded && !state.chat2.metaMap.some((_, id) => Constants.isValidConversationIDKey(id))
  const showEmptyInbox = !state.chat2.inboxSearch && hasLoadedEmptyInbox
  return {
    isSearching: !!state.chat2.inboxSearch,
    showFilter: !showEmptyInbox,
    showNewChat: !isMobile && showEmptyInbox,
  }
}

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onEnsureSelection: () => dispatch(Chat2Gen.createInboxSearchSelect({})),
  onNewChat: () => dispatch(appendNewChatBuilder()),
  onQueryChanged: query => dispatch(Chat2Gen.createInboxSearch({query: new HiddenString(query)})),
  onSelectDown: () => dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: true})),
  onSelectUp: () => dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: false})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  isSearching: stateProps.isSearching,
  onBack: dispatchProps.onBack,
  onEnsureSelection: dispatchProps.onEnsureSelection,
  onNewChat: dispatchProps.onNewChat,
  onQueryChanged: dispatchProps.onQueryChanged,
  onSelectDown: dispatchProps.onSelectDown,
  onSelectUp: dispatchProps.onSelectUp,
  showFilter: stateProps.showFilter,
  showNewChat: stateProps.showNewChat,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ChatInboxHeaderContainer')(
  ChatInboxHeader
)
