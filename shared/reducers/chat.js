// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/chat'
import * as WindowConstants from '../constants/window'
import {Set, List} from 'immutable'

import type {Actions, State, ConversationState, AppendMessages, Message, ServerMessage, InboxState} from '../constants/chat'

const {StateRecord, ConversationStateRecord, makeSnippet} = Constants
const initialState: State = new StateRecord()
const initialConversation: ConversationState = new ConversationStateRecord()

function _dedupeMessages (seenMessages: Set<any>, messages: List<ServerMessage> = List(), prepend: List<ServerMessage> = List(), append: List<ServerMessage> = List()): {nextSeenMessages: Set<any>, nextMessages: List<ServerMessage>} {
  const filteredPrepend = prepend.filter(m => !seenMessages.has(m.key))
  const filteredAppend = append.filter(m => !seenMessages.has(m.key))
  const nextMessages = filteredPrepend.concat(messages, filteredAppend)

  const nextSeenMessages = nextMessages.reduce((acc, m) => acc.add(m.key), Set())

  return {
    nextMessages,
    nextSeenMessages,
  }
}

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
          const {nextMessages, nextSeenMessages} = _dedupeMessages(conversation.seenMessages, conversation.messages, List(prependMessages), List())

          return conversation
            .set('messages', nextMessages)
            .set('seenMessages', nextSeenMessages)
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

      const isSelected = state.get('selectedConversation') === action.payload.conversationIDKey

      const newConversationStates = state.get('conversationStates').update(
        conversationIDKey,
        initialConversation,
        conversation => {
          const {nextMessages, nextSeenMessages} = _dedupeMessages(conversation.seenMessages, conversation.messages, List(), List(appendMessages))

          const firstMessage = appendMessages[0]
          const inConversationFocused = (isSelected && state.get('focused'))
          if (!conversation.get('firstNewMessageID') && !inConversationFocused) {
            // Set first new message if we don't have one set, and are not in
            // the conversation with window focused
            conversation = conversation.set('firstNewMessageID', firstMessage.messageID)
          } else if (inConversationFocused) {
            // Clear new message if we received a new message while in
            // conversation and window is focused
            conversation = conversation.set('firstNewMessageID', null)
          }

          return conversation
            .set('messages', nextMessages)
            .set('seenMessages', nextSeenMessages)
        })

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
          })).set('seenMessages', conversation.seenMessages.add(messageID))
        }
      )
      return state.set('conversationStates', newConversationStates)
    }
    case Constants.updateLatestMessage:
      // Clear new messages id when switching away from conversation
      const previousConversation = state.get('selectedConversation')
      if (previousConversation) {
        const newConversationStates = state.get('conversationStates').update(
          previousConversation,
          initialConversation,
          conversation => conversation.set('firstNewMessageID', null))
        state = state.set('conversationStates', newConversationStates)
      }
      return state
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
    case Constants.updatedMetadata:
      return state.set('metaData', state.get('metaData').merge(action.payload))
    case Constants.loadedInbox:
      return state.set('inbox', action.payload.inbox)
    case Constants.updateInbox:
      const convo: InboxState = action.payload.conversation
      const toFind = convo.get('conversationIDKey')
      return state.set('inbox', state.get('inbox').map(i => {
        if (i.get('conversationIDKey') === toFind) {
          return convo
        } else {
          return i
        }
      }))
    case WindowConstants.changedFocus:
      return state.set('focused', action.payload)

  }

  return state
}

export default reducer

