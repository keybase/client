// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/chat'
import {List, Map} from 'immutable'

import type {Actions, State, ConversationState} from '../constants/chat'

const initialState: State = {
  conversationStates: Map(),
  selectedConversation: null,
}

const _initialConversationState = (): ConversationState => ({
  messages: List(),
  moreToLoad: true,
})

function reducer (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.prependMessages:
      const prependMessages = action.payload.messages
      return {
        ...state,
        conversationStates: state.conversationStates.updateIn(
          [action.payload.conversationID, 'messages'],
          _initialConversationState(),
          messages => messages.unshift(...prependMessages)
        ),
      }
    case Constants.appendMessages:
      const appendMessages = action.payload.messages
      return {
        ...state,
        conversationStates: state.conversationStates.updateIn(
          [action.payload.conversationID, 'messages'],
          _initialConversationState(),
          messages => messages.push(...appendMessages)
        ),
      }
    case Constants.selectConversation:
      return {
        ...state,
        selectedConversation: action.payload.conversationID,
      }
  }

  return state
}

export default reducer
