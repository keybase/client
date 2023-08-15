import * as C from '../../../constants'
import * as React from 'react'
import * as Container from '../../../util/container'
import Normal from '.'
import {indefiniteArticle} from '../../../util/string'
import shallowEqual from 'shallowequal'

const NormalWrapper = React.memo(function NormalWrapper() {
  const conversationIDKey = C.useChatContext(s => s.id)
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

  const showThreadSearch = C.useChatContext(s => s.threadSearchInfo.visible)
  const {cannotWrite, minWriterReason, threadLoadedOffline} = C.useChatContext(s => {
    const meta = s.meta
    const {cannotWrite, offline, minWriterRole} = meta
    const threadLoadedOffline = offline
    const minWriterReason = `You must be at least ${indefiniteArticle(
      minWriterRole
    )} ${minWriterRole} to post.`
    return {cannotWrite, minWriterReason, threadLoadedOffline}
  }, shallowEqual)

  const dragAndDropRejectReason = cannotWrite ? minWriterReason : undefined

  const [lastCID, setLastCID] = React.useState(conversationIDKey)
  if (lastCID !== conversationIDKey) {
    setLastCID(conversationIDKey)
    if (!Container.isMobile) {
      setFocusInputCounter(c => c + 1)
    }
  }

  const jumpToRecent = C.useChatContext(s => s.dispatch.jumpToRecent)
  const onPaste = C.useChatContext(s => s.dispatch.attachmentPasted)
  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const onToggleThreadSearch = React.useCallback(() => {
    toggleThreadSearch()
  }, [toggleThreadSearch])

  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const onShowTracker = React.useCallback(
    (username: string) => {
      showUser(username, true)
    },
    [showUser]
  )

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
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
