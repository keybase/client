import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import type * as T from '@/constants/types'

export const useActions = (youAreAuthor: boolean, messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => {
  const unfurlRemove = ConvoState.useChatContext(s => s.dispatch.unfurlRemove)
  const onClose = () => {
    unfurlRemove(messageID)
  }
  const toggleMessageCollapse = ConvoState.useChatContext(s => s.dispatch.toggleMessageCollapse)
  const onToggleCollapse = () => {
    toggleMessageCollapse(messageID, ordinal)
  }

  return {onClose: youAreAuthor ? onClose : undefined, onToggleCollapse}
}
