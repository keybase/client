// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/chat'

import type {Actions, State, ConversationState} from '../constants/chat'

const {StateRecord, ConversationStateRecord} = Constants
const initialState: State = new StateRecord()
const initialConversation: ConversationState = new ConversationStateRecord()

function reducer (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return initialState
    case Constants.prependMessages: {
      const {messages: prependMessages, moreToLoad, paginationNext, conversationIDKey} = action.payload

      const newConversationStates = state.get('conversationStates').update(
        conversationIDKey,
        initialConversation,
        conversation => {
          return conversation
            .set('messages', conversation.get('messages').unshift(...prependMessages))
            .set('moreToLoad', moreToLoad)
            .set('paginationNext', paginationNext)
            .set('isLoading', false)
        })

      return state.set('conversationStates', newConversationStates)
    }
    case Constants.appendMessages: {
      const appendMessages = action.payload.messages
      const newConversationStates = state.get('conversationStates').update(
        action.payload.conversationIDKey,
        initialConversation,
        conversation => conversation.set('messages', conversation.get('messages').push(...appendMessages)))

      return state.set('conversationStates', newConversationStates)
    }
    case Constants.selectConversation:
      return state.set('selectedConversation', action.payload.conversationIDKey)
    case Constants.loadingMessages: {
      const newConversationStates = state.get('conversationStates').update(
        action.payload.conversationIDKey,
        initialConversation,
        conversation => conversation.set('isLoading', true))

      return state.set('conversationStates', newConversationStates)
    }
    case Constants.loadedInbox:
      return state.set('inbox', action.payload.inbox)
  }

  return state
}

export default reducer
