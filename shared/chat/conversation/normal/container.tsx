import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as WaitingConstants from '../../../constants/waiting'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {isDarwin} from '../../../constants/platform'
import Normal, {Props} from '.'
import * as Container from '../../../util/container'
import {indefiniteArticle} from '../../../util/string'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const hotkeys = [`${isDarwin ? 'command' : 'ctrl'}+f`]

const NormalWrapper = React.memo(
  (
    props: Omit<
      Props,
      | 'onFocusInput'
      | 'onRequestScrollDown'
      | 'onRequestScrollToBottom'
      | 'onRequestScrollUp'
      | 'focusInputCounter'
      | 'scrollListDownCounter'
      | 'scrollListToBottomCounter'
      | 'scrollListUpCounter'
    >
  ) => {
    const [focusInputCounter, setFocusInputCounter] = React.useState(0)
    const [scrollListDownCounter, setScrollListDownCounter] = React.useState(0)
    const [scrollListToBottomCounter, setScrollListToBottomCounter] = React.useState(0)
    const [scrollListUpCounter, setScrollListUpCounter] = React.useState(0)
    const onFocusInput = React.useCallback(() => {
      setFocusInputCounter(focusInputCounter + 1)
    }, [setFocusInputCounter, focusInputCounter])
    const onRequestScrollDown = React.useCallback(() => {
      setScrollListDownCounter(scrollListDownCounter + 1)
    }, [setScrollListDownCounter, scrollListDownCounter])
    const onRequestScrollToBottom = React.useCallback(() => {
      setScrollListToBottomCounter(scrollListToBottomCounter + 1)
    }, [setScrollListToBottomCounter, scrollListToBottomCounter])
    const onRequestScrollUp = React.useCallback(() => {
      setScrollListUpCounter(scrollListUpCounter + 1)
    }, [setScrollListUpCounter, scrollListUpCounter])

    return (
      <Normal
        {...props}
        onFocusInput={onFocusInput}
        onRequestScrollDown={onRequestScrollDown}
        onRequestScrollToBottom={onRequestScrollToBottom}
        onRequestScrollUp={onRequestScrollUp}
        focusInputCounter={focusInputCounter}
        scrollListDownCounter={scrollListDownCounter}
        scrollListToBottomCounter={scrollListToBottomCounter}
        scrollListUpCounter={scrollListUpCounter}
      />
    )
  }
)

export default Container.connect(
  (state, {conversationIDKey}: OwnProps) => {
    const showLoader = WaitingConstants.anyWaiting(
      state,
      Constants.waitingKeyThreadLoad(conversationIDKey),
      Constants.waitingKeyInboxSyncStarted
    )
    const showThreadSearch = Constants.getThreadSearchInfo(state, conversationIDKey).visible
    return {
      _meta: Constants.getMeta(state, conversationIDKey),
      conversationIDKey,
      showLoader,
      showThreadSearch,
    }
  },
  dispatch => ({
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
    jumpToRecent: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createJumpToRecent({conversationIDKey})),
    onHotkey: (conversationIDKey: Types.ConversationIDKey, cmd: string) => {
      const letter = cmd.replace(/(command|ctrl)\+/, '')
      switch (letter) {
        case 'f':
          dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
      }
    },
    onShowTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
    onToggleInfoPanel: () => dispatch(Chat2Gen.createToggleInfoPanel()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    conversationIDKey: stateProps.conversationIDKey,
    dragAndDropRejectReason: stateProps._meta.cannotWrite
      ? `You must be at least ${indefiniteArticle(stateProps._meta.minWriterRole)} ${
          stateProps._meta.minWriterRole
        } to post.`
      : undefined,
    hotkeys,
    jumpToRecent: () => dispatchProps.jumpToRecent(stateProps.conversationIDKey),
    onAttach: stateProps._meta.cannotWrite
      ? null
      : (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
    onHotkey: (cmd: string) => dispatchProps.onHotkey(stateProps.conversationIDKey, cmd),
    onPaste: (data: Buffer) => dispatchProps._onPaste(stateProps.conversationIDKey, data),
    onShowTracker: dispatchProps.onShowTracker,
    onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
    showLoader: stateProps.showLoader,
    showThreadSearch: stateProps.showThreadSearch,
    threadLoadedOffline: stateProps._meta.offline,
  })
)(NormalWrapper)
