// @flow
import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as I from 'immutable'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/chat2'
import {isMobile} from '../constants/platform'

const initialState: Types.State = Constants.makeState()

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
              ? I.OrderedSet(
                  [].concat(error.rekeyInfo.writerNames, error.rekeyInfo.readerNames).filter(Boolean)
                )
              : I.OrderedSet(error.unverifiedTLFName.split(','))
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
              meta =>
                meta
                  ? meta.withMutations(m => {
                      m.set('trustedState', 'error')
                      m.set('snippet', error.message)
                    })
                  : meta
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

const messageMapReducer = (messageMap, action, pendingOutboxToOrdinal) => {
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

      const message = messageMap.getIn([conversationIDKey, ordinal])
      if (!message) {
        return messageMap
      }
      const existingOrdinal =
        (message.type === 'text' || message.type === 'attachment') && message.outboxID
          ? pendingOutboxToOrdinal.getIn([message.conversationIDKey, message.outboxID])
          : null

      // Updated all messages (real ordinal and fake one)
      const ordinals = [ordinal, ...(existingOrdinal ? [existingOrdinal] : [])]

      let editedMap = messageMap
      ordinals.forEach(o => {
        editedMap = o
          ? editedMap.updateIn(
              [conversationIDKey, o],
              message =>
                !message || message.type !== 'text'
                  ? message
                  : message.withMutations(m => {
                      m.set('text', text)
                      m.set('hasBeenEdited', true)
                      m.set('localState', null)
                    })
            )
          : editedMap
      })
      return editedMap
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
    case Chat2Gen.setPendingSelected:
      return state.set('pendingSelected', action.payload.selected)
    case Chat2Gen.setPendingMode:
      return state.set('pendingMode', action.payload.pendingMode)
    case Chat2Gen.setPendingConversationUsers:
      return state.set('pendingConversationUsers', I.Set(action.payload.users))
    case Chat2Gen.badgesUpdated: {
      const badgeMap = I.Map(
        action.payload.conversations.map(({convID, badgeCounts}) => [
          Types.conversationIDToKey(convID),
          badgeCounts[badgeKey] || 0,
        ])
      )
      const unreadMap = I.Map(
        action.payload.conversations.map(({convID, unreadMessages}) => [
          Types.conversationIDToKey(convID),
          unreadMessages,
        ])
      )
      return state.withMutations(s => {
        s.set('badgeMap', badgeMap)
        s.set('unreadMap', unreadMap)
      })
    }
    case Chat2Gen.messageSetEditing:
      return state.update('editingMap', editingMap => {
        const {conversationIDKey, editLastUser, ordinal} = action.payload

        // clearing
        if (!editLastUser && !ordinal) {
          return editingMap.delete(conversationIDKey)
        }

        const messageMap = state.messageMap.get(conversationIDKey, I.Map())

        // editing a specific message
        if (ordinal) {
          const message = messageMap.get(ordinal)
          if (message && message.type === 'text') {
            return editingMap.set(conversationIDKey, ordinal)
          } else {
            return editingMap
          }
        }

        // Editing your last message
        const ordinals = state.messageOrdinals.get(conversationIDKey, I.SortedSet())
        const found = ordinals.findLast(o => {
          const message = messageMap.get(o)
          return message && message.type === 'text' && message.author === editLastUser
        })
        if (found) {
          return editingMap.set(conversationIDKey, found)
        }
        return editingMap
      })
    case Chat2Gen.messagesAdd: {
      const {messages, context} = action.payload

      // Update our pending mapping
      let pendingOutboxToOrdinal = state.pendingOutboxToOrdinal

      // Update our ordinals list
      // First build a map of conversationIDKey to Set of ordinals (eliminates dupes)
      const idToMessages = messages.reduce((map, m) => {
        // If we have an ordinal for this already ignore it
        if (m.type === 'text' || m.type === 'attachment') {
          const existingOrdinal = m.outboxID
            ? pendingOutboxToOrdinal.getIn([m.conversationIDKey, m.outboxID])
            : null
          if (existingOrdinal) {
            return map
          }
        }
        const conversationIDKey = Types.conversationIDKeyToString(m.conversationIDKey)
        const set = (map[conversationIDKey] = map[conversationIDKey] || new Set()) // note: NOT immutable
        set.add(m.ordinal)
        return map
      }, {})

      // We're sending a message or loading a thread, add it to the map if its pending
      if (context.type === 'sent' || context.type === 'threadLoad') {
        pendingOutboxToOrdinal = pendingOutboxToOrdinal.withMutations(
          (map: I.Map<Types.ConversationIDKey, I.Map<Types.OutboxID, Types.Ordinal>>) =>
            messages.forEach(message => {
              if (message.type === 'attachment' || message.type === 'text') {
                if (!message.id) {
                  message.outboxID &&
                    map.setIn([message.conversationIDKey, message.outboxID], message.ordinal)
                }
              }
            })
        )
      }

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
          messages.forEach(message => {
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

            // If the message was pending and we have an ordinal already, lets keep the map to it
            if (message.type === 'text' || message.type === 'attachment') {
              const existingOrdinal = message.outboxID
                ? pendingOutboxToOrdinal.getIn([message.conversationIDKey, message.outboxID])
                : null
              if (existingOrdinal) {
                const m = map.getIn([message.conversationIDKey, message.ordinal])
                if (m) {
                  map.setIn([message.conversationIDKey, existingOrdinal], m)
                }
              }
            }
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
    case Chat2Gen.clearOrdinals: {
      return state.withMutations(s => {
        s.deleteIn(['messageOrdinals', action.payload.conversationIDKey])
        s.deleteIn(['pendingOutboxToOrdinal', action.payload.conversationIDKey])
        s.deleteIn(['messageMap', action.payload.conversationIDKey])
      })
    }
    case Chat2Gen.messageRetry: {
      const {conversationIDKey, outboxID} = action.payload
      const ordinal = state.pendingOutboxToOrdinal.getIn([conversationIDKey, outboxID])
      if (!ordinal) {
        return state
      }
      return state.set(
        'messageMap',
        state.messageMap.updateIn([conversationIDKey, ordinal], message => {
          if (message) {
            if (message.type === 'text') {
              return message.set('errorReason', null).set('localState', 'pending')
            }
            if (message.type === 'attachment') {
              return message.set('errorReason', null).set('localState', 'pending')
            }
          }
          return message
        })
      )
    }
    case Chat2Gen.messageErrored: {
      const {conversationIDKey, outboxID, reason} = action.payload
      const ordinal = state.pendingOutboxToOrdinal.getIn([conversationIDKey, outboxID])
      if (!ordinal) {
        return state
      }
      return state.set(
        'messageMap',
        state.messageMap.updateIn([conversationIDKey, ordinal], message => {
          if (message) {
            if (message.type === 'text') {
              return message.set('errorReason', reason).set('localState', null)
            }
            if (message.type === 'attachment') {
              return message.set('errorReason', reason).set('localState', null)
            }
          }
          return message
        })
      )
    }
    case Chat2Gen.clearPendingConversation: {
      return state.withMutations(s => {
        const conversationIDKey = Types.stringToConversationIDKey('')
        s.deleteIn(['messageOrdinals', conversationIDKey])
        s.deleteIn(['pendingOutboxToOrdinal', conversationIDKey])
        s.deleteIn(['messageMap', conversationIDKey])
      })
    }

    // metaMap/messageMap/messageOrdinalsList only actions
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
        s.set('messageMap', messageMapReducer(state.messageMap, action, state.pendingOutboxToOrdinal))
        s.set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
      })
    // Saga only actions
    case Chat2Gen.attachmentSend:
    case Chat2Gen.attachmentWithPreviewSend:
    case Chat2Gen.desktopNotification:
    case Chat2Gen.joinConversation:
    case Chat2Gen.leaveConversation:
    case Chat2Gen.loadMoreMessages:
    case Chat2Gen.messageSend:
    case Chat2Gen.metaHandleQueue:
    case Chat2Gen.metaNeedsUpdating:
    case Chat2Gen.metaRequestTrusted:
    case Chat2Gen.muteConversation:
    case Chat2Gen.openFolder:
    case Chat2Gen.resetChatWithoutThem:
    case Chat2Gen.resetLetThemIn:
    case Chat2Gen.setupChatHandlers:
    case Chat2Gen.startConversation:
    case Chat2Gen.exitSearch:
    case Chat2Gen.sendToPendingConversation:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default rootReducer
