// @flow
import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as I from 'immutable'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/chat2'
import {isMobile} from '../constants/platform'

const initialState: Types.State = Constants.makeState()

// For a single conversation
// function conversationReducer(c: Types.Conversation, action: Chat2Gen.Actions): Types.Conversation {
// switch (action.type) {
// case Chat2Gen.inboxRefresh:
// case Chat2Gen.inboxUtrustedLoaded:
// case Chat2Gen.resetStore:
// return state
// default:
// // eslint-disable-next-line no-unused-expressions
// (action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
// return state
// }
// }
const metaMapReducer = (metaMap, action) => {
  switch (action.type) {
    case Chat2Gen.metaReceivedError: {
      switch (action.payload.error.typ) {
        case RPCChatTypes.localConversationErrorType.otherrekeyneeded: // fallthrough
        case RPCChatTypes.localConversationErrorType.selfrekeyneeded: {
          const {error, username, conversationIDKey} = action.payload
          const participants = error.rekeyInfo
            ? I.Set([].concat(error.rekeyInfo.writerNames, error.rekeyInfo.readerNames).filter(Boolean))
            : I.Set(error.unverifiedTLFName.split(','))
          const old = metaMap.get(conversationIDKey)
          const rekeyers = I.Set(
            action.payload.error.typ === RPCChatTypes.localConversationErrorType.selfrekeyneeded
              ? [username]
              : (error.rekeyInfo && error.rekeyInfo.rekeyers) || []
          )
          return metaMap.set(
            conversationIDKey,
            Constants.makeConversationMeta({
              conversationIDKey,
              participants,
              rekeyers,
              teamType: old ? old.teamType : 'adhoc',
              teamname: old ? old.teamname : '',
              trustedState: 'error',
              untrustedMessage: error.message,
              untrustedTimestamp: old ? old.untrustedTimestamp : 0,
            })
          )
        }
        case RPCChatTypes.localConversationErrorType.permanent:
          return metaMap
        default:
          return metaMap
      }
    }
    case Chat2Gen.metasReceived:
      return metaMap.withMutations(map => {
        action.payload.metas.forEach(meta => {
          const old = map.get(meta.conversationIDKey)
          // Only update if this is has a newer version or our state is changing
          if (!old || meta.inboxVersion > old.inboxVersion || meta.trustedState !== old.trustedState) {
            map.set(meta.conversationIDKey, meta)
          }
        })
      })
    case Chat2Gen.metaUpdateTrustedState:
      return metaMap.withMutations((map: I.Map<Types.ConversationIDKey, Types.ConversationMeta>) => {
        action.payload.conversationIDKeys.forEach(id => {
          map.setIn([id, 'trustedState'], action.payload.newState)
        })
      })
    default:
      return metaMap
  }
}

const messageMapReducer = (messageMap, action) => {
  switch (action.type) {
    case Chat2Gen.messageEdit: {
      const {conversationIDKey, ordinal, text} = action.payload
      return messageMap.updateIn(
        [conversationIDKey, ordinal],
        message =>
          !message || message.type !== 'text' ? message : message.set('text', text).set('hasBeenEdited', true)
      )
    }
    case Chat2Gen.messagesDelete: {
      const {conversationIDKey, ordinals} = action.payload
      return messageMap.update(
        conversationIDKey,
        I.Map(),
        (map: I.Map<Types.Ordinal, Types.Message>) =>
          map.withMutations(m => {
            ordinals.forEach(ordinal => {
              m.update(ordinal, message => {
                if (!message) {
                  return message
                }
                return Constants.makeMessageDeleted({
                  conversationIDKey: message.conversationIDKey,
                  id: message.id,
                  ordinal: message.ordinal,
                  timestamp: message.timestamp,
                })
              })
            })
          })
        // map.deleteAll(ordinals)
      )
    }
    case Chat2Gen.messagesAdd: {
      const {messages} = action.payload
      return messageMap.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.Map<Types.Ordinal, Types.Message>>) =>
          messages.forEach(message => map.setIn([message.conversationIDKey, message.ordinal], message))
      )
    }
    default:
      return messageMap
  }
}

const messageOrdinalsReducer = (messageOrdinalsList, action) => {
  // Note: on a delete we leave the ordinals in the list
  switch (action.type) {
    case Chat2Gen.messagesAdd: {
      const {messages} = action.payload
      // TODO this just pushes to the end
      return messageOrdinalsList.withMutations(map =>
        messages.forEach(message =>
          map.update(message.conversationIDKey, I.List(), (list: I.List<Types.Ordinal>) =>
            list.push(message.ordinal)
          )
        )
      )
    }
    default:
      return messageOrdinalsList
  }
}

const badgeKey = String(isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop)

const rootReducer = (state: Types.State = initialState, action: Chat2Gen.Actions): Types.State => {
  switch (action.type) {
    case Chat2Gen.resetStore:
      return initialState
    case Chat2Gen.selectConversation:
      return state.set('selectedConversation', action.payload.conversationIDKey)
    case Chat2Gen.setInboxFilter:
      return state.set('inboxFilter', action.payload.filter)
    case Chat2Gen.setSearching:
      return state.set('isSearching', action.payload.searching)
    case Chat2Gen.badgesUpdated: {
      const badgeMap = I.Map(
        action.payload.conversations.map(({convID, badgeCounts}) => [
          Constants.conversationIDToKey(convID),
          badgeCounts[badgeKey] || 0,
        ])
      )
      const unreadMap = I.Map(
        action.payload.conversations.map(({convID, unreadMessages}) => [
          Constants.conversationIDToKey(convID),
          unreadMessages,
        ])
      )
      return state.set('badgeMap', badgeMap).set('unreadMap', unreadMap)
    }
    // MetaMap actions
    case Chat2Gen.metasReceived:
    case Chat2Gen.metaUpdateTrustedState:
    case Chat2Gen.inboxRefresh:
    case Chat2Gen.metaHandleQueue:
    case Chat2Gen.metaNeedsUpdating:
    case Chat2Gen.metaReceivedError:
    case Chat2Gen.metaRequestTrusted:
      return state.set('metaMap', metaMapReducer(state.metaMap, action))
    // MessageMap/messageOrdinalsList actions
    case Chat2Gen.messagesAdd:
    case Chat2Gen.messagesDelete:
    case Chat2Gen.messageEdit:
      return state
        .set('messageMap', messageMapReducer(state.messageMap, action))
        .set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
    // Saga only actions
    case Chat2Gen.setupChatHandlers:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default rootReducer
