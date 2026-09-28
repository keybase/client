import type * as T from '@/constants/types'
import {removeUnfurl, toggleCollapse} from '../../../../message-commands'
import {useConversationThreadActions, useConversationThreadID} from '../../../../thread-context'

export const useActions = (youAreAuthor: boolean, messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => {
  const conversationIDKey = useConversationThreadID()
  const thread = useConversationThreadActions()
  const onClose = () => {
    removeUnfurl(conversationIDKey, messageID)
  }
  const onToggleCollapse = () => {
    toggleCollapse(conversationIDKey, {ordinal, thread}, messageID)
  }

  return {onClose: youAreAuthor ? onClose : undefined, onToggleCollapse}
}
