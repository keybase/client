import type * as T from '@/constants/types'
import {removeUnfurl, toggleCollapse, useThreadMessageTarget} from '../../../../message-commands'

export const useActions = (youAreAuthor: boolean, messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => {
  const target = useThreadMessageTarget(ordinal)
  const onClose = () => {
    removeUnfurl(target, messageID)
  }
  const onToggleCollapse = () => {
    toggleCollapse(target, messageID)
  }

  return {onClose: youAreAuthor ? onClose : undefined, onToggleCollapse}
}
