import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as WaitingConstants from '../../../constants/waiting'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import Normal from '.'
import * as Container from '../../../util/container'
import {indefiniteArticle} from '../../../util/string'

type Props = {conversationIDKey: Types.ConversationIDKey}

const NormalWrapper = React.memo((props: Props) => {
  const {conversationIDKey} = props
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

  const threadLoadedOffline = Container.useSelector(
    state => Constants.getMeta(state, conversationIDKey).offline
  )
  const cannotWrite = Container.useSelector(state => Constants.getMeta(state, conversationIDKey).cannotWrite)
  const minWriterReason = Container.useSelector(state => {
    const {minWriterRole} = Constants.getMeta(state, conversationIDKey)
    return `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
  })
  const dragAndDropRejectReason = cannotWrite ? minWriterReason : undefined

  const showLoader = Container.useSelector(state =>
    WaitingConstants.anyWaiting(
      state,
      Constants.waitingKeyThreadLoad(conversationIDKey),
      Constants.waitingKeyInboxSyncStarted
    )
  )

  const showThreadSearch = Container.useSelector(
    state => Constants.getThreadSearchInfo(state, conversationIDKey).visible
  )

  React.useEffect(() => {
    if (!Container.isMobile) {
      setFocusInputCounter(c => c + 1)
    }
  }, [conversationIDKey])

  const dispatch = Container.useDispatch()
  const jumpToRecent = React.useCallback(() => {
    dispatch(Chat2Gen.createJumpToRecent({conversationIDKey}))
  }, [conversationIDKey, dispatch])

  const onPaste = React.useCallback(
    (data: Buffer) => {
      dispatch(Chat2Gen.createAttachmentPasted({conversationIDKey, data}))
    },
    [conversationIDKey, dispatch]
  )

  const onToggleThreadSearch = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
  }, [conversationIDKey, dispatch])

  const onShowTracker = React.useCallback(
    (username: string) => {
      dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    },
    [dispatch]
  )

  const onAttach = React.useCallback(
    (paths: Array<string>) => {
      const pathAndOutboxIDs = paths.map(p => ({outboxID: null, path: p}))
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, pathAndOutboxIDs}, selected: 'chatAttachmentGetTitles'}],
        })
      )
    },
    [conversationIDKey, dispatch]
  )

  return (
    <Normal
      conversationIDKey={conversationIDKey}
      dragAndDropRejectReason={dragAndDropRejectReason}
      threadLoadedOffline={threadLoadedOffline}
      showLoader={showLoader}
      showThreadSearch={showThreadSearch}
      onFocusInput={onFocusInput}
      onRequestScrollDown={onRequestScrollDown}
      onRequestScrollToBottom={onRequestScrollToBottom}
      onRequestScrollUp={onRequestScrollUp}
      focusInputCounter={focusInputCounter}
      scrollListDownCounter={scrollListDownCounter}
      scrollListToBottomCounter={scrollListToBottomCounter}
      scrollListUpCounter={scrollListUpCounter}
      jumpToRecent={jumpToRecent}
      onPaste={onPaste}
      onToggleThreadSearch={onToggleThreadSearch}
      onShowTracker={onShowTracker}
      onAttach={cannotWrite ? null : onAttach}
    />
  )
})
export default NormalWrapper
