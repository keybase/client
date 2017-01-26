// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/chat'
import * as WindowConstants from '../constants/window'
import {Set, List, Map} from 'immutable'

import type {Actions, State, Message, ConversationState, AppendMessages, ServerMessage, InboxState} from '../constants/chat'

const {StateRecord, ConversationStateRecord, makeSnippet, serverMessageToMessageBody, MetaDataRecord, InboxStateRecord} = Constants
const initialState: State = new StateRecord()
const initialConversation: ConversationState = new ConversationStateRecord()

// _filterMessages dedupes and removed deleted messages
function _filterMessages (seenMessages: Set<any>, messages: List<ServerMessage> = List(), prepend: List<ServerMessage> = List(), append: List<ServerMessage> = List(), deletedIDs: Set<any>): {nextSeenMessages: Set<any>, nextMessages: List<ServerMessage>} {
  const filteredPrepend = prepend.filter(m => !seenMessages.has(m.key))
  const filteredAppend = append.filter(m => !seenMessages.has(m.key))

  const messagesToUpdate = Map(prepend.concat(append).filter(m => seenMessages.has(m.key)).map(m => [m.key, m]))
  const updatedMessages = messages.map(m => messagesToUpdate.has(m.key) ? messagesToUpdate.get(m.key) : m)
  // We have to check for m.messageID being falsey and set.has(undefined) is true!. We shouldn't ever have a zero messageID
  const nextMessages = filteredPrepend.concat(updatedMessages, filteredAppend).filter(m => !m.messageID || !deletedIDs.has(m.messageID))
  const nextSeenMessages = Set(nextMessages.map(m => m.key))

  return {
    nextMessages,
    nextSeenMessages,
  }
}

// _filterTypes separates out deleted message types and returns their ID's
function _filterTypes (inMessages: Array<ServerMessage>): {messages: Array<ServerMessage>, deletedIDs: Array<any>} {
  const messages = []
  const deletedIDs = []
  inMessages.forEach((message, idx) => {
    if (message.type === 'Deleted') {
      deletedIDs.push(...message.deletedIDs)
    } else {
      messages.push(message)
    }
  })
  return {messages, deletedIDs}
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

function sortInbox (inbox: List<InboxState>): List<InboxState> {
  return inbox.sort((a, b) => {
    return b.get('time') - a.get('time')
  })
}

function reducer (state: State = initialState, action: Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return initialState
    case 'chat:clearMessages': {
      const {conversationIDKey} = action.payload
      const origConversationState = state.get('conversationStates').get(conversationIDKey)
      if (!origConversationState) {
        console.warn('Attempted to clear conversation state that doesn\'t exist')
        return
      }
      // $FlowIssue
      const clearedConversationState = initialConversation.merge({
        firstNewMessageID: origConversationState.get('firstNewMessageID'),
        messages: origConversationState.get('messages').filter(m => m.messageState === 'pending'),
      })
      // $FlowIssue
      return state.update('conversationStates', conversationStates =>
        conversationStates.set(conversationIDKey, clearedConversationState)
      )
    }
    case 'chat:prependMessages': {
      const {messages: prependMessages, moreToLoad, paginationNext, conversationIDKey} = action.payload
      const {messages, deletedIDs} = _filterTypes(prependMessages)

      const newConversationStates = state.get('conversationStates').update(
        conversationIDKey,
        initialConversation,
        conversation => {
          const nextDeletedIDs = conversation.get('deletedIDs').add(...deletedIDs)
          const {nextMessages, nextSeenMessages} = _filterMessages(conversation.seenMessages, conversation.messages, List(messages), List(), nextDeletedIDs)

          return conversation
            .set('messages', nextMessages)
            .set('seenMessages', nextSeenMessages)
            .set('moreToLoad', moreToLoad)
            .set('paginationNext', paginationNext)
            .set('deletedIDs', nextDeletedIDs)
            .set('isRequesting', false)
        })

      // Reset the unread count
      const newInboxStates = state.get('inbox').map(inbox => inbox.get('conversationIDKey') !== conversationIDKey ? inbox : inbox.set('unreadCount', 0))

      return state
        .set('conversationStates', newConversationStates)
        .set('inbox', sortInbox(newInboxStates))
    }
    case 'chat:appendMessages': {
      const appendAction: AppendMessages = action
      const appendMessages = appendAction.payload.messages
      const isSelected = action.payload.isSelected
      const message: ServerMessage = appendMessages[appendMessages.length - 1]
      const conversationIDKey = appendAction.payload.conversationIDKey

      const {messages, deletedIDs} = _filterTypes(appendMessages)

      const newConversationStates = state.get('conversationStates').update(
        conversationIDKey,
        initialConversation,
        conversation => {
          const nextDeletedIDs = conversation.get('deletedIDs').add(...deletedIDs)
          const {nextMessages, nextSeenMessages} = _filterMessages(conversation.seenMessages, conversation.messages, List(), List(messages), nextDeletedIDs)

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
            .set('deletedIDs', nextDeletedIDs)
        })

      const snippet = makeSnippet(serverMessageToMessageBody(message))
      const author = message.type === 'Text' && message.author
      // Update snippets / unread / participant order

      let newInboxStates = state.get('inbox').map((inbox, inboxIdx) => {
        if (inbox.get('conversationIDKey') !== conversationIDKey) {
          return inbox
        }

        let newInbox = inbox
          .set('unreadCount', isSelected ? 0 : inbox.get('unreadCount') + appendMessages.length)
          .set('time', message.timestamp)

        if (snippet) {
          newInbox = newInbox.set('snippet', snippet).set('snippetKey', message.key)
        } else {
          const oldSnippetID = inbox.get('snippetKey')
          // Deleted the current showing snippet
          if (oldSnippetID && deletedIDs.includes(oldSnippetID)) {
            newInbox = newInbox.set('snippet', '').set('snippetKey', null)
          }
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

      return state
        .set('conversationStates', newConversationStates)
        .set('inbox', sortInbox(newInboxStates))
    }
    case 'chat:updateTempMessage': {
      if (action.error) {
        console.warn('Error in updateTempMessage')
        const {conversationIDKey, outboxID} = action.payload
        // $FlowIssue
        return state.update('conversationStates', conversationStates => updateConversationMessage(
          conversationStates,
          conversationIDKey,
          item => !!item.outboxID && item.outboxID === outboxID,
          m => ({
            ...m,
            messageState: 'failed',
          })
        ))
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
        )).update('inbox', inbox => inbox.map((i, inboxIdx) => {
          // Update snippetKey to message.messageID so we can clear deleted message snippets
          if (i.get('conversationIDKey') === conversationIDKey) {
            if (i.get('snippetKey') === outboxID && message.messageID) {
              return i.set('snippetKey', message.messageID)
            }
          }
          return i
        })
        )
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
    case 'chat:createPendingFailure': {
      const {outboxID} = action.payload
      return state.set('pendingFailures', state.get('pendingFailures').add(outboxID))
    }
    case 'chat:removePendingFailure': {
      const {outboxID} = action.payload
      return state.set('pendingFailures', state.get('pendingFailures').remove(outboxID))
    }
    case 'chat:attachmentLoaded': {
      const {conversationIDKey, messageID, path, isPreview, isHdPreview} = action.payload

      let toMerge
      if (isPreview) {
        toMerge = {previewPath: path, messageState: 'sent'}
      } else if (isHdPreview) {
        toMerge = {hdPreviewPath: path, messageState: 'sent'}
      } else {
        toMerge = {downloadedPath: path, messageState: 'downloaded'}
      }

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
    case 'chat:markThreadsStale': {
      const {convIDKeys} = action.payload
      // $FlowIssue
      return state.update('conversationStates', conversationStates =>
        conversationStates.map((conversationState, conversationIDKey) => {
          if (convIDKeys.length === 0 || convIDKeys.includes(conversationIDKey)) {
            return conversationState.set('isStale', true)
          }
          return conversationState
        })
      )
    }
    case 'chat:updateLatestMessage':
      // Clear new messages id of conversation
      const newConversationStates = state.get('conversationStates').update(
        action.payload.conversationIDKey,
        initialConversation,
        conversation => conversation.set('firstNewMessageID', null))
      state = state.set('conversationStates', newConversationStates)
      return state
    case 'chat:selectConversation':
      const conversationIDKey = action.payload.conversationIDKey

      // Set unread to zero
      const newInboxStates = state.get('inbox').map(inbox => inbox.get('conversationIDKey') !== conversationIDKey ? inbox : inbox.set('unreadCount', 0))
      return state
        .set('inbox', newInboxStates)
    case 'chat:loadingMessages': {
      const newConversationStates = state.get('conversationStates').update(
        action.payload.conversationIDKey,
        initialConversation,
        conversation => conversation.set('isRequesting', true))

      return state.set('conversationStates', newConversationStates)
    }
    case 'chat:updatedMetadata':
      return state.set('metaData', state.get('metaData').merge(action.payload))
    case 'chat:loadedInbox':
      // Don't overwrite existing verified inbox data
      const existingRows = state.get('inbox')
      return state.set('inbox', sortInbox(action.payload.inbox.map(newRow => {
        const id = newRow.get('conversationIDKey')
        const existingRow = existingRows.find(existingRow => existingRow.get('conversationIDKey') === id)
        return existingRow || newRow
      })))
    case 'chat:updateInboxComplete':
      return state.set('inbox', state.get('inbox').filter(i => i.get('validated')))
    case 'chat:updateInbox':
      const convo: InboxState = action.payload.conversation
      const toFind = convo.get('conversationIDKey')
      const oldInbox = state.get('inbox')
      const existing = oldInbox.findEntry(i => i.get('conversationIDKey') === toFind)
      return state.set('inbox', sortInbox(oldInbox.set(existing ? existing[0] : -1, convo)))
    case 'chat:updateBrokenTracker':
      const userToBroken = action.payload.userToBroken
      let metaData = state.get('metaData')

      Object.keys(userToBroken).forEach(user => {
        metaData = metaData.update(user, new MetaDataRecord(), old => old.set('brokenTracker', userToBroken[user]))
      })

      return state.set('metaData', metaData)
    case 'chat:newFakeConversation': {
      const newConversationStates = state.get('conversationStates').update(
        action.payload.conversationIDKey,
        initialConversation,
        conversation => conversation.set('moreToLoad', false)
      )

      const newInbox = state.get('inbox').unshift(new InboxStateRecord({
        conversationIDKey: action.payload.conversationIDKey,
        isFake: true,
        participants: new List(action.payload.participants),
        time: Date.now(),
        validated: true,
      }))

      return state.set('inbox', newInbox).set('conversationStates', newConversationStates)
    }
    case WindowConstants.changedFocus:
      return state.set('focused', action.payload)
  }

  return state
}

export default reducer
