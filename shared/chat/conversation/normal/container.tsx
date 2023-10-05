import * as C from '../../../constants'
import type * as T from '../../../constants/types'
import * as React from 'react'
import Normal from '.'
import {indefiniteArticle} from '../../../util/string'
import {OrangeLineContext} from '../orange-line-context'

// Orange line logic:
// While looking at a thread the line should be static
// If you aren't active (backgrounded on desktop) the orange line will appear above new content
// If you are active and new items get added the orange line will be consistent, either where it was on first
// mount or not there at all (active and new items come)
// Handle mark as unread
const useOrangeLine = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const readMsgID = C.useChatContext(s => s.meta.readMsgID)
  const maxMsgID = C.useChatContext(s => s.meta.maxMsgID)
  const metaOrangeShow = maxMsgID > readMsgID
  const active = C.useActiveState(s => s.active)

  const initOrangeLine = () => {
    return metaOrangeShow ? readMsgID : 0
  }
  const [orangeLine, setOrangeLine] = React.useState(initOrangeLine())
  const [lastCID, setLastCID] = React.useState(conversationIDKey)
  const [lastReadMsgID, setLastReadMsgID] = React.useState(readMsgID)
  const [metaGood, setMetaGood] = React.useState(readMsgID > 0)

  // meta not ready yet
  if (readMsgID < 0) {
    return 0
  }

  if (!metaGood) {
    setMetaGood(true)
    setLastReadMsgID(readMsgID)
    setOrangeLine(metaOrangeShow ? readMsgID : 0)
  }

  // convo changed? reset
  if (lastCID !== conversationIDKey) {
    setLastCID(conversationIDKey)
    setLastReadMsgID(readMsgID)
    setOrangeLine(initOrangeLine())
  }

  // not active and we should show?
  if (metaOrangeShow && !active && orangeLine <= 0) {
    setOrangeLine(readMsgID)
  }

  // mark unread
  if (metaOrangeShow && readMsgID < lastReadMsgID) {
    setLastReadMsgID(readMsgID)
    setOrangeLine(readMsgID)
  }

  return orangeLine
}

const NormalWrapper = React.memo(function NormalWrapper() {
  const conversationIDKey = C.useChatContext(s => s.id)
  const orangeLine = useOrangeLine(conversationIDKey)
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
  const {cannotWrite, minWriterReason, threadLoadedOffline} = C.useChatContext(
    C.useShallow(s => {
      const meta = s.meta
      const {cannotWrite, offline, minWriterRole} = meta
      const threadLoadedOffline = offline
      const minWriterReason = `You must be at least ${indefiniteArticle(
        minWriterRole
      )} ${minWriterRole} to post.`
      return {cannotWrite, minWriterReason, threadLoadedOffline}
    })
  )

  const dragAndDropRejectReason = cannotWrite ? minWriterReason : undefined

  C.useCIDChanged(conversationIDKey, () => {
    if (!C.isMobile) {
      setFocusInputCounter(c => c + 1)
    }
  })

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

  const navigateAppend = C.useChatNavigateAppend()
  const onAttach = React.useCallback(
    (paths: Array<string>) => {
      const pathAndOutboxIDs = paths.map(p => ({path: p}))
      navigateAppend(conversationIDKey => ({
        props: {conversationIDKey, pathAndOutboxIDs},
        selected: 'chatAttachmentGetTitles',
      }))
    },
    [navigateAppend]
  )

  return (
    <OrangeLineContext.Provider value={orangeLine}>
      <Normal
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
    </OrangeLineContext.Provider>
  )
})
export default NormalWrapper
