import * as RouterConstants from '../../../constants/router2'
import * as React from 'react'
import * as Constants from '../../../constants/chat2'
import * as TrackerConstants from '../../../constants/tracker2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import Normal from '.'
import type * as Types from '../../../constants/types/chat2'
import {indefiniteArticle} from '../../../util/string'
import shallowEqual from 'shallowequal'

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

  const {cannotWrite, minWriterReason, showThreadSearch, threadLoadedOffline} = Container.useSelector(
    state => {
      const meta = Constants.getMeta(state, conversationIDKey)
      const {cannotWrite, offline, minWriterRole} = meta
      const threadLoadedOffline = offline
      const showThreadSearch = Constants.getThreadSearchInfo(state, conversationIDKey)?.visible ?? false
      const minWriterReason = `You must be at least ${indefiniteArticle(
        minWriterRole
      )} ${minWriterRole} to post.`
      return {cannotWrite, minWriterReason, showThreadSearch, threadLoadedOffline}
    },
    shallowEqual
  )

  const dragAndDropRejectReason = cannotWrite ? minWriterReason : undefined

  const [lastCID, setLastCID] = React.useState(conversationIDKey)
  if (lastCID !== conversationIDKey) {
    setLastCID(conversationIDKey)
    if (!Container.isMobile) {
      setFocusInputCounter(c => c + 1)
    }
  }

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

  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
  const onShowTracker = React.useCallback(
    (username: string) => {
      showUser(username, true)
    },
    [showUser]
  )

  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onAttach = React.useCallback(
    (paths: Array<string>) => {
      const pathAndOutboxIDs = paths.map(p => ({path: p}))
      navigateAppend({props: {conversationIDKey, pathAndOutboxIDs}, selected: 'chatAttachmentGetTitles'})
    },
    [conversationIDKey, navigateAppend]
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
      onAttach={cannotWrite ? undefined : onAttach}
    />
  )
})
export default NormalWrapper
