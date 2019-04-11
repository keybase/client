// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import {namedConnect} from '../../../../util/container'
import ChatInboxHeader from '.'

type OwnProps = {
  filterFocusCount: number,
  focusFilter: () => void,
  onEnsureSelection: () => void,
  onNewChat: () => void,
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  showNewChat:
    !state.chat2.inboxFilter &&
    state.chat2.inboxHasLoaded &&
    !state.chat2.metaMap.some((_, id) => Constants.isValidConversationIDKey(id)),
})

const mapDispatchToProps = dispatch => ({
  onSelectDown: () => dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: true})),
  onSelectUp: () => dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: false})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  filterFocusCount: ownProps.filterFocusCount,
  focusFilter: ownProps.focusFilter,
  onEnsureSelection: ownProps.onEnsureSelection,
  onNewChat: ownProps.onNewChat,
  onSelectDown: dispatchProps.onSelectDown,
  onSelectUp: dispatchProps.onSelectUp,
  showNewChat: stateProps.showNewChat,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ChatInboxHeaderContainer'
)(ChatInboxHeader)
