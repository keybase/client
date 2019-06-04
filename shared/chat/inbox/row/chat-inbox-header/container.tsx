import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Constants from '../../../../constants/chat2'
import {namedConnect} from '../../../../util/container'
import ChatInboxHeader from '.'
import HiddenString from '../../../../util/hidden-string'

type OwnProps = {
  onNewChat: () => void
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  isSearching: !!state.chat2.inboxSearch,
  showNewChat:
    !state.chat2.inboxSearch &&
    state.chat2.inboxHasLoaded &&
    !state.chat2.metaMap.some((_, id) => Constants.isValidConversationIDKey(id)),
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onEnsureSelection: () => dispatch(Chat2Gen.createInboxSearchSelect({})),
  onQueryChanged: query => dispatch(Chat2Gen.createInboxSearch({query: new HiddenString(query)})),
  onSelectDown: () => dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: true})),
  onSelectUp: () => dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: false})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isSearching: stateProps.isSearching,
  onBack: dispatchProps.onBack,
  onEnsureSelection: dispatchProps.onEnsureSelection,
  onNewChat: ownProps.onNewChat,
  onQueryChanged: dispatchProps.onQueryChanged,
  onSelectDown: dispatchProps.onSelectDown,
  onSelectUp: dispatchProps.onSelectUp,
  showNewChat: stateProps.showNewChat,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ChatInboxHeaderContainer')(
  ChatInboxHeader
)
