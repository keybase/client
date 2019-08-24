import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as ConfigGen from '../../../../actions/config-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import ListComponent from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  debug?: boolean
  onFocusInput: () => void
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
}

const mapStateToProps = (state: Container.TypedState, {conversationIDKey}: OwnProps) => {
  const messageOrdinals = Constants.getMessageOrdinals(state, conversationIDKey)
  const lastOrdinal = messageOrdinals.last(null)
  const maybeCenterMessage = Constants.getMessageCenterOrdinal(state, conversationIDKey)
  const centeredOrdinal =
    maybeCenterMessage === null || maybeCenterMessage === undefined ? undefined : maybeCenterMessage.ordinal
  const containsLatestMessage = state.chat2.containsLatestMessageMap.get(conversationIDKey, false)
  const showThreadSearch = Constants.getThreadSearchInfo(state, conversationIDKey).visible
  let lastMessageIsOurs = false
  if (lastOrdinal) {
    const m = Constants.getMessage(state, conversationIDKey, lastOrdinal)
    lastMessageIsOurs = !!m && m.author === state.config.username
  }

  return {
    centeredOrdinal,
    containsLatestMessage,
    conversationIDKey,
    editingOrdinal: state.chat2.editingMap.get(conversationIDKey),
    lastMessageIsOurs,
    messageOrdinals,
    showThreadSearch,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {conversationIDKey}: OwnProps) => ({
  _loadNewerMessages: () => dispatch(Chat2Gen.createLoadNewerMessagesDueToScroll({conversationIDKey})),
  _loadOlderMessages: () => dispatch(Chat2Gen.createLoadOlderMessagesDueToScroll({conversationIDKey})),
  _markInitiallyLoadedThreadAsRead: () =>
    dispatch(Chat2Gen.createMarkInitiallyLoadedThreadAsRead({conversationIDKey})),
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
  onJumpToRecent: () => dispatch(Chat2Gen.createJumpToRecent({conversationIDKey})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  _loadNewerMessages: dispatchProps._loadNewerMessages,
  _loadOlderMessages: dispatchProps._loadOlderMessages,
  centeredOrdinal: stateProps.centeredOrdinal,
  containsLatestMessage: stateProps.containsLatestMessage,
  conversationIDKey: stateProps.conversationIDKey,
  copyToClipboard: dispatchProps.copyToClipboard,
  editingOrdinal: stateProps.editingOrdinal,
  lastMessageIsOurs: stateProps.lastMessageIsOurs,
  markInitiallyLoadedThreadAsRead: dispatchProps._markInitiallyLoadedThreadAsRead,
  messageOrdinals: stateProps.messageOrdinals.toList(),
  onFocusInput: ownProps.onFocusInput,
  onJumpToRecent: dispatchProps.onJumpToRecent,
  scrollListDownCounter: ownProps.scrollListDownCounter,
  scrollListToBottomCounter: ownProps.scrollListToBottomCounter,
  scrollListUpCounter: ownProps.scrollListUpCounter,
  showThreadSearch: stateProps.showThreadSearch,
})

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

const loadMoreMessages = (state, props, loadFn) => ordinal => {
  if (
    state._conversationIDKey === props.conversationIDKey &&
    state._lastLoadMoreOrdinalTime + 1000 > Date.now()
  ) {
    // ignore a load if its too recent for the same ordinal
    return
  }

  loadFn()
  return {
    _conversationIDKey: props.conversationIDKey,
    _lastLoadMoreOrdinalTime: Date.now(),
    lastLoadMoreOrdinal: ordinal,
  }
}

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.withStateHandlers(
    {
      _conversationIDKey: Constants.noConversationIDKey,
      _lastLoadMoreOrdinalTime: Date.now(),
      lastLoadMoreOrdinal: null,
    } as any,
    {
      // We don't let you try and load more within a second. Used to use the ordinal but maybe we just never want a super quick load
      loadNewerMessages: (state, props) => loadMoreMessages(state, props, props._loadNewerMessages),
      loadOlderMessages: (state, props) => loadMoreMessages(state, props, props._loadOlderMessages),
    } as any
  ),
  Container.lifecycle({
    componentDidMount() {
      if (markedInitiallyLoaded) {
        return
      }
      markedInitiallyLoaded = true
      this.props.markInitiallyLoadedThreadAsRead()
    },
  } as any)
)(ListComponent)
