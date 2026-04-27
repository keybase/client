import * as Chat from '@/constants/chat'
import * as ConvoState from '@/stores/convostate'
import JumpToRecent from './jump-to-recent'
import type * as T from '@/constants/types'
import {useConversationCenter} from '../center-context'
import {useConversationThreadPagination} from '../thread-context'
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
    ConvoState.getConvoState(conversationIDKey).dispatch.markThreadAsRead(true)
  }

  return {markInitiallyLoadedThreadAsRead}
}

export const useJumpToRecent = (scrollToBottom: () => void, numOrdinals: number) => {
  const {moreToLoadForward, loaded} = useConversationThreadPagination()
  const toggleThreadSearch = ConvoState.useChatContext(s => s.dispatch.toggleThreadSearch)
  const {jumpToRecent} = useConversationCenter()

  const onJump = () => {
    scrollToBottom()
    jumpToRecent()
    toggleThreadSearch(true)
  }

  return loaded && moreToLoadForward && numOrdinals > 0 && <JumpToRecent onClick={onJump} />
}
