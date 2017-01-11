// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/chat'
import * as WindowConstants from '../constants/window'
import {Set, List, Map} from 'immutable'

import type {Actions, State, Message, ConversationState, AppendMessages, ServerMessage, InboxState} from '../constants/chat'

const {StateRecord, ConversationStateRecord, makeSnippet, serverMessageToMessageBody} = Constants
const initialState: State = new StateRecord()
const initialConversation: ConversationState = new ConversationStateRecord()

function _dedupeMessages (seenMessages: Set<any>, messages: List<ServerMessage> = List(), prepend: List<ServerMessage> = List(), append: List<ServerMessage> = List()): {nextSeenMessages: Set<any>, nextMessages: List<ServerMessage>} {
  const filteredPrepend = prepend.filter(m => !seenMessages.has(m.key))
  const filteredAppend = append.filter(m => !seenMessages.has(m.key))

  let messagesToUpdate = Map().asMutable()
  if (filteredPrepend.count() !== prepend.count()) {
    prepend.forEach(m => { seenMessages.has(m.key) && messagesToUpdate.set(m.key, m) })
  }
  if (filteredAppend.count() !== append.count()) {
    append.forEach(m => { seenMessages.has(m.key) && messagesToUpdate.set(m.key, m) })
  }

  messagesToUpdate = messagesToUpdate.asImmutable()

  const nextMessages = messages.asMutable()
  if (messagesToUpdate.count() > 0) {
    nextMessages.forEach((m, i) => { messagesToUpdate.has(m.key) && nextMessages.set(i, messagesToUpdate.get(m.key)) })
  }

  const filteredPrependCount = filteredPrepend.count()
  filteredPrepend.forEach((_, i) => nextMessages.unshift(filteredPrepend.get(filteredPrependCount - 1 - i)))
  filteredAppend.forEach(m => nextMessages.push(m))

  const nextSeenMessages = nextMessages.reduce((acc, m) => acc.add(m.key), Set())

  return {
    nextMessages: nextMessages.asImmutable(),
    nextSeenMessages,
  }
}

type ConversationsStates = Map<Constants.ConversationIDKey, ConversationState>
type ConversationUpdateFn = (c: Constants.ConversationState) => Constants.ConversationState
function updateConversation (conversationStates: ConversationsStates, conversationIDKey: Constants.ConversationIDKey, conversationUpdateFn: ConversationUpdateFn): ConversationsStates {
  return conversationStates.update(
    conversationIDKey,
    initialConversation,
    conversationUpdateFn,
  )
}

type MessageUpdateFn = (message: $Subtype<Message>) => Message
type MessageFindPredFn = (message: Message) => boolean
function updateConversationMessage (conversationStates: ConversationsStates, conversationIDKey: Constants.ConversationIDKey, pred: MessageFindPredFn, messageUpdateFn: MessageUpdateFn): ConversationsStates {
  return updateConversation(
    conversationStates,
    conversationIDKey,
    conversation => {
      const index = conversation.get('messages').findIndex(pred)
      if (index < 0) {
        console.warn("Couldn't find an outbox entry to modify")
        return conversation
      }
      // $FlowIssue
      return conversation.updateIn(['messages', index], messageUpdateFn)
    }
  )
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
            .set('isRequesting', false)
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
      const isSelected = action.payload.isSelected
      const message: ServerMessage = appendMessages[appendMessages.length - 1]
      const conversationIDKey = appendAction.payload.conversationIDKey

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

      const snippet = makeSnippet(serverMessageToMessageBody(message))
      const author = message.type === 'Text' && message.author
      // Update snippets / unread / participant order

      let updatedIdx = -1
      let newInboxStates = state.get('inbox').map((inbox, inboxIdx) => {
        if (inbox.get('conversationIDKey') !== conversationIDKey) {
          return inbox
        }

        updatedIdx = inboxIdx

        let newInbox = inbox
          .set('unreadCount', isSelected ? 0 : inbox.get('unreadCount') + appendMessages.length)
          .set('time', message.timestamp)

        if (snippet) {
          newInbox = newInbox.set('snippet', snippet)
        }

        const oldParticipants = newInbox.get('participants')

        if (author && oldParticipants.count() > 1) {
          const idx = oldParticipants.findKey(p => p.username === author)
          if (idx > 0) {
            const newFirst = oldParticipants.get(idx)
            newInbox = newInbox.set('participants', oldParticipants.delete(idx).unshift(newFirst))
          }
        }

        return newInbox
      })

      if (updatedIdx !== -1) {
        const newFirst = newInboxStates.get(updatedIdx)
        newInboxStates = newInboxStates.delete(updatedIdx).unshift(newFirst)
      }

      return state
        .set('conversationStates', newConversationStates)
        .set('inbox', newInboxStates)
    }
    case 'chat:updateTempMessage': {
      if (action.error) {
        // TODO
        return state
      } else {
        const {outboxID, message, conversationIDKey} = action.payload
        // $FlowIssue
        return state.update('conversationStates', conversationStates => updateConversationMessage(
          conversationStates,
          conversationIDKey,
          item => !!item.outboxID && item.outboxID === outboxID,
          m => ({
            ...m,
            ...message,
          })
        ))
      }
    }
    case 'chat:markSeenMessage': {
      const {messageID, conversationIDKey} = action.payload
      // $FlowIssue
      return state.update('conversationStates', conversationStates => updateConversation(
        conversationStates,
        conversationIDKey,
        // $FlowIssue
        conversation => conversation.update('seenMessages', seenMessages => seenMessages.add(messageID))
      ))
    }
    case 'chat:attachmentLoaded': {
      const {conversationIDKey, messageID, path, isPreview} = action.payload

      const toMerge = isPreview ? {previewPath: path, messageState: 'sent'} : {downloadedPath: path, messageState: 'downloaded'}

      // $FlowIssue
      return state.update('conversationStates', conversationStates => updateConversationMessage(
        conversationStates,
        conversationIDKey,
        item => !!item.messageID && item.messageID === messageID,
        m => ({
          ...m,
          ...toMerge,
        })
      ))
    }
    case 'chat:downloadProgress': {
      const {conversationIDKey, messageID, bytesComplete, bytesTotal} = action.payload
      const progress = bytesComplete / bytesTotal

      // $FlowIssue
      return state.update('conversationStates', conversationStates => updateConversationMessage(
        conversationStates,
        conversationIDKey,
        item => !!item.messageID && item.messageID === messageID,
        m => ({
          ...m,
          messageState: 'downloading',
          progress,
        })
      ))
    }
    case 'chat:uploadProgress': {
      const {conversationIDKey, outboxID, bytesComplete, bytesTotal} = action.payload
      const progress = bytesComplete / bytesTotal

      // $FlowIssue
      return state.update('conversationStates', conversationStates => updateConversationMessage(
        conversationStates,
        conversationIDKey,
        item => !!item.outboxID && item.outboxID === outboxID,
        m => ({
          ...m,
          messageState: 'uploading',
          progress,
        })
      ))
    }
    case Constants.updateLatestMessage:
      // Clear new messages id of conversation
      const newConversationStates = state.get('conversationStates').update(
        action.payload.conversationIDKey,
        initialConversation,
        conversation => conversation.set('firstNewMessageID', null))
      state = state.set('conversationStates', newConversationStates)
      return state
    case Constants.selectConversation:
      const conversationIDKey = action.payload.conversationIDKey

      // Set unread to zero
      const newInboxStates = state.get('inbox').map(inbox => inbox.get('conversationIDKey') !== conversationIDKey ? inbox : inbox.set('unreadCount', 0))
      return state
        .set('inbox', newInboxStates)
    case Constants.loadingMessages: {
      const newConversationStates = state.get('conversationStates').update(
        action.payload.conversationIDKey,
        initialConversation,
        conversation => conversation.set('isRequesting', true))

      return state.set('conversationStates', newConversationStates)
    }
    case Constants.updatedMetadata:
      return state.set('metaData', state.get('metaData').merge(action.payload))
    case Constants.loadedInbox:
      // Don't overwrite existing verified inbox data
      const existingRows = state.get('inbox')
      return state.set('inbox', action.payload.inbox.map(newRow => {
        const id = newRow.get('conversationIDKey')
        const existingRow = existingRows.find(existingRow => existingRow.get('conversationIDKey') === id)
        return existingRow || newRow
      }))
    case Constants.updateInboxComplete:
      return state.set('inbox', state.get('inbox').filter(i => i.get('validated')))
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

