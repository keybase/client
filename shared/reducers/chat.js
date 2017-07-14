// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/chat'
import featureFlags from '../util/feature-flags'
import {Set, List, Map} from 'immutable'
import {ReachabilityReachable} from '../constants/types/flow-types'

const initialState: Constants.State = new Constants.StateRecord()
const initialConversation: Constants.ConversationState = new Constants.ConversationStateRecord()

// dedupes and removed deleted messages. Applies edits
function _processMessages(
  seenMessages: Set<any>,
  messages: List<Constants.Message> = List(),
  prepend: List<Constants.Message> = List(),
  append: List<Constants.Message> = List(),
  deletedIDs: Set<any>
): {nextSeenMessages: Set<any>, nextMessages: List<Constants.Message>} {
  const filteredPrepend = prepend.filter(m => !seenMessages.has(m.key))
  const filteredAppendGroups = append
    .filter(m => !seenMessages.has(m.key))
    .groupBy(m => (m.type === 'Edit' || m.type === 'UpdateAttachment' ? m.type : 'Append'))
  const filteredAppend = filteredAppendGroups.get('Append') || List()

  const messagesToUpdate = Map(
    prepend.concat(append).filter(m => seenMessages.has(m.key)).map(m => [m.key, m])
  )
  const updatedMessages = messages.map(m => (messagesToUpdate.has(m.key) ? messagesToUpdate.get(m.key) : m))
  // We have to check for m.messageID being falsey and set.has(undefined) is true!. We shouldn't ever have a zero messageID
  let nextMessages: List<Constants.Message> = filteredPrepend
    .concat(updatedMessages, filteredAppend)
    .filter(m => !m.messageID || !deletedIDs.has(m.messageID))
  let didSomething = filteredPrepend.count() > 0 || filteredAppend.count() > 0

  filteredAppendGroups.get('Edit', List()).forEach(edit => {
    if (edit.type !== 'Edit') {
      return
    }
    const targetMessageID = edit.targetMessageID
    // $TemporarilyNotAFlowIssue TODO ServerMessage -> Message change
    const entry = nextMessages.findEntry(m => m.messageID === targetMessageID)
    if (entry) {
      const [idx: number, message: Constants.TextMessage] = entry
      // $TemporarilyNotAFlowIssue doesn't like the intersection types
      nextMessages = nextMessages.set(idx, {
        ...message,
        message: edit.message,
        editedCount: message.editedCount + 1,
      })
      didSomething = true
    }
  })
  filteredAppendGroups.get('UpdateAttachment', List()).forEach(update => {
    if (update.type !== 'UpdateAttachment') {
      return
    }
    const targetMessageID = update.targetMessageID
    // $TemporarilyNotAFlowIssue TODO ServerMessage -> Message change
    const entry = nextMessages.findEntry(m => m.messageID === targetMessageID)
    if (entry) {
      const [idx: number, message: AttachmentMessage] = entry
      // $TemporarilyNotAFlowIssue doesn't like the intersection types
      nextMessages = nextMessages.set(idx, {...message, ...update.updates})
      didSomething = true
    }
  })

  if (didSomething) {
    const nextSeenMessages = Set(nextMessages.map(m => m.key))
    return {
      nextMessages,
      nextSeenMessages,
    }
  } else {
    return {
      nextMessages: messages,
      nextSeenMessages: seenMessages,
    }
  }
}

// _filterTypes separates out deleted message types and returns their ID's
function _filterTypes(
  inMessages: Array<Constants.Message>
): {messages: Array<Constants.Message>, deletedIDs: Array<any>} {
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

type ConversationsStates = Map<Constants.ConversationIDKey, Constants.ConversationState>
type ConversationUpdateFn = (c: Constants.ConversationState) => Constants.ConversationState
function updateConversation(
  conversationStates: ConversationsStates,
  conversationIDKey: Constants.ConversationIDKey,
  conversationUpdateFn: ConversationUpdateFn
): ConversationsStates {
  return conversationStates.update(conversationIDKey, initialConversation, conversationUpdateFn)
}

type MessageUpdateFn = (message: $Subtype<Constants.Message>) => Constants.Message
type MessageFindPredFn = (message: Constants.Message) => boolean
function updateConversationMessage(
  conversationStates: ConversationsStates,
  conversationIDKey: Constants.ConversationIDKey,
  pred: MessageFindPredFn,
  messageUpdateFn: MessageUpdateFn
): ConversationsStates {
  return updateConversation(conversationStates, conversationIDKey, conversation => {
    const index = conversation.get('messages').findIndex(pred)
    if (index < 0) {
      console.warn("Couldn't find a message to update")
      return conversation
    }
    // $FlowIssue
    return conversation.updateIn(['messages', index], messageUpdateFn)
  })
}

function updateStateWithMessageChanged(
  state: Constants.State,
  conversationIDKey: Constants.ConversationIDKey,
  pred: MessageFindPredFn,
  toMerge: $Shape<Constants.Message>
) {
  let messageKey

  let newState = state.update('conversationStates', conversationStates =>
    updateConversationMessage(conversationStates, conversationIDKey, pred, m => {
      messageKey = m.key
      return {
        ...m,
        ...toMerge,
      }
    })
  )

  // Note: this may be overly conservative: it updates messageMap with the
  // latest key only, and does not remove the old key in case of a key change.
  // We may find that deleting the old key is appropriate in the future.
  const newKey = toMerge.key || messageKey
  if (newKey) {
    newState = newState.set(
      'messageMap',
      state.get('messageMap').update(newKey, message => ({
        ...message,
        ...toMerge,
      }))
    )
  }

  return newState
}

function updateStateWithMessageIDChanged(
  state: Constants.State,
  conversationIDKey: Constants.ConversationIDKey,
  messageID: Constants.MessageID,
  toMerge: $Shape<Constants.Message>
) {
  const pred = item => !!item.messageID && item.messageID === messageID
  return updateStateWithMessageChanged(state, conversationIDKey, pred, toMerge)
}

function updateStateWithMessageOutboxIDChanged(
  state: Constants.State,
  conversationIDKey: Constants.ConversationIDKey,
  outboxID: Constants.OutboxIDKey,
  toMerge: $Shape<Constants.Message>
) {
  const pred = item => !!item.outboxID && item.outboxID === outboxID
  return updateStateWithMessageChanged(state, conversationIDKey, pred, toMerge)
}

function updateLocalMessageState(
  state: Constants.State,
  messageKey: Constants.MessageKey,
  toMerge: $Shape<Constants.LocalMessageStateProps>
) {
  // $FlowIssue updateIn
  return state.updateIn(
    ['localMessageStates', messageKey],
    Constants.defaultLocalMessageState,
    localMessageState => localMessageState.merge(toMerge)
  )
}

function sortInbox(inbox: List<Constants.InboxState>): List<Constants.InboxState> {
  return inbox.sort((a, b) => {
    return b.get('time') - a.get('time')
  })
}

function reducer(state: Constants.State = initialState, action: Constants.Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return new Constants.StateRecord()
    case 'chat:removeOutboxMessage': {
      const {conversationIDKey, outboxID} = action.payload
      const messageKey = Constants.messageKey(conversationIDKey, 'outboxIDText', outboxID)
      return state
        .update('conversationStates', conversationStates =>
          updateConversation(conversationStates, conversationIDKey, conversation =>
            conversation.update('messages', messages => messages.filter(m => m.outboxID !== outboxID))
          )
        )
        .set('messageMap', state.get('messageMap').filter((v, k) => k !== messageKey))
    }
    case 'chat:clearMessages': {
      const {conversationIDKey} = action.payload
      const origConversationState = state.get('conversationStates').get(conversationIDKey)
      if (!origConversationState) {
        console.warn("Attempted to clear conversation state that doesn't exist")
        return state
      }

      const newMessages = origConversationState
        .get('messages')
        .filter(m => m.messageState === 'pending' || m.messageState === 'failed')
      const newSeenMessages = Set(newMessages.map(m => m.key))

      // $FlowIssue
      const clearedConversationState = initialConversation.merge({
        firstNewMessageID: origConversationState.get('firstNewMessageID'),
        messages: newMessages,
        seenMessages: newSeenMessages,
      })
      return state.update('conversationStates', conversationStates =>
        conversationStates.set(conversationIDKey, clearedConversationState)
      )
    }
    case 'chat:clearSearchResults': {
      return state.set('searchResults', initialState.searchResults)
    }

    case 'chat:setLoaded': {
      const {conversationIDKey, isLoaded} = action.payload
      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation =>
          conversation.set('isLoaded', isLoaded)
        )

      return state.set('conversationStates', newConversationStates)
    }
    case 'chat:prependMessages': {
      const {messages: prependMessages, moreToLoad, paginationNext, conversationIDKey} = action.payload
      const {messages, deletedIDs} = _filterTypes(prependMessages)

      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation => {
          const nextDeletedIDs = conversation.get('deletedIDs').add(...deletedIDs)
          const {nextMessages, nextSeenMessages} = _processMessages(
            conversation.seenMessages,
            conversation.messages,
            List(messages),
            List(),
            nextDeletedIDs
          )

          return conversation
            .set('messages', nextMessages)
            .set('seenMessages', nextSeenMessages)
            .set('moreToLoad', moreToLoad)
            .set('paginationNext', paginationNext)
            .set('deletedIDs', nextDeletedIDs)
        })

      const toMerge = Map(
        newConversationStates.getIn([conversationIDKey, 'messages']).map(val => [val.key, val])
      )
      return state
        .set('conversationStates', newConversationStates)
        .set('messageMap', state.get('messageMap').merge(toMerge))
    }
    case 'chat:appendMessages': {
      const appendAction: Constants.AppendMessages = action
      const {messages: appendMessages, isSelected, conversationIDKey, isAppFocused} = appendAction.payload

      const {messages, deletedIDs} = _filterTypes(appendMessages)

      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation => {
          const nextDeletedIDs = conversation.get('deletedIDs').add(...deletedIDs)
          const {nextMessages, nextSeenMessages} = _processMessages(
            conversation.seenMessages,
            conversation.messages,
            List(),
            List(messages),
            nextDeletedIDs
          )

          const firstMessage = appendMessages[0]
          const inConversationFocused = isSelected && isAppFocused
          if (!conversation.get('firstNewMessageID') && !inConversationFocused) {
            // Set first new message if we don't have one set, and are not in
            // the conversation with window focused
            // $TemporarilyNotAFlowIssue TODO ServerMessage -> Message change
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

      const toMerge = newConversationStates
        .getIn([conversationIDKey, 'messages'])
        .reduce((map, val) => map.set(val.key, val), Map())
      return state
        .set('conversationStates', newConversationStates)
        .set('messageMap', state.get('messageMap').merge(toMerge))
    }
    case 'chat:updateTempMessage': {
      if (action.error) {
        console.warn('Error in updateTempMessage')
        const {conversationIDKey, outboxID} = action.payload
        return updateStateWithMessageOutboxIDChanged(state, conversationIDKey, outboxID, {
          messageState: 'failed',
        })
      } else {
        const {outboxID, message, conversationIDKey} = action.payload
        return updateStateWithMessageOutboxIDChanged(
          state,
          conversationIDKey,
          outboxID,
          message
        ).update('inbox', inbox =>
          inbox.map((i, inboxIdx) => {
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
    case 'chat:updateMessage': {
      const {messageID, message, conversationIDKey} = action.payload
      return updateStateWithMessageIDChanged(state, conversationIDKey, messageID, message)
    }
    case 'chat:markSeenMessage': {
      const {messageKey, conversationIDKey} = action.payload
      return state.update('conversationStates', conversationStates =>
        updateConversation(conversationStates, conversationIDKey, conversation =>
          conversation.update('seenMessages', seenMessages => seenMessages.add(messageKey))
        )
      )
    }
    case 'chat:setTypers': {
      const {conversationIDKey, typing} = action.payload
      return state.update('conversationStates', conversationStates =>
        updateConversation(conversationStates, conversationIDKey, conversation =>
          conversation.set('typing', Set(typing))
        )
      )
    }
    case 'chat:createPendingFailure': {
      const {failureDescription, outboxID} = action.payload
      return state.set('pendingFailures', state.get('pendingFailures').set(outboxID, failureDescription))
    }
    case 'chat:removePendingFailure': {
      const {outboxID} = action.payload
      return state.set('pendingFailures', state.get('pendingFailures').delete(outboxID))
    }
    case 'chat:attachmentLoaded': {
      const {messageKey, path, isPreview} = action.payload
      let toMerge
      if (isPreview) {
        toMerge = {previewPath: path, previewProgress: null}
      } else {
        toMerge = {downloadedPath: path, downloadProgress: null}
      }
      return updateLocalMessageState(state, messageKey, toMerge)
    }
    case 'chat:attachmentSaveStart': {
      const {messageKey} = action.payload
      return updateLocalMessageState(state, messageKey, {savedPath: false})
    }
    case 'chat:attachmentSaved': {
      const {messageKey, path} = action.payload
      return updateLocalMessageState(state, messageKey, {savedPath: path})
    }
    case 'chat:attachmentSaveFailed': {
      const {messageKey} = action.payload
      return updateLocalMessageState(state, messageKey, {savedPath: null})
    }
    case 'chat:downloadProgress': {
      const {messageKey, isPreview, progress} = action.payload
      const progressField = isPreview ? 'previewProgress' : 'downloadProgress'
      const toMerge = {
        [progressField]: progress,
      }
      return updateLocalMessageState(state, messageKey, toMerge)
    }
    case 'chat:uploadProgress': {
      const {messageKey, progress} = action.payload
      return updateLocalMessageState(state, messageKey, {uploadProgress: progress})
    }
    case 'chat:outboxMessageBecameReal': {
      const {oldMessageKey, newMessageKey} = action.payload
      const localMessageState = state.getIn(['localMessageStates', oldMessageKey])
      // $FlowIssue deleteIn
      return state
        .deleteIn(['localMessageStates', oldMessageKey])
        .setIn(['localMessageStates', newMessageKey], localMessageState)
    }
    case 'chat:markThreadsStale': {
      const {convIDs} = action.payload
      return state.update('conversationStates', conversationStates =>
        conversationStates.map((conversationState, conversationIDKey) => {
          if (convIDs.length === 0 || convIDs.includes(conversationIDKey)) {
            return conversationState.set('isStale', true)
          }
          return conversationState
        })
      )
    }
    case 'chat:updateLatestMessage':
      // Clear new messages id of conversation
      const newConversationStates = state
        .get('conversationStates')
        .update(action.payload.conversationIDKey, initialConversation, conversation =>
          conversation.set('firstNewMessageID', null)
        )
      state = state.set('conversationStates', newConversationStates)
      return state
    case 'chat:selectConversation': {
      //  ensure selected converations are visible if they exist
      const {conversationIDKey} = action.payload
      return state.set('alwaysShow', state.get('alwaysShow').add(conversationIDKey))
    }
    case 'chat:loadingMessages': {
      const {isRequesting, conversationIDKey} = action.payload
      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation =>
          conversation.set('isRequesting', isRequesting)
        )
      return state.set('conversationStates', newConversationStates)
    }
    case 'chat:updatePaginationNext': {
      const {conversationIDKey, paginationNext} = action.payload
      const newConversationStates = state
        .get('conversationStates')
        .update(
          conversationIDKey,
          initialConversation,
          conversation =>
            conversation.get('paginationNext')
              ? conversation
              : conversation.set('paginationNext', paginationNext)
        )
      return state.set('conversationStates', newConversationStates)
    }
    case 'chat:updatedMetadata':
      return state.set('metaData', state.get('metaData').merge(action.payload.updated))
    case 'chat:loadedInbox':
      // Don't overwrite existing verified inbox data
      const existingRows = state.get('inbox')
      const newInbox = sortInbox(
        action.payload.inbox.map(newRow => {
          const id = newRow.get('conversationIDKey')
          const existingRow = existingRows.find(existingRow => existingRow.get('conversationIDKey') === id)
          return existingRow || newRow
        })
      )

      return state.set('inbox', newInbox).set('rekeyInfos', Map())
    case 'chat:setUnboxing':
      const {conversationIDKeys} = action.payload
      return state.set(
        'inbox',
        state
          .get('inbox')
          .map(
            i =>
              conversationIDKeys.includes(i.conversationIDKey)
                ? i.set('state', action.error ? 'untrusted' : 'unboxing')
                : i
          )
      )
    case 'chat:updateInbox':
      const convo: Constants.InboxState = action.payload.conversation
      const toFind = convo.get('conversationIDKey')
      const oldInbox = state.get('inbox')
      const existing = oldInbox.findEntry(i => i.get('conversationIDKey') === toFind)
      let updatedInbox = existing ? oldInbox.set(existing[0], convo) : oldInbox.push(convo)
      // If the convo's just been blocked, delete it from the inbox.
      if (existing && ['blocked', 'reported'].includes(convo.get('status'))) {
        updatedInbox = updatedInbox.delete(existing[0])
      }
      // time changed so we need to sort
      if (!existing || existing[1].time !== convo.get('time')) {
        updatedInbox = sortInbox(updatedInbox)
      }
      return state.set('inbox', updatedInbox)
    case 'chat:updateBrokenTracker':
      const userToBroken = action.payload.userToBroken
      let metaData = state.get('metaData')

      Object.keys(userToBroken).forEach(user => {
        metaData = metaData.update(user, new Constants.MetaDataRecord(), old =>
          old.set('brokenTracker', userToBroken[user])
        )
      })

      return state.set('metaData', metaData)
    case 'chat:updateConversationUnreadCounts':
      return state.set('conversationUnreadCounts', action.payload.conversationUnreadCounts)
    case 'chat:clearRekey': {
      const {conversationIDKey} = action.payload
      return state.set('rekeyInfos', state.get('rekeyInfos').delete(conversationIDKey))
    }
    case 'chat:updateInboxRekeyOthers': {
      const {conversationIDKey, rekeyers} = action.payload
      return state.set(
        'rekeyInfos',
        state
          .get('rekeyInfos')
          .set(conversationIDKey, new Constants.RekeyInfoRecord({rekeyParticipants: List(rekeyers)}))
      )
    }
    case 'chat:updateInboxRekeySelf': {
      const {conversationIDKey} = action.payload
      return state.set(
        'rekeyInfos',
        state.get('rekeyInfos').set(conversationIDKey, new Constants.RekeyInfoRecord({youCanRekey: true}))
      )
    }
    case 'chat:addPendingConversation': {
      const {participants, temporary} = action.payload
      const sorted = participants.sort()
      const conversationIDKey = Constants.pendingConversationIDKey(sorted.join(','))
      const tempPendingConvIDs = state.tempPendingConversations.filter(v => v).keySeq().toArray()
      return state
        .update('pendingConversations', pendingConversations =>
          // TODO use deleteAll when we update immutable
          pendingConversations
            .filterNot((v, k) => tempPendingConvIDs.includes(k))
            .set(conversationIDKey, List(sorted))
        )
        .update('tempPendingConversations', tempPendingConversations =>
          tempPendingConversations.filter(v => v).set(conversationIDKey, temporary)
        )
    }
    case 'chat:removeTempPendingConversations': {
      const tempPendingConvIDs = state.tempPendingConversations.filter(v => v).keySeq().toArray()
      return state
        .update('tempPendingConversations', tempPendingConversations => tempPendingConversations.clear())
        .update('pendingConversations', pendingConversations =>
          pendingConversations.filterNot((v, k) => tempPendingConvIDs.includes(k))
        )
    }
    case 'chat:pendingToRealConversation': {
      const {oldKey} = action.payload
      const oldPending = state.get('pendingConversations')
      if (oldPending.get(oldKey)) {
        return state.set('pendingConversations', oldPending.remove(oldKey))
      } else {
        console.warn("couldn't find pending to upgrade", oldKey)
      }
      break
    }
    case 'chat:replaceConversation': {
      const {oldKey} = action.payload
      const oldInbox = state.get('inbox')
      const idx = oldInbox.findIndex(i => i.get('conversationIDKey') === oldKey)
      if (idx !== -1) {
        return state.set('inbox', oldInbox.delete(idx))
      }
      console.warn("couldn't find conversation to upgrade", oldKey)
      break
    }
    case 'chat:updateFinalizedState': {
      const fs = action.payload.finalizedState
      return state.update('finalizedState', finalizedState => finalizedState.merge(fs))
    }
    case 'chat:updateSupersedesState': {
      const ss = action.payload.supersedesState
      return state.update('supersedesState', supersedesState => supersedesState.merge(ss))
    }
    case 'chat:updateSupersededByState': {
      const sbs = action.payload.supersededByState
      return state.update('supersededByState', supersededByState => supersededByState.merge(sbs))
    }
    case 'chat:showEditor': {
      return state.set('editingMessage', action.payload.message)
    }
    case 'chat:setInitialConversation': {
      return state.set('initialConversation', action.payload.conversationIDKey)
    }
    case 'chat:setPreviousConversation': {
      return state.set('previousConversation', action.payload.conversationIDKey)
    }
    case 'chat:stageUserForSearch': {
      const {payload: {user}} = action
      if (state.selectedUsersInSearch.includes(user)) {
        return state
      }
      return state.update('selectedUsersInSearch', l => l.push(user))
    }
    case 'chat:threadLoadedOffline': {
      const {conversationIDKey} = action.payload
      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation =>
          conversation.set('loadedOffline', true)
        )
      return state.set('conversationStates', newConversationStates)
    }
    case 'gregor:updateReachability': {
      // reset this when we go online
      if (action.payload.reachability.reachable === ReachabilityReachable.yes) {
        const newConversationStates = state
          .get('conversationStates')
          .map(conversation => conversation.set('loadedOffline', false))
        return state.set('conversationStates', newConversationStates)
      }
      break
    }
    case 'chat:inboxUntrustedState': {
      return state.set('inboxUntrustedState', action.payload.inboxUntrustedState)
    }
    case 'chat:inboxFilter': {
      return state.set('inboxFilter', List(action.payload.filter))
    }
    case 'chat:inboxSearch': {
      return state.set('inboxSearch', List(action.payload.search))
    }
    case 'chat:updateSearchResults': {
      const {payload: {searchResultTerm, searchResults, searchShowingSuggestions}} = action
      return state
        .set('searchResults', List(searchResults))
        .set('searchShowingSuggestions', searchShowingSuggestions)
        .set('searchResultTerm', searchResultTerm)
    }
    case 'chat:unstageUserForSearch': {
      const {payload: {user}} = action
      return state.update('selectedUsersInSearch', l => l.filterNot(u => u === user))
    }
    case 'chat:newChat': {
      if (featureFlags.searchv3Enabled) {
        return state.set('inSearch', true)
      }
      return state
    }
    case 'chat:exitSearch': {
      return state.set('inSearch', false)
    }
    case 'chat:pendingSearchResults': {
      const {payload: {pending}} = action
      return state.set('searchPending', pending)
    }
  }

  return state
}

export default reducer
