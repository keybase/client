import * as C from '../../../constants'
import * as React from 'react'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/chat2'
import JumpToRecent from './jump-to-recent'
import type * as Types from '../../../constants/types/chat2'
import logger from '../../../logger'

export const useActions = (p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const markInitiallyLoadedThreadAsRead = React.useCallback(() => {
    const selected = Constants.getSelectedConversation()
    if (selected !== conversationIDKey) {
      logger.info('bail on not looking at this thread anymore?')
      return
    }
    C.getConvoState(conversationIDKey).dispatch.markThreadAsRead()
  }, [conversationIDKey])

  return {markInitiallyLoadedThreadAsRead}
}

export const useJumpToRecent = (
  conversationIDKey: Types.ConversationIDKey,
  scrollToBottom: () => void,
  numOrdinals: number
) => {
  const dispatch = Container.useDispatch()

  const containsLatestMessage = Constants.useContext(s => s.containsLatestMessage)
  const toggleThreadSearch = Constants.useContext(s => s.dispatch.toggleThreadSearch)

  const jumpToRecent = React.useCallback(() => {
    scrollToBottom()
    dispatch(Chat2Gen.createJumpToRecent({conversationIDKey}))
    toggleThreadSearch(true)
  }, [toggleThreadSearch, dispatch, conversationIDKey, scrollToBottom])

  return !containsLatestMessage && numOrdinals > 0 && <JumpToRecent onClick={jumpToRecent} />
}
