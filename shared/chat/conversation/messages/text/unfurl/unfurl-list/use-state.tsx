import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'

export const useActions = (youAreAuthor: boolean, messageID: T.Chat.MessageID, ordinal: T.Chat.Ordinal) => {
  const unfurlRemove = C.useChatContext(s => s.dispatch.unfurlRemove)
  const onClose = React.useCallback(() => {
    unfurlRemove(messageID)
  }, [unfurlRemove, messageID])
  const toggleMessageCollapse = C.useChatContext(s => s.dispatch.toggleMessageCollapse)
  const onToggleCollapse = React.useCallback(() => {
    toggleMessageCollapse(messageID, ordinal)
  }, [toggleMessageCollapse, messageID, ordinal])

  return {onClose: youAreAuthor ? onClose : undefined, onToggleCollapse}
}

export const getUnfurlInfo = (state: C.Chat.ConvoState, ordinal: T.Chat.Ordinal, idx: number) => {
  const message = state.messageMap.get(ordinal)
  const author = message?.author
  const you = C.useCurrentUserState.getState().username
  const youAreAuthor = author === you
  const unfurlInfo: undefined | T.RPCChat.UIMessageUnfurlInfo = [...(message?.unfurls?.values() ?? [])][idx]

  if (!unfurlInfo)
    return {author: '', isCollapsed: false, unfurl: null, unfurlMessageID: 0, youAreAuthor: false}

  const {isCollapsed, unfurl, unfurlMessageID} = unfurlInfo
  return {author, isCollapsed, unfurl, unfurlMessageID, youAreAuthor}
}
