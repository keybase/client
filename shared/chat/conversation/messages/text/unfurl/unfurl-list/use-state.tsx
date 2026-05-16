import type * as T from '@/constants/types'
import {useConversationThreadMessageActions} from '../../../../thread-context'

export const useActions = (youAreAuthor: boolean, messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => {
  const {toggleMessageCollapse, unfurlRemove} = useConversationThreadMessageActions()
  const onClose = () => {
    unfurlRemove(messageID)
  }
  const onToggleCollapse = () => {
    toggleMessageCollapse(messageID, ordinal)
  }

  return {onClose: youAreAuthor ? onClose : undefined, onToggleCollapse}
}
