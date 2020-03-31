import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as WaitingConstants from '../../../constants/waiting'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Normal, {Props} from '.'
import * as Container from '../../../util/container'
import {indefiniteArticle} from '../../../util/string'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

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

    // on desktop on convo change focus input
    const {conversationIDKey} = props
    React.useEffect(() => {
      if (!Container.isMobile) {
        setFocusInputCounter(c => c + 1)
      }
    }, [conversationIDKey])

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
    _onToggleThreadSearch: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
    jumpToRecent: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createJumpToRecent({conversationIDKey})),
    onShowTracker: (username: string) => dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {conversationIDKey, _meta, showLoader, showThreadSearch} = stateProps
    const {cannotWrite, minWriterRole, offline} = _meta
    const {jumpToRecent, onShowTracker} = dispatchProps
    const {_onAttach, _onPaste, _onToggleThreadSearch} = dispatchProps
    return {
      conversationIDKey,
      dragAndDropRejectReason: cannotWrite
        ? `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
        : undefined,
      jumpToRecent: () => jumpToRecent(conversationIDKey),
      onAttach: cannotWrite ? null : (paths: Array<string>) => _onAttach(conversationIDKey, paths),
      onPaste: (data: Buffer) => _onPaste(conversationIDKey, data),
      onShowTracker,
      onToggleThreadSearch: () => _onToggleThreadSearch(conversationIDKey),
      showLoader,
      showThreadSearch,
      threadLoadedOffline: offline,
    }
  }
)(NormalWrapper)
