import * as Chat from '@/stores/chat'
import type * as T from '@/constants/types'

export const useActions = (youAreAuthor: boolean, messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => {
  const unfurlRemove = Chat.useChatContext(s => s.dispatch.unfurlRemove)
  const onClose = () => {
    unfurlRemove(messageID)
  }
  const toggleMessageCollapse = Chat.useChatContext(s => s.dispatch.toggleMessageCollapse)
  const onToggleCollapse = () => {
    toggleMessageCollapse(messageID, ordinal)
  }

  return {onClose: youAreAuthor ? onClose : undefined, onToggleCollapse}
}
