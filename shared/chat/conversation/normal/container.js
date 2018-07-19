// @flow
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import * as RouteTree from '../../../actions/route-tree'
import Normal from '.'
import {compose, connect, withStateHandlers, type TypedState} from '../../../util/container'
import {chatTab} from '../../../constants/tabs'

const mapStateToProps = (state: TypedState, {conversationIDKey}) => {
  const showLoader = !!state.waiting.get(Constants.waitingKeyThreadLoad(conversationIDKey))
  const meta = Constants.getMeta(state, conversationIDKey)
  const infoPanelOpen = Constants.isInfoPanelOpen(state)
  const isSearching =
    state.chat2.pendingMode === 'searchingForUsers' &&
    conversationIDKey === Constants.pendingConversationIDKey
  return {conversationIDKey, infoPanelOpen, isSearching, showLoader, threadLoadedOffline: meta.offline}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onAttach: (conversationIDKey: Types.ConversationIDKey, paths: Array<string>) =>
    dispatch(
      RouteTree.navigateAppend([{props: {conversationIDKey, paths}, selected: 'attachmentGetTitles'}])
    ),
  _onToggleInfoPanel: (isOpen: boolean, conversationIDKey: Types.ConversationIDKey) => {
    if (isOpen) {
      dispatch(RouteTree.navigateTo(['conversation'], [chatTab]))
    } else {
      dispatch(RouteTree.navigateAppend([{props: {conversationIDKey}, selected: 'infoPanel'}]))
    }
  },
  onCancelSearch: () =>
    dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'none', noneDestination: 'inbox'})),
  onShowTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: false, username})),
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    conversationIDKey: stateProps.conversationIDKey,
    infoPanelOpen: stateProps.infoPanelOpen,
    isSearching: stateProps.isSearching,
    onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
    onCancelSearch: dispatchProps.onCancelSearch,
    onShowTracker: dispatchProps.onShowTracker,
    onToggleInfoPanel: () =>
      dispatchProps._onToggleInfoPanel(stateProps.infoPanelOpen, stateProps.conversationIDKey),
    showLoader: stateProps.showLoader,
    threadLoadedOffline: stateProps.threadLoadedOffline,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    {focusInputCounter: 0, listScrollDownCounter: 0},
    {
      onFocusInput: ({focusInputCounter}) => () => ({focusInputCounter: focusInputCounter + 1}),
      onScrollDown: ({listScrollDownCounter}) => () => ({listScrollDownCounter: listScrollDownCounter + 1}),
    }
  )
)(Normal)
