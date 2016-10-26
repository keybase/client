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
    case Constants.prependMessages:
      const prependMessages = action.payload.messages
      const moreToLoad = action.payload.moreToLoad
      const paginationNext = action.payload.paginationNext
      return state.set('conversationStates', state.get('conversationStates').update(action.payload.conversationIDKey, initialConversation,
        conversation => {
          const c1: ConversationState = conversation.set('messages', conversation.get('messages').unshift(...prependMessages))
          const c2 =  c1.set('moreToLoad', moreToLoad)
          return c2.set('paginationNext', paginationNext)
        }))
    case Constants.appendMessages:
      const appendMessages = action.payload.messages
      return state.set('conversationStates', state.get('conversationStates').update(action.payload.conversationIDKey, initialConversation,
        conversation => conversation.set('messages', conversation.get('messages').push(...appendMessages))))
    case Constants.selectConversation:
      return state.set('selectedConversation', action.payload.conversationIDKey)
    case Constants.loadedInbox:
      return state.set('inbox', action.payload.inbox)
  }

  return state
}

export default reducer
