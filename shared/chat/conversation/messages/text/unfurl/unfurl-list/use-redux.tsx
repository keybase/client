import * as React from 'react'
import * as Container from '../../../../../../util/container'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import type * as Types from '../../../../../../constants/types/chat2'

export const useActions = (
  conversationIDKey: Types.ConversationIDKey,
  youAreAuthor: boolean,
  messageID: Types.MessageID
) => {
  const dispatch = Container.useDispatch()
  const onClose = React.useCallback(() => {
    dispatch(Chat2Gen.createUnfurlRemove({conversationIDKey, messageID}))
  }, [dispatch, conversationIDKey, messageID])
  const onCollapse = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleMessageCollapse({conversationIDKey, messageID}))
  }, [dispatch, conversationIDKey, messageID])

  return {onClose: youAreAuthor ? onClose : undefined, onCollapse}
}

export const getUnfurlInfo = (
  state: Container.TypedState,
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
  idx: number
) => {
  const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
  const author = message?.author
  const youAreAuthor = author === state.config.username
  const unfurlInfo = [...(message?.unfurls?.values() ?? [])][idx]

  if (!unfurlInfo)
    return {author: '', isCollapsed: false, unfurl: null, unfurlMessageID: 0, youAreAuthor: false}

  const {isCollapsed, unfurl, unfurlMessageID} = unfurlInfo
  return {author, isCollapsed, unfurl, unfurlMessageID, youAreAuthor}
}
