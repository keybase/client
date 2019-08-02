import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as WaitingConstants from '../../../constants/waiting'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {isDarwin} from '../../../constants/platform'
import Normal from '.'
import {compose, connect, isMobile, withStateHandlers} from '../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

let KeyHandler: any = c => c
if (!isMobile) {
  KeyHandler = require('../../../util/key-handler.desktop').default
}

const mapStateToProps = (state, {conversationIDKey}) => {
  const showLoader = WaitingConstants.anyWaiting(
    state,
    Constants.waitingKeyThreadLoad(conversationIDKey),
    Constants.waitingKeyInboxSyncStarted
  )
  const meta = Constants.getMeta(state, conversationIDKey)
  return {
    conversationIDKey,
    showLoader,
    threadLoadedOffline: meta.offline,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}) => ({
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
  jumpToRecent: () => dispatch(Chat2Gen.createJumpToRecent({conversationIDKey})),
  onHotkey: (cmd: string) => {
    const letter = cmd.replace(/(command|ctrl)\+/, '')
    switch (letter) {
      case 'f':
        dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
    }
  },
  onShowTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  onToggleInfoPanel: () => dispatch(Chat2Gen.createToggleInfoPanel()),
})

const hotkeys = [`${isDarwin ? 'command' : 'ctrl'}+f`]

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => {
  return {
    conversationIDKey: stateProps.conversationIDKey,
    hotkeys,
    jumpToRecent: dispatchProps.jumpToRecent,
    onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
    onHotkey: dispatchProps.onHotkey,
    onPaste: (data: Buffer) => dispatchProps._onPaste(stateProps.conversationIDKey, data),
    onShowTracker: dispatchProps.onShowTracker,
    onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
    showLoader: stateProps.showLoader,
    threadLoadedOffline: stateProps.threadLoadedOffline,
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  withStateHandlers(
    {focusInputCounter: 0, scrollListDownCounter: 0, scrollListToBottomCounter: 0, scrollListUpCounter: 0},
    {
      onFocusInput: ({focusInputCounter}) => () => ({focusInputCounter: focusInputCounter + 1}),
      onRequestScrollDown: ({scrollListDownCounter}) => () => ({
        scrollListDownCounter: scrollListDownCounter + 1,
      }),
      onRequestScrollToBottom: ({scrollListToBottomCounter}) => () => ({
        scrollListToBottomCounter: scrollListToBottomCounter + 1,
      }),
      onRequestScrollUp: ({scrollListUpCounter}) => () => ({scrollListUpCounter: scrollListUpCounter + 1}),
    }
  )
)(KeyHandler(Normal)) as any
