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
    case Chat2Gen.metaRequestingTrusted:
      return metaMap.withMutations(map =>
        (action.payload.force
          ? action.payload.conversationIDKeys
          : Constants.getConversationIDKeyMetasToLoad(action.payload.conversationIDKeys, metaMap)
        ).forEach(conversationIDKey =>
          map.update(conversationIDKey, meta => (meta ? meta.set('trustedState', 'requesting') : meta))
        )
      )
    case Chat2Gen.metaReceivedError: {
      const {error} = action.payload
      if (error) {
        switch (error.typ) {
          case RPCChatTypes.localConversationErrorType.otherrekeyneeded: // fallthrough
          case RPCChatTypes.localConversationErrorType.selfrekeyneeded: {
            const {username, conversationIDKey} = action.payload
            const participants = error.rekeyInfo
              ? I.Set([].concat(error.rekeyInfo.writerNames, error.rekeyInfo.readerNames).filter(Boolean))
              : I.Set(error.unverifiedTLFName.split(','))
            const old = metaMap.get(conversationIDKey)
            const rekeyers = I.Set(
              error.typ === RPCChatTypes.localConversationErrorType.selfrekeyneeded
                ? [username || '']
                : (error.rekeyInfo && error.rekeyInfo.rekeyers) || []
            )
            return metaMap.set(
              conversationIDKey,
              Constants.makeConversationMeta({
                conversationIDKey,
                participants,
                rekeyers,
                snippet: error.message,
                teamType: old ? old.teamType : 'adhoc',
                teamname: old ? old.teamname : '',
                timestamp: old ? old.timestamp : 0,
                trustedState: 'error',
              })
            )
          }
          default:
            return metaMap.update(
              action.payload.conversationIDKey,
              meta => (meta ? meta.set('trustedState', 'error').set('snippet', error.message) : meta)
            )
        }
      } else {
        return metaMap.delete(action.payload.conversationIDKey)
      }
    }
    case Chat2Gen.metasReceived:
      return metaMap.withMutations(map => {
        action.payload.metas.forEach(meta => {
          const old = map.get(meta.conversationIDKey)
          map.set(meta.conversationIDKey, old ? Constants.updateMeta(old, meta) : meta)
        })
      })
    case Chat2Gen.inboxRefresh:
      return action.payload.clearAllData ? metaMap.clear() : metaMap
    default:
      return metaMap
  }
}

const messageMapReducer = (messageMap, action) => {
  switch (action.type) {
    case Chat2Gen.messageEdit: // fallthrough
    case Chat2Gen.messageDelete:
      return messageMap.updateIn(
        [action.payload.conversationIDKey, action.payload.ordinal],
        message =>
          message && message.type === 'text'
            ? message.set('localState', action.type === Chat2Gen.messageDelete ? 'deleting' : 'editing')
            : message
      )
    case Chat2Gen.inboxRefresh:
      return action.payload.clearAllData ? messageMap.clear() : messageMap
    case Chat2Gen.messageWasEdited: {
      const {conversationIDKey, ordinal, text} = action.payload
      return messageMap.updateIn(
        [conversationIDKey, ordinal],
        message =>
          !message || message.type !== 'text' ? message : message.set('text', text).set('hasBeenEdited', true)
      )
    }
    case Chat2Gen.messagesWereDeleted: {
      const {conversationIDKey, ordinals} = action.payload
      return messageMap.update(conversationIDKey, I.Map(), (map: I.Map<Types.Ordinal, Types.Message>) =>
        map.withMutations(m => {
          ordinals.forEach(ordinal => {
            m.update(ordinal, message => {
              if (!message) {
                return message
              }
              return Constants.makeMessageDeleted({
                author: message.author,
                conversationIDKey: message.conversationIDKey,
                id: message.id,
                ordinal: message.ordinal,
                timestamp: message.timestamp,
              })
            })
          })
        })
      )
    }

    default:
      return messageMap
  }
}

const messageOrdinalsReducer = (messageOrdinals, action) => {
  // Note: on a delete we leave the ordinals in the list
  switch (action.type) {
    case Chat2Gen.clearOrdinals:
      return messageOrdinals.set(action.payload.conversationIDKey, I.SortedSet())
    case Chat2Gen.inboxRefresh:
      return action.payload.clearAllData ? messageOrdinals.clear() : messageOrdinals
    default:
      return messageOrdinals
  }
}

const badgeKey = String(isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop)

const rootReducer = (state: Types.State = initialState, action: Chat2Gen.Actions): Types.State => {
  switch (action.type) {
    case Chat2Gen.resetStore:
      return initialState
    case Chat2Gen.setLoading:
      return state.update('loadingMap', loading => {
        const count = loading.get(action.payload.key, 0) + (action.payload.loading ? 1 : -1)
        if (count > 0) {
          return loading.set(action.payload.key, count)
        } else if (count === 0) {
          return loading.delete(action.payload.key)
        } else {
          console.log('Setting negative chat loading key', action.payload.key, count)
          return loading.set(action.payload.key, count)
          // TODO talk to mike. sync calls don't seem to always start with syncStarting so we go negative
          // never allow negative
          // throw new Error(`Negative loading in chat ${action.payload.key}`)
        }
      })
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
    case Chat2Gen.messageSetEditing:
      return state.update(
        'editingMap',
        editingMap =>
          action.payload.ordinal
            ? editingMap.set(action.payload.conversationIDKey, action.payload.ordinal)
            : editingMap.delete(action.payload.conversationIDKey)
      )
    case Chat2Gen.messagesAdd: {
      const {messages, context} = action.payload

      let updatedMessages = messages

      // Update our pending mapping
      let pendingOutboxToOrdinal = state.pendingOutboxToOrdinal

      // We're sending a message, add it to the map
      if (context.type === 'sent') {
        pendingOutboxToOrdinal = pendingOutboxToOrdinal.withMutations(
          (map: I.Map<Types.ConversationIDKey, I.Map<Types.OutboxID, Types.Ordinal>>) =>
            updatedMessages.forEach(
              message =>
                message.outboxID && map.setIn([message.conversationIDKey, message.outboxID], message.ordinal)
            )
        )
      } else {
        // We got messages, see if we should remove it from the map and update the message
        pendingOutboxToOrdinal = pendingOutboxToOrdinal.withMutations(
          (map: I.Map<Types.ConversationIDKey, I.Map<Types.OutboxID, Types.Ordinal>>) =>
            (updatedMessages = updatedMessages.map(message => {
              const existingOrdinal = message.outboxID
                ? map.getIn([message.conversationIDKey, message.outboxID])
                : null
              // Was pending?
              if (existingOrdinal && message.outboxID) {
                // We get 2 incoming calls when a pending goes to real. If we clean up the map then we lose the bookkeeping so lets just keep it
                // map.deleteIn([message.conversationIDKey, message.outboxID])
                // We keep the original ordinal we created always so that mapping is fixed
                // This is required to help flow not confuse itself...
                switch (message.type) {
                  case 'text':
                    return message.set('ordinal', existingOrdinal)
                  case 'attachment':
                    return message.set('ordinal', existingOrdinal)
                  case 'deleted':
                    return message.set('ordinal', existingOrdinal)
                  default:
                    return message
                }
              } else {
                return message
              }
            }))
        )
      }

      // Update our ordinals list
      // First build a map of conversationIDKey to Set of ordinals (eliminates dupes)
      const idToMessages = updatedMessages.reduce((map, m) => {
        const conversationIDKey = Types.conversationIDKeyToString(m.conversationIDKey)
        const set = (map[conversationIDKey] = map[conversationIDKey] || new Set()) // note: NOT immutable
        set.add(m.ordinal)
        return map
      }, {})

      // Create a map of conversationIDKey to Sorted list of ordinals
      const messageOrdinals = state.messageOrdinals.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.SortedSet<Types.Ordinal>>) =>
          Object.keys(idToMessages).forEach(conversationIDKey =>
            map.update(
              Types.stringToConversationIDKey(conversationIDKey),
              I.SortedSet(),
              (set: I.SortedSet<Types.Ordinal>) => set.concat(idToMessages[conversationIDKey])
            )
          )
      )

      const messageMap = state.messageMap.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.Map<Types.Ordinal, Types.Message>>) =>
          updatedMessages.forEach(message => {
            // Keep old messages unless we got a valid id
            map.updateIn([message.conversationIDKey, message.ordinal], old => {
              if (old) {
                // Our old one was pending
                if (!old.id && message.id) {
                  return message
                }
                // Keep old messages otherwise
                return old
              }
              // A new message
              return message
            })
          })
      )

      const metaMap =
        context.type === 'threadLoad' && state.metaMap.get(context.conversationIDKey)
          ? state.metaMap.update(context.conversationIDKey, (meta: Types.ConversationMeta) =>
              meta.set('hasLoadedThread', true)
            )
          : state.metaMap

      return state.withMutations(s => {
        s.set('metaMap', metaMap)
        s.set('messageMap', messageMap)
        s.set('messageOrdinals', messageOrdinals)
        s.set('pendingOutboxToOrdinal', pendingOutboxToOrdinal)
      })
    }

    // metaMap/messageMap/messageOrdinalsList only actions
    case Chat2Gen.clearOrdinals:
    case Chat2Gen.inboxRefresh:
    case Chat2Gen.messageDelete:
    case Chat2Gen.messageEdit:
    case Chat2Gen.messageWasEdited:
    case Chat2Gen.messagesWereDeleted:
    case Chat2Gen.metaReceivedError:
    case Chat2Gen.metaRequestingTrusted:
    case Chat2Gen.metasReceived:
      return state.withMutations(s => {
        s.set('metaMap', metaMapReducer(state.metaMap, action))
        s.set('messageMap', messageMapReducer(state.messageMap, action))
        s.set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
      })
    // Saga only actions
    case Chat2Gen.desktopNotification:
    case Chat2Gen.loadMoreMessages:
    case Chat2Gen.messageSend:
    case Chat2Gen.metaHandleQueue:
    case Chat2Gen.metaNeedsUpdating:
    case Chat2Gen.metaRequestTrusted:
    case Chat2Gen.setupChatHandlers:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default rootReducer
