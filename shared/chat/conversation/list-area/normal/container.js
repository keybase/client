// @flow
import * as Types from '../../../../constants/types/chat2'
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

type OwnProps = {conversationIDKey: Types.ConversationIDKey, onFocusInput: () => void}

const mapStateToProps = (state: TypedState, {conversationIDKey}: OwnProps) => ({
  conversationIDKey,
  editingOrdinal: state.chat2.editingMap.get(conversationIDKey),
  messageOrdinals: Constants.getMessageOrdinals(state, conversationIDKey),
})

type DispatchProps = {
  _loadMoreMessages: () => void,
  _markInitiallyLoadedThreadAsRead: () => void,
}
const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}: OwnProps): DispatchProps => ({
  _loadMoreMessages: () => dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey})),
  _markInitiallyLoadedThreadAsRead: () =>
    dispatch(Chat2Gen.createMarkInitiallyLoadedThreadAsRead({conversationIDKey})),
})

const mergeProps = (stateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => ({
  conversationIDKey: stateProps.conversationIDKey,
  editingOrdinal: stateProps.editingOrdinal,
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
