// @flow
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as WaitingConstants from '../../../constants/waiting'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Normal from '.'
import {compose, connect, withStateHandlers} from '../../../util/container'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  isPending: boolean,
|}

const mapStateToProps = (state, {conversationIDKey, isPending}) => {
  const showLoader = WaitingConstants.anyWaiting(state, Constants.waitingKeyThreadLoad(conversationIDKey))
  const meta = Constants.getMeta(state, conversationIDKey)
  const isSearching = state.chat2.pendingMode === 'searchingForUsers' && isPending
  const giphyResults = state.chat2.giphyResultMap.get(conversationIDKey, [])
  const showGiphySearch = giphyResults.length > 0
  return {
    conversationIDKey,
    isPending,
    isSearching,
    showGiphySearch,
    showLoader,
    threadLoadedOffline: meta.offline,
  }
}

const mapDispatchToProps = dispatch => ({
  _onAttach: (conversationIDKey: Types.ConversationIDKey, paths: Array<string>) => {
    const pathAndOutboxIDs = paths.map(p => ({
      outboxID: null,
      path: p,
    }))
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey, pathAndOutboxIDs}, selected: 'chatAttachmentGetTitles'}],
      })
    )
  },
  _onPaste: (conversationIDKey: Types.ConversationIDKey, data: Buffer) =>
    dispatch(Chat2Gen.createAttachmentPasted({conversationIDKey, data})),
  onCancelSearch: () =>
    dispatch(Chat2Gen.createSetPendingMode({noneDestination: 'inbox', pendingMode: 'none'})),
  onShowTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: false, username})),
  onToggleInfoPanel: () => dispatch(Chat2Gen.createToggleInfoPanel()),
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    conversationIDKey: stateProps.conversationIDKey,
    isPending: stateProps.isPending,
    isSearching: stateProps.isSearching,
    onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
    onCancelSearch: dispatchProps.onCancelSearch,
    onPaste: (data: Buffer) => dispatchProps._onPaste(stateProps.conversationIDKey, data),
    onShowTracker: dispatchProps.onShowTracker,
    onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
    showGiphySearch: stateProps.showGiphySearch,
    showLoader: stateProps.showLoader,
    threadLoadedOffline: stateProps.threadLoadedOffline,
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  withStateHandlers(
    {focusInputCounter: 0, scrollListDownCounter: 0, scrollListUpCounter: 0},
    {
      onFocusInput: ({focusInputCounter}) => () => ({focusInputCounter: focusInputCounter + 1}),
      onRequestScrollDown: ({scrollListDownCounter}) => () => ({
        scrollListDownCounter: scrollListDownCounter + 1,
      }),
      onRequestScrollUp: ({scrollListUpCounter}) => () => ({scrollListUpCounter: scrollListUpCounter + 1}),
    }
  )
)(Normal)
