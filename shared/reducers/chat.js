// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/chat'

import type {Actions, State, ConversationState, AppendMessages, Message} from '../constants/chat'

const {StateRecord, ConversationStateRecord, makeSnippet} = Constants
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

      // Reset the unread count
      const newInboxStates = state.get('inbox').map(inbox => inbox.get('conversationIDKey') !== conversationIDKey ? inbox : inbox.set('unreadCount', 0))

      return state
        .set('conversationStates', newConversationStates)
        .set('inbox', newInboxStates)
    }
    case Constants.appendMessages: {
      const appendAction: AppendMessages = action
      const appendMessages = appendAction.payload.messages
      const message: Message = appendMessages[0]
      const conversationIDKey = appendAction.payload.conversationIDKey
      const newConversationStates = state.get('conversationStates').update(
        conversationIDKey,
        initialConversation,
        conversation => conversation.set('messages', conversation.get('messages').push(...appendMessages)))

      const isSelected = state.get('selectedConversation') === action.payload.conversationIDKey
      let snippet

      switch (message.type) {
        case 'Text':
          snippet = makeSnippet(message.message && message.message.stringValue(), 100)
          break
        default:
          snippet = ''
      }

      const newInboxStates = state.get('inbox').map(inbox => (
        inbox.get('conversationIDKey') !== conversationIDKey
          ? inbox
          : inbox
            .set('unreadCount', isSelected ? 0 : inbox.get('unreadCount') + appendMessages.length)
            .set('time', message.timestamp)
            .set('snippet', snippet)
      ))

      return state
        .set('conversationStates', newConversationStates)
        .set('inbox', newInboxStates)
    }
    case Constants.pendingMessageWasSent: {
      const {outboxID, messageID, messageState} = action.payload
      const newConversationStates = state.get('conversationStates').update(
        action.payload.conversationIDKey,
        initialConversation,
        conversation => {
          const index = conversation.get('messages').findIndex(item => item.outboxID === outboxID)
          if (index < 0) {
            console.warn("Couldn't find an outbox entry to modify")
            return conversation
          }
          return conversation.updateIn(['messages', index], item => ({
            ...item,
            messageID,
            messageState,
          }))
        }
      )
      return state.set('conversationStates', newConversationStates)
    }
    case Constants.selectConversation:
      const conversationIDKey = action.payload.conversationIDKey
      // Set unread to zero
      const newInboxStates = state.get('inbox').map(inbox => inbox.get('conversationIDKey') !== conversationIDKey ? inbox : inbox.set('unreadCount', 0))
      return state
        .set('selectedConversation', conversationIDKey)
        .set('inbox', newInboxStates)
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
