// @flow
import * as Constants from '../constants/chat'
import * as ChatGen from '../actions/chat-gen'
import {Set, List, Map} from 'immutable'
import {reachabilityReachable} from '../constants/types/flow-types'

const initialState: Constants.State = Constants.makeState()
const initialConversation: Constants.ConversationState = Constants.makeConversationState()

type ConversationsStates = Map<Constants.ConversationIDKey, Constants.ConversationState>
type ConversationUpdateFn = (c: Constants.ConversationState) => Constants.ConversationState
function updateConversation(
  conversationStates: ConversationsStates,
  conversationIDKey: Constants.ConversationIDKey,
  conversationUpdateFn: ConversationUpdateFn
): ConversationsStates {
  return conversationStates.update(conversationIDKey, initialConversation, conversationUpdateFn)
}

function reducer(state: Constants.State = initialState, action: ChatGen.Actions) {
  switch (action.type) {
    case ChatGen.resetStore:
      return Constants.makeState()
    case ChatGen.deleteEntity: {
      const {keyPath, ids} = action.payload
      // $FlowIssue flow can't guarantee the keypath works for all cases
      return state.updateIn(keyPath, map => map.deleteAll(ids))
    }
    case ChatGen.mergeEntity: {
      const {keyPath, entities} = action.payload
      return state.mergeDeepIn(keyPath, entities)
    }
    case ChatGen.replaceEntity: {
      const {keyPath, entities} = action.payload
      return state.mergeIn(keyPath, entities)
    }
    case ChatGen.subtractEntity: {
      const {keyPath, entities} = action.payload
      // $FlowIssue flow can't guarantee the keypath works for all cases
      return state.updateIn(keyPath, set => set.subtract(entities))
    }
    case ChatGen.clearMessages: {
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
    case ChatGen.setLoaded: {
      const {conversationIDKey, isLoaded} = action.payload
      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation =>
          conversation.set('isLoaded', isLoaded)
        )

      return state.set('conversationStates', newConversationStates)
    }
    case ChatGen.prependMessages: {
      const {moreToLoad, conversationIDKey} = action.payload
      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation => {
          return conversation.set('moreToLoad', moreToLoad)
        })

      return state.set('conversationStates', newConversationStates)
    }
    case ChatGen.appendMessages: {
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
    case ChatGen.setTypers: {
      const {conversationIDKey, typing} = action.payload
      return state.update('conversationStates', conversationStates =>
        updateConversation(conversationStates, conversationIDKey, conversation =>
          conversation.set('typing', Set(typing))
        )
      )
    }
    case ChatGen.markThreadsStale: {
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
    case ChatGen.inboxSynced: {
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
    case ChatGen.updateLatestMessage:
      // Clear new messages id of conversation
      const newConversationStates = state
        .get('conversationStates')
        .update(action.payload.conversationIDKey, initialConversation, conversation =>
          conversation.set('firstNewMessageID', null)
        )
      state = state.set('conversationStates', newConversationStates)
      return state
    case ChatGen.loadingMessages: {
      const {isRequesting, conversationIDKey} = action.payload
      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation =>
          conversation.set('isRequesting', isRequesting)
        )
      return state.set('conversationStates', newConversationStates)
    }
    case ChatGen.updatedMetadata:
      return state.set('metaData', state.get('metaData').merge(action.payload.updated))
    case ChatGen.updateBrokenTracker:
      const userToBroken = action.payload.userToBroken
      let metaData = state.get('metaData')

      Object.keys(userToBroken).forEach(user => {
        metaData = metaData.update(user, Constants.makeMetaData(), old =>
          old.set('brokenTracker', userToBroken[user])
        )
      })

      return state.set('metaData', metaData)
    case ChatGen.clearRekey: {
      const {conversationIDKey} = action.payload
      return state.set('rekeyInfos', state.get('rekeyInfos').delete(conversationIDKey))
    }
    case ChatGen.updateInboxRekeyOthers: {
      const {conversationIDKey, rekeyers} = action.payload
      return state.set(
        'rekeyInfos',
        state
          .get('rekeyInfos')
          .set(conversationIDKey, Constants.makeRekeyInfo({rekeyParticipants: List(rekeyers)}))
      )
    }
    case ChatGen.updateInboxRekeySelf: {
      const {conversationIDKey} = action.payload
      return state.set(
        'rekeyInfos',
        state.get('rekeyInfos').set(conversationIDKey, Constants.makeRekeyInfo({youCanRekey: true}))
      )
    }
    case ChatGen.addPending: {
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
    case ChatGen.removeTempPendingConversations: {
      const tempPendingConvIDs = state.tempPendingConversations.filter(v => v).keySeq().toArray()
      return state
        .update('tempPendingConversations', tempPendingConversations => tempPendingConversations.clear())
        .update('pendingConversations', pendingConversations =>
          pendingConversations.filterNot((v, k) => tempPendingConvIDs.includes(k))
        )
    }
    case ChatGen.pendingToRealConversation: {
      const {oldKey} = action.payload
      const oldPending = state.get('pendingConversations')
      if (oldPending.get(oldKey)) {
        return state.set('pendingConversations', oldPending.remove(oldKey))
      } else {
        console.warn("couldn't find pending to upgrade", oldKey)
      }
      break
    }
    case ChatGen.updateFinalizedState: {
      const fs = action.payload.finalizedState
      return state.update('finalizedState', finalizedState => finalizedState.merge(fs))
    }
    case ChatGen.updateSupersedesState: {
      const ss = action.payload.supersedesState
      return state.update('supersedesState', supersedesState => supersedesState.merge(ss))
    }
    case ChatGen.updateSupersededByState: {
      const sbs = action.payload.supersededByState
      return state.update('supersededByState', supersededByState => supersededByState.merge(sbs))
    }
    case ChatGen.showEditor: {
      return state.set('editingMessage', action.payload.message)
    }
    case ChatGen.setPreviousConversation: {
      return state.set('previousConversation', action.payload.conversationIDKey)
    }
    case ChatGen.threadLoadedOffline: {
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
      if (action.payload.reachability.reachable === reachabilityReachable.yes) {
        const newConversationStates = state
          .get('conversationStates')
          .map(conversation => conversation.set('loadedOffline', false))
        return state.set('conversationStates', newConversationStates)
      }
      break
    }
    case ChatGen.setInboxGlobalUntrustedState: {
      return state.set('inboxGlobalUntrustedState', action.payload.inboxGlobalUntrustedState)
    }
    case ChatGen.setInboxFilter: {
      return state.set('inboxFilter', action.payload.filter)
    }
    case ChatGen.newChat: {
      return state.set('inSearch', true)
    }
    case ChatGen.exitSearch: {
      return state.set('inSearch', false)
    }
    case 'teams:setChannelCreationError': {
      const {payload: {channelCreationError}} = action
      return state.set('channelCreationError', channelCreationError)
    }
    case 'teams:setTeamCreationError': {
      const {payload: {teamCreationError}} = action
      return state.set('teamCreationError', teamCreationError)
    }
    case 'teams:setTeamCreationPending': {
      const {payload: {teamCreationPending}} = action
      return state.set('teamCreationPending', teamCreationPending)
    }
    case 'teams:setTeamJoinError': {
      const {payload: {teamJoinError}} = action
      return state.set('teamJoinError', teamJoinError)
    }
    case 'teams:setTeamJoinSuccess': {
      const {payload: {teamJoinSuccess}} = action
      return state.set('teamJoinSuccess', teamJoinSuccess)
    }
  }

  return state
}

export default reducer
