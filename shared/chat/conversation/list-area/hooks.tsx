import * as C from '@/constants'
import * as React from 'react'
import JumpToRecent from './jump-to-recent'
import type * as T from '@/constants/types'
import logger from '@/logger'

export const useActions = (p: {conversationIDKey: T.Chat.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const markInitiallyLoadedThreadAsRead = React.useCallback(() => {
    const selected = C.Chat.getSelectedConversation()
    if (selected !== conversationIDKey) {
      logger.info('mark intially as read bail on not looking at this thread anymore?')
      return
    }
    // Force mark as read since this is triggered by navigation (user action)
    C.getConvoState(conversationIDKey).dispatch.markThreadAsRead(true)
  }, [conversationIDKey])

  return {markInitiallyLoadedThreadAsRead}
}

export const useJumpToRecent = (scrollToBottom: () => void, numOrdinals: number) => {
  const data = C.useChatContext(
    C.useShallow(s => {
      const containsLatestMessage = s.isCaughtUp()
      const {loaded} = s
      const {jumpToRecent, toggleThreadSearch} = s.dispatch
      return {containsLatestMessage, jumpToRecent, loaded, toggleThreadSearch}
    })
  )
  const {containsLatestMessage, jumpToRecent, loaded, toggleThreadSearch} = data

  const onJump = React.useCallback(() => {
    scrollToBottom()
    jumpToRecent()
    toggleThreadSearch(true)
  }, [toggleThreadSearch, jumpToRecent, scrollToBottom])

  return (
    loaded &&
    !containsLatestMessage &&
    numOrdinals > 0 && <JumpToRecent onClick={onJump} />
  )
}
