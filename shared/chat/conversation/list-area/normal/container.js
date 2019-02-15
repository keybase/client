// @flow
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as ConfigGen from '../../../../actions/config-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import ListComponent from '.'
import {connect, compose, lifecycle, withStateHandlers} from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey,
  onFocusInput: () => void,
  scrollListDownCounter: number,
  scrollListUpCounter: number,
}

const mapStateToProps = (state, {conversationIDKey}: OwnProps) => {
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
  _loadMoreMessages: () => dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey})),
  _markInitiallyLoadedThreadAsRead: () =>
    dispatch(Chat2Gen.createMarkInitiallyLoadedThreadAsRead({conversationIDKey})),
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  _loadMoreMessages: dispatchProps._loadMoreMessages,
  conversationIDKey: stateProps.conversationIDKey,
  copyToClipboard: dispatchProps.copyToClipboard,
  editingOrdinal: stateProps.editingOrdinal,
  lastMessageIsOurs: stateProps.lastMessageIsOurs,
  markInitiallyLoadedThreadAsRead: dispatchProps._markInitiallyLoadedThreadAsRead,
  messageOrdinals: stateProps.messageOrdinals.toList(),
  onFocusInput: ownProps.onFocusInput,
  scrollListDownCounter: ownProps.scrollListDownCounter,
  scrollListUpCounter: ownProps.scrollListUpCounter,
})

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  withStateHandlers(
    // $FlowIssue don't use recompose
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
