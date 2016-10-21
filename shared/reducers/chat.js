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
      return state.set('conversationStates', state.get('conversationStates').update(action.payload.conversationID, initialConversation,
        conversation => conversation.set('messages', conversation.get('messages').unshift(...prependMessages))))
    case Constants.appendMessages:
      const appendMessages = action.payload.messages
      return state.set('conversationStates', state.get('conversationStates').update(action.payload.conversationID, initialConversation,
        conversation => conversation.set('messages', conversation.get('messages').push(...appendMessages))))
    case Constants.selectConversation:
      return state.set('selectedConversation', action.payload.conversationID)
  }

  return state
}

export default reducer
