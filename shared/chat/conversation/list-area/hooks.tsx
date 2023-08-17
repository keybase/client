import * as C from '../../../constants'
import * as React from 'react'
import JumpToRecent from './jump-to-recent'
import type * as T from '../../../constants/types'
import logger from '../../../logger'

export const useActions = (p: {conversationIDKey: T.Chat.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const markInitiallyLoadedThreadAsRead = React.useCallback(() => {
    const selected = C.getSelectedConversation()
    if (selected !== conversationIDKey) {
      logger.info('bail on not looking at this thread anymore?')
      return
    }
    C.getConvoState(conversationIDKey).dispatch.markThreadAsRead()
  }, [conversationIDKey])

  return {markInitiallyLoadedThreadAsRead}
}

export const useJumpToRecent = (scrollToBottom: () => void, numOrdinals: number) => {
  const containsLatestMessage = C.useChatContext(s => s.containsLatestMessage)
  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const jumpToRecent = C.useChatContext(s => s.dispatch.jumpToRecent)

  const onJump = React.useCallback(() => {
    scrollToBottom()
    jumpToRecent()
    toggleThreadSearch(true)
  }, [toggleThreadSearch, jumpToRecent, scrollToBottom])

  return !containsLatestMessage && numOrdinals > 0 && <JumpToRecent onClick={onJump} />
}
