// @flow
import * as Constants from '../../../../constants/chat2'
import {connect, compose, setDisplayName} from '../../../../util/container'
import ChatInboxHeader from '.'

type OwnProps = {
  onNewChat: () => void,
  filterFocusCount: number,
  focusFilter: () => void,
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
  onNewChat: ownProps.onNewChat,
  showNewChat: stateProps.showNewChat,
  onSelectUp: ownProps.onSelectUp,
  onSelectDown: ownProps.onSelectDown,
})

export default compose(
  connect(
    mapStateToProps,
    () => ({}),
    mergeProps
  ),
  setDisplayName('ChatInboxHeaderContainer')
)(ChatInboxHeader)
