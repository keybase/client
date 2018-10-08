// @flow
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as ConfigGen from '../../../../actions/config-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ListComponent from '.'
import {connect, type TypedState, compose, lifecycle, withStateHandlers} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  listScrollDownCounter: number,
  onFocusInput: () => void,
}

const mapStateToProps = (state: TypedState, {conversationIDKey}: OwnProps) => {
  const messageOrdinals = Constants.getMessageOrdinals(state, conversationIDKey)
  const lastOrdinal = messageOrdinals.last()
  let lastMessageIsOurs = false
  if (lastOrdinal) {
    const m = Constants.getMessage(state, conversationIDKey, lastOrdinal)
    lastMessageIsOurs = m && m.author === state.config.username
  }

  return {
    conversationIDKey,
    editingOrdinal: state.chat2.editingMap.get(conversationIDKey),
    lastMessageIsOurs,
    messageOrdinals,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}: OwnProps) => ({
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
  _loadMoreMessages: () => dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey})),
  _markInitiallyLoadedThreadAsRead: () =>
    dispatch(Chat2Gen.createMarkInitiallyLoadedThreadAsRead({conversationIDKey})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  copyToClipboard: dispatchProps.copyToClipboard,
  _loadMoreMessages: dispatchProps._loadMoreMessages,
  conversationIDKey: stateProps.conversationIDKey,
  editingOrdinal: stateProps.editingOrdinal,
  lastMessageIsOurs: stateProps.lastMessageIsOurs,
  listScrollDownCounter: ownProps.listScrollDownCounter,
  markInitiallyLoadedThreadAsRead: dispatchProps._markInitiallyLoadedThreadAsRead,
  messageOrdinals: stateProps.messageOrdinals.toList(),
  onFocusInput: ownProps.onFocusInput,
})

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  withStateHandlers(
    {
      _conversationIDKey: Constants.noConversationIDKey,
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
