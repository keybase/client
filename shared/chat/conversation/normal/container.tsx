import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Container from '../../../util/container'
import Normal from '.'
import type * as Types from '../../../constants/types/chat2'
import {indefiniteArticle} from '../../../util/string'

type Props = {conversationIDKey: Types.ConversationIDKey}

const NormalWrapper = React.memo(function NormalWrapper(props: Props) {
  const {conversationIDKey} = props
  const [focusInputCounter, setFocusInputCounter] = React.useState(0)
  const onFocusInput = React.useCallback(() => {
    setFocusInputCounter(focusInputCounter + 1)
  }, [setFocusInputCounter, focusInputCounter])

  const requestScrollDownRef = React.useRef<undefined | (() => void)>()
  const onRequestScrollDown = React.useCallback(() => {
    requestScrollDownRef.current?.()
  }, [])

  const requestScrollUpRef = React.useRef<undefined | (() => void)>()
  const onRequestScrollUp = React.useCallback(() => {
    requestScrollUpRef.current?.()
  }, [])

  const requestScrollToBottomRef = React.useRef<undefined | (() => void)>()
  const onRequestScrollToBottom = React.useCallback(() => {
    requestScrollToBottomRef.current?.()
  }, [])

  const threadLoadedOffline = Container.useSelector(
    state => Constants.getMeta(state, conversationIDKey).offline
  )
  const cannotWrite = Container.useSelector(state => Constants.getMeta(state, conversationIDKey).cannotWrite)
  const minWriterReason = Container.useSelector(state => {
    const {minWriterRole} = Constants.getMeta(state, conversationIDKey)
    return `You must be at least ${indefiniteArticle(minWriterRole)} ${minWriterRole} to post.`
  })
  const dragAndDropRejectReason = cannotWrite ? minWriterReason : undefined

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
      showThreadSearch={showThreadSearch}
      onFocusInput={onFocusInput}
      onRequestScrollDown={onRequestScrollDown}
      onRequestScrollUp={onRequestScrollUp}
      onRequestScrollToBottom={onRequestScrollToBottom}
      requestScrollToBottomRef={requestScrollToBottomRef}
      focusInputCounter={focusInputCounter}
      requestScrollDownRef={requestScrollDownRef}
      requestScrollUpRef={requestScrollUpRef}
      jumpToRecent={jumpToRecent}
      onPaste={onPaste}
      onToggleThreadSearch={onToggleThreadSearch}
      onShowTracker={onShowTracker}
      onAttach={cannotWrite ? null : onAttach}
    />
  )
})
export default NormalWrapper
