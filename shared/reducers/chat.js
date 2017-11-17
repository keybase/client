// @flow
import * as Constants from '../constants/chat'
import * as Types from '../constants/types/chat'
import * as ChatGen from '../actions/chat-gen'
import * as GregorGen from '../actions/gregor-gen'
import {Set, List, Map} from 'immutable'
import {reachabilityReachable} from '../constants/types/flow-types'

const initialState: Types.State = Constants.makeState()
const initialConversation: Types.ConversationState = Constants.makeConversationState()

type ConversationsStates = Map<Types.ConversationIDKey, Types.ConversationState>
type ConversationUpdateFn = (c: Types.ConversationState) => Types.ConversationState
function updateConversation(
  conversationStates: ConversationsStates,
  conversationIDKey: Types.ConversationIDKey,
  conversationUpdateFn: ConversationUpdateFn
): ConversationsStates {
  return conversationStates.update(conversationIDKey, initialConversation, conversationUpdateFn)
}

const deleteEntity = (state, action) => {
  const {keyPath, ids} = action.payload
  // $FlowIssue flow can't guarantee the keypath works for all cases
  return state.updateIn(keyPath, map => map.deleteAll(ids))
}
const mergeEntity = (state, action) => {
  const {keyPath, entities} = action.payload
  return state.mergeDeepIn(keyPath, entities)
}
const replaceEntity = (state, action) => {
  const {keyPath, entities} = action.payload
  return state.mergeIn(keyPath, entities)
}
const subtractEntity = (state, action) => {
  const {keyPath, entities} = action.payload
  // $FlowIssue flow can't guarantee the keypath works for all cases
  return state.updateIn(keyPath, set => set.subtract(entities))
}
const clearMessages = (state, action) => {
  const {conversationIDKey} = action.payload
  const origConversationState = state.get('conversationStates').get(conversationIDKey)
  if (!origConversationState) {
    console.warn("Attempted to clear conversation state that doesn't exist")
    return state
  }

  const clearedConversationState = initialConversation.merge({
    firstNewMessageID: origConversationState.get('firstNewMessageID'),
  })
  return state.update('conversationStates', conversationStates =>
    conversationStates.set(conversationIDKey, clearedConversationState)
  )
}
const setLoaded = (state, action) => {
  const {conversationIDKey, isLoaded} = action.payload
  const newConversationStates = state
    .get('conversationStates')
    .update(conversationIDKey, initialConversation, conversation => conversation.set('isLoaded', isLoaded))

  return state.set('conversationStates', newConversationStates)
}
const prependMessages = (state, action) => {
  const {moreToLoad, conversationIDKey} = action.payload
  const newConversationStates = state
    .get('conversationStates')
    .update(conversationIDKey, initialConversation, conversation => {
      return conversation.set('moreToLoad', moreToLoad)
    })

  return state.set('conversationStates', newConversationStates)
}
const appendMessages = (state, action) => {
  const {messages: appendMessages, isSelected, conversationIDKey, isAppFocused} = action.payload

  const newConversationStates = state
    .get('conversationStates')
    .update(conversationIDKey, initialConversation, conversation => {
      const firstMessage = appendMessages[0]
      const inConversationFocused = isSelected && isAppFocused
      if (!conversation.get('firstNewMessageID') && !inConversationFocused && firstMessage) {
        // Set first new message if we don't have one set, and are not in
        // the conversation with window focused
        conversation = conversation.set('firstNewMessageID', firstMessage.messageID)
      } else if (inConversationFocused) {
        // Clear new message if we received a new message while in
        // conversation and window is focused
        conversation = conversation.set('firstNewMessageID', null)
      }

      return conversation
    })

  return state.set('conversationStates', newConversationStates)
}
const setTypers = (state, action) => {
  const {conversationIDKey, typing} = action.payload
  return state.update('conversationStates', conversationStates =>
    updateConversation(conversationStates, conversationIDKey, conversation =>
      conversation.set('typing', Set(typing))
    )
  )
}
const markThreadsStale = (state, action) => {
  const {updates} = action.payload
  const convIDs = updates.map(u => Constants.conversationIDToKey(u.convID))
  return state.update('conversationStates', conversationStates =>
    conversationStates.map((conversationState, conversationIDKey) => {
      if (convIDs.length === 0 || convIDs.includes(conversationIDKey)) {
        return conversationState.set('isStale', true)
      }
      return conversationState
    })
  )
}
const inboxSynced = (state, action) => {
  const {convs} = action.payload
  const convIDs = convs.map(u => u.convID)
  return state.update('conversationStates', conversationStates =>
    conversationStates.map((conversationState, conversationIDKey) => {
      if (convIDs.length === 0 || convIDs.includes(conversationIDKey)) {
        return conversationState.set('isStale', true)
      }
      return conversationState
    })
  )
}
const updateLatestMessage = (state, action) => {
  // Clear new messages id of conversation
  const newConversationStates = state
    .get('conversationStates')
    .update(action.payload.conversationIDKey, initialConversation, conversation =>
      conversation.set('firstNewMessageID', null)
    )
  state = state.set('conversationStates', newConversationStates)
  return state
}
const loadingMessages = (state, action) => {
  const {isRequesting, conversationIDKey} = action.payload
  const newConversationStates = state
    .get('conversationStates')
    .update(conversationIDKey, initialConversation, conversation =>
      conversation.set('isRequesting', isRequesting)
    )
  return state.set('conversationStates', newConversationStates)
}
const updatedMetadata = (state, action) => {
  return state.set('metaData', state.get('metaData').merge(action.payload.updated))
}
const updateBrokenTracker = (state, action) => {
  const userToBroken = action.payload.userToBroken
  let metaData = state.get('metaData')

  Object.keys(userToBroken).forEach(user => {
    metaData = metaData.update(user, Constants.makeMetaData(), old =>
      old.set('brokenTracker', userToBroken[user])
    )
  })

  return state.set('metaData', metaData)
}
const clearRekey = (state, action) => {
  const {conversationIDKey} = action.payload
  return state.set('rekeyInfos', state.get('rekeyInfos').delete(conversationIDKey))
}
const updateInboxRekeyOthers = (state, action) => {
  const {conversationIDKey, rekeyers} = action.payload
  return state.set(
    'rekeyInfos',
    state
      .get('rekeyInfos')
      .set(conversationIDKey, Constants.makeRekeyInfo({rekeyParticipants: List(rekeyers)}))
  )
}
const updateInboxRekeySelf = (state, action) => {
  const {conversationIDKey} = action.payload
  return state.set(
    'rekeyInfos',
    state.get('rekeyInfos').set(conversationIDKey, Constants.makeRekeyInfo({youCanRekey: true}))
  )
}
const addPending = (state, action) => {
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
const removeTempPendingConversations = (state, action) => {
  const tempPendingConvIDs = state.tempPendingConversations.filter(v => v).keySeq().toArray()
  return state
    .update('tempPendingConversations', tempPendingConversations => tempPendingConversations.clear())
    .update('pendingConversations', pendingConversations =>
      pendingConversations.filterNot((v, k) => tempPendingConvIDs.includes(k))
    )
}
const pendingToRealConversation = (state, action) => {
  const {oldKey} = action.payload
  const oldPending = state.get('pendingConversations')
  if (oldPending.get(oldKey)) {
    return state.set('pendingConversations', oldPending.remove(oldKey))
  } else {
    console.warn("couldn't find pending to upgrade", oldKey)
  }
  return state
}
const updateFinalizedState = (state, action) => {
  const fs = action.payload.finalizedState
  return state.update('finalizedState', finalizedState => finalizedState.merge(fs))
}
const updateSupersedesState = (state, action) => {
  const ss = action.payload.supersedesState
  return state.update('supersedesState', supersedesState => supersedesState.merge(ss))
}
const updateSupersededByState = (state, action) => {
  const sbs = action.payload.supersededByState
  return state.update('supersededByState', supersededByState => supersededByState.merge(sbs))
}
const showEditor = (state, action) => {
  return state.set('editingMessage', action.payload.message)
}
const setPreviousConversation = (state, action) => {
  return state.set('previousConversation', action.payload.conversationIDKey)
}
const threadLoadedOffline = (state, action) => {
  const {conversationIDKey} = action.payload
  const newConversationStates = state
    .get('conversationStates')
    .update(conversationIDKey, initialConversation, conversation => conversation.set('loadedOffline', true))
  return state.set('conversationStates', newConversationStates)
}
const updateReachability = (state, action) => {
  // reset this when we go online
  if (action.payload.reachability.reachable === reachabilityReachable.yes) {
    const newConversationStates = state
      .get('conversationStates')
      .map(conversation => conversation.set('loadedOffline', false))
    return state.set('conversationStates', newConversationStates)
  }
  return state
}
const setInboxGlobalUntrustedState = (state, action) => {
  return state.set('inboxGlobalUntrustedState', action.payload.inboxGlobalUntrustedState)
}
const setInboxFilter = (state, action) => {
  return state.set('inboxFilter', action.payload.filter)
}
const newChat = (state, action) => {
  return state.set('inSearch', true)
}
const exitSearch = (state, action) => {
  return state.set('inSearch', false)
}
const setTeamCreationError = (state, action) => {
  const {payload: {teamCreationError}} = action
  return state.set('teamCreationError', teamCreationError)
}
const setTeamCreationPending = (state, action) => {
  const {payload: {teamCreationPending}} = action
  return state.set('teamCreationPending', teamCreationPending)
}
const setTeamJoinError = (state, action) => {
  const {payload: {teamJoinError}} = action
  return state.set('teamJoinError', teamJoinError)
}
const setTeamJoinSuccess = (state, action) => {
  const {payload: {teamJoinSuccess}} = action
  return state.set('teamJoinSuccess', teamJoinSuccess)
}

function reducer(state: Types.State = initialState, action: ChatGen.Actions) {
  switch (action.type) {
    case ChatGen.addPending: return addPending(state, action) // prettier-ignore
    case ChatGen.appendMessages: return appendMessages(state, action) // prettier-ignore
    case ChatGen.clearMessages: return clearMessages(state, action) // prettier-ignore
    case ChatGen.clearRekey: return clearRekey(state, action) // prettier-ignore
    case ChatGen.deleteEntity: return deleteEntity(state, action) // prettier-ignore
    case ChatGen.exitSearch: return exitSearch(state, action) // prettier-ignore
    case ChatGen.inboxSynced: return inboxSynced(state, action) // prettier-ignore
    case ChatGen.loadingMessages: return loadingMessages(state, action) // prettier-ignore
    case ChatGen.markThreadsStale: return markThreadsStale(state, action) // prettier-ignore
    case ChatGen.mergeEntity: return mergeEntity(state, action) // prettier-ignore
    case ChatGen.newChat: return newChat(state, action) // prettier-ignore
    case ChatGen.pendingToRealConversation: return pendingToRealConversation(state, action) // prettier-ignore
    case ChatGen.prependMessages: return prependMessages(state, action) // prettier-ignore
    case ChatGen.removeTempPendingConversations: return removeTempPendingConversations(state, action) // prettier-ignore
    case ChatGen.replaceEntity: return replaceEntity(state, action) // prettier-ignore
    case ChatGen.resetStore: return Constants.makeState() // prettier-ignore
    case ChatGen.setInboxFilter: return setInboxFilter(state, action) // prettier-ignore
    case ChatGen.setInboxGlobalUntrustedState: return setInboxGlobalUntrustedState(state, action) // prettier-ignore
    case ChatGen.setLoaded: return setLoaded(state, action) // prettier-ignore
    case ChatGen.setPreviousConversation: return setPreviousConversation(state, action) // prettier-ignore
    case ChatGen.setTypers: return setTypers(state, action) // prettier-ignore
    case ChatGen.showEditor: return showEditor(state, action) // prettier-ignore
    case ChatGen.subtractEntity: return subtractEntity(state, action) // prettier-ignore
    case ChatGen.threadLoadedOffline: return threadLoadedOffline(state, action) // prettier-ignore
    case ChatGen.updateBrokenTracker: return updateBrokenTracker(state, action) // prettier-ignore
    case ChatGen.updateFinalizedState: return updateFinalizedState(state, action) // prettier-ignore
    case ChatGen.updateInboxRekeyOthers: return updateInboxRekeyOthers(state, action) // prettier-ignore
    case ChatGen.updateInboxRekeySelf: return updateInboxRekeySelf(state, action) // prettier-ignore
    case ChatGen.updateLatestMessage: return updateLatestMessage(state, action) // prettier-ignore
    case ChatGen.updateSupersededByState: return updateSupersededByState(state, action) // prettier-ignore
    case ChatGen.updateSupersedesState: return updateSupersedesState(state, action) // prettier-ignore
    case ChatGen.updatedMetadata: return updatedMetadata(state, action) // prettier-ignore
    case GregorGen.updateReachability: return updateReachability(state, action) // prettier-ignore
    case 'teams:setTeamCreationError': return setTeamCreationError(state, action) // prettier-ignore
    case 'teams:setTeamCreationPending': return setTeamCreationPending(state, action) // prettier-ignore
    case 'teams:setTeamJoinError': return setTeamJoinError(state, action) // prettier-ignore
    case 'teams:setTeamJoinSuccess': return setTeamJoinSuccess(state, action) // prettier-ignore
    // Saga only actions
    case ChatGen.attachmentLoaded:
    case ChatGen.attachmentSaveFailed:
    case ChatGen.attachmentSaveStart:
    case ChatGen.attachmentSaved:
    case ChatGen.badgeAppForChat:
    case ChatGen.blockConversation:
    case ChatGen.deleteMessage:
    case ChatGen.downloadProgress:
    case ChatGen.editMessage:
    case ChatGen.getInboxAndUnbox:
    case ChatGen.inboxStale:
    case ChatGen.inboxStoreLoaded:
    case ChatGen.incomingMessage:
    case ChatGen.incomingTyping:
    case ChatGen.joinConversation:
    case ChatGen.leaveConversation:
    case ChatGen.loadAttachment:
    case ChatGen.loadAttachmentPreview:
    case ChatGen.loadInbox:
    case ChatGen.loadMoreMessages:
    case ChatGen.markSeenMessage:
    case ChatGen.muteConversation:
    case ChatGen.openAttachmentPopup:
    case ChatGen.openConversation:
    case ChatGen.openFolder:
    case ChatGen.openTeamConversation:
    case ChatGen.openTlfInChat:
    case ChatGen.outboxMessageBecameReal:
    case ChatGen.postMessage:
    case ChatGen.removeOutboxMessage:
    case ChatGen.retryAttachment:
    case ChatGen.retryMessage:
    case ChatGen.saveAttachment:
    case ChatGen.saveAttachmentNative:
    case ChatGen.selectAttachment:
    case ChatGen.selectConversation:
    case ChatGen.selectNext:
    case ChatGen.setNotifications:
    case ChatGen.setupChatHandlers:
    case ChatGen.shareAttachment:
    case ChatGen.startConversation:
    case ChatGen.toggleChannelWideNotifications:
    case ChatGen.unboxConversations:
    case ChatGen.unboxMore:
    case ChatGen.updateBadging:
    case ChatGen.updateInboxComplete:
    case ChatGen.updateMetadata:
    case ChatGen.updateSnippet:
    case ChatGen.updateTempMessage:
    case ChatGen.updateThread:
    case ChatGen.updateTyping:
    case ChatGen.updatedNotifications:
    case ChatGen.uploadProgress:
      return state

    default:
      // eslint-disable-next-line no-unused-expressions
      (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default reducer
