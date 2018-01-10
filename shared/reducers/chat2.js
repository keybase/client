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
const pendingOutboxToOrdinalReducer = (pendingOutboxToOrdinal, action) => {
  switch (action.type) {
    case Chat2Gen.messagesAdd:
      const {messages, context} = action.payload
      if (messages.length === 1 && context.type === 'incomingWasPending') {
        console.log('aaa removing pending', context.outboxID)
        return pendingOutboxToOrdinal.deleteIn([messages[0].conversationIDKey, context.outboxID])
      } else if (messages.length === 1 && context.type === 'sent') {
        console.log('aaa adding pending', context.outboxID)
        return pendingOutboxToOrdinal.update(messages[0].conversationIDKey, I.Map(), map =>
          map.set(context.outboxID, messages[0].ordinal)
        )
      } else {
        return pendingOutboxToOrdinal
      }
    default:
      return pendingOutboxToOrdinal
  }
}

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
          // Only update if this is has a newer version or our state is changing
          if (!old || meta.inboxVersion > old.inboxVersion || meta.trustedState !== old.trustedState) {
            // Keep some of our own props eve when loading a new one
            const toSet = old ? meta.set('hasLoadedThread', old.hasLoadedThread) : meta
            map.set(meta.conversationIDKey, toSet)
          }
        })
      })
    case Chat2Gen.messagesAdd: {
      const {context} = action.payload
      return context === 'threadLoad'
        ? metaMap.update(
            context.conversationIDKey,
            (meta: ?Types.ConversationMeta) => (meta ? meta.set('hasLoadedThread', true) : meta)
          )
        : metaMap
    }
    case Chat2Gen.inboxRefresh:
      return action.payload.clearAllData ? metaMap.clear() : metaMap
    default:
      return metaMap
  }
}

const messageMapReducer = (messageMap, action, state) => {
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
    case Chat2Gen.messagesAdd: {
      const {messages, context} = action.payload
      return messageMap.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.Map<Types.Ordinal, Types.Message>>) =>
          messages.forEach(message => {
            // we're changing a pending to sent
            if (context.type === 'incomingWasPending') {
              console.log('aaa message add converting', context.outboxID)
              const pendingOrdinal = state.pendingOutboxToOrdinal.getIn([
                message.conversationIDKey,
                context.outboxID,
              ])
              if (!pendingOrdinal) {
                map.updateIn([message.conversationIDKey, message.ordinal], old => old || message)
                // TODO we get 2 messages for each post so this happens.... talk to mike
                // console.log('aaa message add converting no pending', context.outboxID)
                // throw new Error(
                // `Missing pending ordinal!? ${message.conversationIDKey} ${message.id} ${context.type} ${
                // context.outboxID
                // }`
                // )
              } else {
                map.updateIn([message.conversationIDKey, pendingOrdinal], old =>
                  // $FlowIssue gets confused about set existing
                  message.set('ordinal', pendingOrdinal)
                )
              }
            } else {
              // Never replace old messages
              map.updateIn([message.conversationIDKey, message.ordinal], old => old || message)
            }
          })
      )
    }
    default:
      return messageMap
  }
}

const messageOrdinalsReducer = (messageOrdinalsList, action) => {
  // Note: on a delete we leave the ordinals in the list
  switch (action.type) {
    case Chat2Gen.clearOrdinals:
      return messageOrdinalsList.set(action.payload.conversationIDKey, I.List())
    case Chat2Gen.inboxRefresh:
      return action.payload.clearAllData ? messageOrdinalsList.clear() : messageOrdinalsList
    case Chat2Gen.messagesAdd: {
      const {messages, context} = action.payload
      if (context.type === 'incomingWasPending') {
        // Since we're keeping our old ordinal, we can effectively ignore this update from the ordinals list perspective
        return messageOrdinalsList
      }
      const idToMessages = messages.reduce((map, m) => {
        const set = (map[m.conversationIDKey] = map[m.conversationIDKey] || new Set()) // note: NOT immutable
        set.add(m.ordinal)
        return map
      }, {})

      return messageOrdinalsList.withMutations(map =>
        Object.keys(idToMessages).forEach(conversationIDKey =>
          map.update(conversationIDKey, I.List(), (list: I.List<Types.Ordinal>) =>
            I.Set(list)
              .concat(idToMessages[conversationIDKey])
              .toList()
              .sort()
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
    // metaMap/messageMap/messageOrdinalsList actions
    case Chat2Gen.clearOrdinals:
    case Chat2Gen.inboxRefresh:
    case Chat2Gen.messageDelete:
    case Chat2Gen.messageEdit:
    case Chat2Gen.messageWasEdited:
    case Chat2Gen.messagesAdd:
    case Chat2Gen.messagesWereDeleted:
    case Chat2Gen.metaReceivedError:
    case Chat2Gen.metaRequestingTrusted:
    case Chat2Gen.metasReceived:
      return state
        .set('metaMap', metaMapReducer(state.metaMap, action))
        .set('messageMap', messageMapReducer(state.messageMap, action, state))
        .set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
        .set('pendingOutboxToOrdinal', pendingOutboxToOrdinalReducer(state.pendingOutboxToOrdinal, action))
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
