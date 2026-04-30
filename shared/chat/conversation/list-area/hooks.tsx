import * as Chat from '@/constants/chat'
import JumpToRecent from './jump-to-recent'
import type * as T from '@/constants/types'
import {useConversationCenter} from '../center-context'
import {
  useConversationThreadMarkThreadAsRead,
  useConversationThreadPagination,
  useConversationThreadToggleSearch,
} from '../thread-context'
import logger from '@/logger'

export const useActions = (p: {conversationIDKey: T.Chat.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const markThreadAsRead = useConversationThreadMarkThreadAsRead()
  const markInitiallyLoadedThreadAsRead = () => {
    const selected = Chat.getSelectedConversation()
    if (selected !== conversationIDKey) {
      logger.info('mark intially as read bail on not looking at this thread anymore?')
      return
    }
    markThreadAsRead()
  }

  return {markInitiallyLoadedThreadAsRead}
}

export const useJumpToRecent = (scrollToBottom: () => void, numOrdinals: number) => {
  const {moreToLoadForward, loaded} = useConversationThreadPagination()
  const toggleThreadSearch = useConversationThreadToggleSearch()
  const {jumpToRecent} = useConversationCenter()

  const onJump = () => {
    scrollToBottom()
    jumpToRecent()
    toggleThreadSearch(true)
  }

  return loaded && moreToLoadForward && numOrdinals > 0 && <JumpToRecent onClick={onJump} />
}
