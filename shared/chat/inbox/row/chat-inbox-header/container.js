// @flow
import * as Constants from '../../../../constants/chat2'
import {namedConnect} from '../../../../util/container'
import ChatInboxHeader from '.'

type OwnProps = {
  filterFocusCount: number,
  focusFilter: () => void,
  onEnsureSelection: () => void,
  onNewChat: () => void,
  onSelectDown: () => void,
  onSelectUp: () => void,
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  showNewChat:
    !state.chat2.inboxFilter &&
    state.chat2.inboxHasLoaded &&
    !state.chat2.metaMap.some((_, id) => Constants.isValidConversationIDKey(id)),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  filterFocusCount: ownProps.filterFocusCount,
  focusFilter: ownProps.focusFilter,
  onEnsureSelection: ownProps.onEnsureSelection,
  onNewChat: ownProps.onNewChat,
  onSelectDown: ownProps.onSelectDown,
  onSelectUp: ownProps.onSelectUp,
  showNewChat: stateProps.showNewChat,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  mergeProps,
  'ChatInboxHeaderContainer'
)(ChatInboxHeader)
