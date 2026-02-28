import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import JumpToRecent from './jump-to-recent'
import type * as T from '@/constants/types'
import logger from '@/logger'

export const useActions = (p: {conversationIDKey: T.Chat.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const markInitiallyLoadedThreadAsRead = () => {
    const selected = Chat.getSelectedConversation()
    if (selected !== conversationIDKey) {
      logger.info('mark intially as read bail on not looking at this thread anymore?')
      return
    }
    // Force mark as read since this is triggered by navigation (user action)
    Chat.getConvoState(conversationIDKey).dispatch.markThreadAsRead(true)
  }

  return {markInitiallyLoadedThreadAsRead}
}

export const useJumpToRecent = (scrollToBottom: () => void, numOrdinals: number) => {
  const data = Chat.useChatContext(
    C.useShallow(s => {
      const {loaded, moreToLoadForward} = s
      const {jumpToRecent, toggleThreadSearch} = s.dispatch
      return {jumpToRecent, loaded, moreToLoadForward, toggleThreadSearch}
    })
  )
  const {moreToLoadForward, jumpToRecent, loaded, toggleThreadSearch} = data

  const onJump = () => {
    scrollToBottom()
    jumpToRecent()
    toggleThreadSearch(true)
  }

  return loaded && moreToLoadForward && numOrdinals > 0 && <JumpToRecent onClick={onJump} />
}
