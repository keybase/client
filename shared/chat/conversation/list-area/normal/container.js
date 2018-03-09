// @flow
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ListComponent from '.'
import {
  connect,
  type TypedState,
  type Dispatch,
  compose,
  lifecycle,
  isMobile,
} from '../../../../util/container'

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  const hasExtraRow = !meta.resetParticipants.isEmpty() || !!meta.supersededBy || !!meta.wasFinalizedBy
  return {
    conversationIDKey,
    hasExtraRow,
    messageOrdinals: Constants.getMessageOrdinals(state, conversationIDKey),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  _loadMoreMessages: () => dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey})),
  _markInitiallyLoadedThreadAsRead: () =>
    dispatch(Chat2Gen.createMarkInitiallyLoadedThreadAsRead({conversationIDKey})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  conversationIDKey: stateProps.conversationIDKey,
  hasExtraRow: stateProps.hasExtraRow,
  loadMoreMessages: dispatchProps._loadMoreMessages,
  markInitiallyLoadedThreadAsRead: dispatchProps._markInitiallyLoadedThreadAsRead,
  messageOrdinals: isMobile
    ? stateProps.messageOrdinals.toList().reverse()
    : stateProps.messageOrdinals.toList(),
  onFocusInput: ownProps.onFocusInput,
})

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      if (markedInitiallyLoaded) {
        return
      }
      markedInitiallyLoaded = true
      this.props.markInitiallyLoadedThreadAsRead()
    },
  })
)(ListComponent)
