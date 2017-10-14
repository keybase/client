// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/chat'
import {Set, List, Map} from 'immutable'
import {ReachabilityReachable} from '../constants/types/flow-types'

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

function reducer(state: Constants.State = initialState, action: Constants.Actions) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return Constants.makeState()
    case 'chat:clearMessages': {
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
      const {moreToLoad, conversationIDKey} = action.payload
      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation => {
          return conversation.set('moreToLoad', moreToLoad)
        })

      return state.set('conversationStates', newConversationStates)
    }
    case 'chat:appendMessages': {
      const appendAction: Constants.AppendMessages = action
      const {messages: appendMessages, isSelected, conversationIDKey, isAppFocused} = appendAction.payload

      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation => {
          const firstMessage = appendMessages[0]
          const inConversationFocused = isSelected && isAppFocused
          if (!conversation.get('firstNewMessageID') && !inConversationFocused && firstMessage) {
            // Set first new message if we don't have one set, and are not in
            // the conversation with window focused
            // $FlowIssue TODO ServerMessage -> Message change
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
    case 'chat:setTypers': {
      const {conversationIDKey, typing} = action.payload
      return state.update('conversationStates', conversationStates =>
        updateConversation(conversationStates, conversationIDKey, conversation =>
          conversation.set('typing', Set(typing))
        )
      )
    }
    case 'chat:markThreadsStale': {
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
    case 'chat:inboxSynced': {
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
    case 'chat:updateLatestMessage':
      // Clear new messages id of conversation
      const newConversationStates = state
        .get('conversationStates')
        .update(action.payload.conversationIDKey, initialConversation, conversation =>
          conversation.set('firstNewMessageID', null)
        )
      state = state.set('conversationStates', newConversationStates)
      return state
    case 'chat:loadingMessages': {
      const {isRequesting, conversationIDKey} = action.payload
      const newConversationStates = state
        .get('conversationStates')
        .update(conversationIDKey, initialConversation, conversation =>
          conversation.set('isRequesting', isRequesting)
        )
      return state.set('conversationStates', newConversationStates)
    }
    case 'chat:updatedMetadata':
      return state.set('metaData', state.get('metaData').merge(action.payload.updated))
    case 'chat:updateBrokenTracker':
      const userToBroken = action.payload.userToBroken
      let metaData = state.get('metaData')

      Object.keys(userToBroken).forEach(user => {
        metaData = metaData.update(user, Constants.makeMetaData(), old =>
          old.set('brokenTracker', userToBroken[user])
        )
      })

      return state.set('metaData', metaData)
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
          .set(conversationIDKey, Constants.makeRekeyInfo({rekeyParticipants: List(rekeyers)}))
      )
    }
    case 'chat:updateInboxRekeySelf': {
      const {conversationIDKey} = action.payload
      return state.set(
        'rekeyInfos',
        state.get('rekeyInfos').set(conversationIDKey, Constants.makeRekeyInfo({youCanRekey: true}))
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
    case 'chat:setPreviousConversation': {
      return state.set('previousConversation', action.payload.conversationIDKey)
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
      return state.set('inboxFilter', action.payload.filter)
    }
    case 'chat:newChat': {
      return state.set('inSearch', true)
    }
    case 'chat:exitSearch': {
      return state.set('inSearch', false)
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
