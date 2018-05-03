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
  withStateHandlers,
} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  onFocusInput: () => void,
}

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
  _loadMoreMessages: dispatchProps._loadMoreMessages,
  conversationIDKey: stateProps.conversationIDKey,
  editingOrdinal: stateProps.editingOrdinal,
  markInitiallyLoadedThreadAsRead: dispatchProps._markInitiallyLoadedThreadAsRead,
  messageOrdinals: stateProps.messageOrdinals.toList(),
  onFocusInput: ownProps.onFocusInput,
})

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    {
      _conversationIDKey: null,
      _lastLoadMoreOrdinalTime: Date.now(),
      lastLoadMoreOrdinal: null,
    },
    {
      // We don't let you try and load more within a second. Used to use the ordinal but maybe we just never want a super quick load
      loadMoreMessages: (state, props) => ordinal => {
        if (state._conversationIDKey === props.conversationIDKey) {
          if (state._lastLoadMoreOrdinalTime + 1000 > Date.now()) {
            // ignore a load if its too recent for the same ordinal
            return
          }
        }

        props._loadMoreMessages()
        return {
          _conversationIDKey: props.conversationIDKey,
          _lastLoadMoreOrdinalTime: Date.now(),
          lastLoadMoreOrdinal: ordinal,
        }
      },
    }
  ),
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
