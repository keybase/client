// @flow
import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as I from 'immutable'
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
    case Chat2Gen.metasReceived:
      return metaMap.withMutations(map => {
        action.payload.metas.forEach(meta => {
          const old = map.get(meta.conversationIDKey)
          // Only update if this is newer
          if (!old || meta.inboxVersion > old.inboxVersion) {
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
  switch (action.type) {
    case Chat2Gen.messagesAdd: {
      const {messages} = action.payload
      // TODO this just pushes to the end
      return messageOrdinalsList.withMutations(map =>
        messages.forEach(message =>
          map.update(message.conversationIDKey, (list: ?I.List<Types.Ordinal>) => {
            // const ordinals: Array<Types.Ordinal> = messages.map(message => message.ordinal)
            return list ? list.push(message.ordinal) : I.List([message.ordinal])
          })
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
    case Chat2Gen.setInboxFilter:
      return state.set('inboxFilter', action.payload.filter)
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
