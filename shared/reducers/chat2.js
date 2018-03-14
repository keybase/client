// @flow
import * as Chat2Gen from '../actions/chat2-gen'
import * as Constants from '../constants/chat2'
import * as I from 'immutable'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/chat2'
import {isMobile} from '../constants/platform'

const initialState: Types.State = Constants.makeState()

// Backend gives us messageIDs sometimes so we need to find our ordinal
const messageIDToOrdinal = (messageMap, pendingOutboxToOrdinal, conversationIDKey, messageID) => {
  // A message we didn't send in this session?
  let m = messageMap.getIn([conversationIDKey, Types.numberToOrdinal(messageID)])
  if (m && m.id && m.id === messageID) {
    return m.ordinal
  }
  // Search through our sent messages
  const pendingOrdinal = pendingOutboxToOrdinal.get(conversationIDKey, I.Map()).find(o => {
    m = messageMap.getIn([conversationIDKey, o])
    if (m && m.id && m.id === messageID) {
      return true
    }
  })

  if (pendingOrdinal) {
    return pendingOrdinal
  }

  return null
}

const metaMapReducer = (metaMap, action) => {
  switch (action.type) {
    case Chat2Gen.metaUpdatePagination:
      return metaMap.update(
        action.payload.conversationIDKey,
        meta =>
          meta
            ? meta
                .set('paginationKey', action.payload.paginationKey)
                .set('paginationMoreToLoad', action.payload.paginationMoreToLoad)
            : meta
      )
    case Chat2Gen.metaDelete:
      return metaMap.delete(action.payload.conversationIDKey)
    case Chat2Gen.notificationSettingsUpdated:
      return metaMap.update(
        action.payload.conversationIDKey,
        meta => (meta ? Constants.updateMetaWithNotificationSettings(meta, action.payload.settings) : meta)
      )
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

            const rekeyers = I.Set(
              error.typ === RPCChatTypes.localConversationErrorType.selfrekeyneeded
                ? [username || '']
                : (error.rekeyInfo && error.rekeyInfo.rekeyers) || []
            )
            let newMeta = Constants.unverifiedInboxUIItemToConversationMeta(error.remoteConv, username || '')
            if (!newMeta) {
              // public conversation, do nothing
              return metaMap
            }
            newMeta = newMeta.merge({
              participants,
              rekeyers,
              snippet: error.message,
              trustedState: 'error',
            })
            return metaMap.set(conversationIDKey, newMeta)
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
      return ['inboxSyncedClear', 'leftAConversation'].includes(action.payload.reason)
        ? metaMap.clear()
        : metaMap
    default:
      return metaMap
  }
}

const messageMapReducer = (messageMap, action, pendingOutboxToOrdinal) => {
  switch (action.type) {
    case Chat2Gen.markConversationsStale:
      return messageMap.deleteAll(action.payload.conversationIDKeys)
    case Chat2Gen.messageEdit: // fallthrough
    case Chat2Gen.messageDelete:
      return messageMap.updateIn(
        [action.payload.conversationIDKey, action.payload.ordinal],
        message =>
          message && message.type === 'text'
            ? message.set('submitState', action.type === Chat2Gen.messageDelete ? 'deleting' : 'editing')
            : message
      )
    case Chat2Gen.inboxRefresh:
      return action.payload.reason === 'inboxSyncedClear' ? messageMap.clear() : messageMap
    case Chat2Gen.messageAttachmentUploaded: {
      const {conversationIDKey, message, placeholderID} = action.payload
      const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, placeholderID)
      if (!ordinal) {
        return messageMap
      }
      return messageMap.updateIn(
        [conversationIDKey, ordinal],
        old => (old ? Constants.upgradeMessage(old, message) : message)
      )
    }
    case Chat2Gen.messageWasEdited: {
      const {conversationIDKey, messageID, text} = action.payload

      const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, messageID)
      if (!ordinal) {
        return messageMap
      }

      return messageMap.updateIn(
        [conversationIDKey, ordinal],
        message =>
          !message || message.type !== 'text'
            ? message
            : message.withMutations(m => {
                m.set('text', text)
                m.set('hasBeenEdited', true)
                m.set('submitState', null)
              })
      )
    }
    case Chat2Gen.attachmentUploading:
      return messageMap.updateIn([action.payload.conversationIDKey, action.payload.ordinal], message => {
        if (!message || message.type !== 'attachment') {
          return message
        }
        return message.set('transferProgress', action.payload.ratio).set('transferState', 'uploading')
      })
    case Chat2Gen.attachmentLoading:
      return messageMap.updateIn([action.payload.conversationIDKey, action.payload.ordinal], message => {
        if (!message || message.type !== 'attachment') {
          return message
        }
        return action.payload.isPreview
          ? message.set('previewTransferState', 'downloading')
          : message.set('transferProgress', action.payload.ratio).set('transferState', 'downloading')
      })
    case Chat2Gen.attachmentUploaded:
      return messageMap.updateIn([action.payload.conversationIDKey, action.payload.ordinal], message => {
        if (!message || message.type !== 'attachment') {
          return message
        }
        return message.set('transferProgress', 0).set('transferState', null)
      })
    case Chat2Gen.attachmentLoaded:
      return messageMap.updateIn([action.payload.conversationIDKey, action.payload.ordinal], message => {
        if (!message || message.type !== 'attachment') {
          return message
        }
        const path = action.error ? '' : action.payload.path
        return action.payload.isPreview
          ? message.set('devicePreviewPath', path).set('previewTransferState', null)
          : message
              .set('transferProgress', 0)
              .set('transferState', null)
              .set('deviceFilePath', path)
      })
    case Chat2Gen.attachmentDownloaded:
      return messageMap.updateIn([action.payload.conversationIDKey, action.payload.ordinal], message => {
        if (!message || message.type !== 'attachment') {
          return message
        }
        const path = action.error ? '' : action.payload.path
        return message.set('downloadPath', path)
      })
    default:
      return messageMap
  }
}

const messageOrdinalsReducer = (messageOrdinals, action) => {
  switch (action.type) {
    case Chat2Gen.inboxRefresh:
      return action.payload.reason === 'inboxSyncedClear' ? messageOrdinals.clear() : messageOrdinals
    case Chat2Gen.markConversationsStale:
      return messageOrdinals.deleteAll(action.payload.conversationIDKeys)
    default:
      return messageOrdinals
  }
}

const badgeKey = String(isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop)

const rootReducer = (state: Types.State = initialState, action: Chat2Gen.Actions): Types.State => {
  switch (action.type) {
    case Chat2Gen.resetStore:
      return initialState
    case Chat2Gen.clearLoading:
      return state.update('loadingMap', loading => loading.delete(action.payload.key))
    case Chat2Gen.setLoading:
      return state.update('loadingMap', loading => {
        const count = loading.get(action.payload.key, 0) + (action.payload.loading ? 1 : -1)
        if (count > 0) {
          return loading.set(action.payload.key, count)
        } else if (count === 0) {
          return loading.delete(action.payload.key)
        } else {
          console.log('Setting negative chat loading key', action.payload.key, count)
          // This should hopefully never happen but some flows are flakey so lets log it but not throw an error
          return loading.set(action.payload.key, count)
        }
      })
    case Chat2Gen.selectConversationDueToPush:
      if (action.payload.phase !== 'showImmediately') {
        return state
      }
    // fallthrough actually select it
    case Chat2Gen.selectConversation:
      return state.withMutations(s => {
        // Update the orange line on the previous conversation
        if (state.selectedConversation) {
          s.updateIn(
            ['metaMap', state.selectedConversation],
            meta =>
              meta
                ? meta.set(
                    'orangeLineOrdinal',
                    state.messageOrdinals.get(state.selectedConversation, I.Set()).last()
                  )
                : meta
          )
        }
        // Update the current conversation. If the ordinal is the last item, just remove it so we don't get an orange bar as we type
        if (action.payload.conversationIDKey) {
          s.updateIn(['metaMap', action.payload.conversationIDKey], meta => {
            if (meta) {
              const lastOrdinal = state.messageOrdinals.get(action.payload.conversationIDKey, I.Set()).last()
              if (lastOrdinal === meta.orangeLineOrdinal) {
                return meta.set('orangeLineOrdinal', null)
              }
            }
            return meta
          })
        }
        s.set('selectedConversation', action.payload.conversationIDKey)
      })
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

      // first group into convoid
      const convoToMessages: {[cid: string]: Array<Types.Message>} = messages.reduce((map, m) => {
        const key = String(m.conversationIDKey)
        map[key] = map[key] || []
        map[key].push(m)
        return map
      }, {})

      // Types we can send and have to deal with outbox ids
      const canSendType = (m: Types.Message): ?Types.MessageText | ?Types.MessageAttachment =>
        m.type === 'text' || m.type === 'attachment' ? m : null

      // Update any pending messages
      const pendingOutboxToOrdinal = state.pendingOutboxToOrdinal.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.Map<Types.OutboxID, Types.Ordinal>>) => {
          if (context.type === 'sent' || context.type === 'threadLoad') {
            messages.forEach(message => {
              const m = canSendType(message)
              if (m && !m.id && m.outboxID) {
                map.setIn([m.conversationIDKey, m.outboxID], m.ordinal)
              }
            })
          }
        }
      )

      const findExisting = (
        conversationIDKey: Types.ConversationIDKey,
        m: Types.MessageText | Types.MessageAttachment
      ) => {
        // something we sent
        if (m.outboxID) {
          // and we know about it
          const ordinal = state.pendingOutboxToOrdinal.getIn([conversationIDKey, m.outboxID])
          if (ordinal) {
            return state.messageMap.getIn([conversationIDKey, ordinal])
          }
        }
        const pendingOrdinal = messageIDToOrdinal(
          state.messageMap,
          state.pendingOutboxToOrdinal,
          conversationIDKey,
          m.id
        )
        if (pendingOrdinal) {
          return state.messageMap.getIn([conversationIDKey, pendingOrdinal])
        }
        return null
      }

      const messageOrdinals = state.messageOrdinals.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.SortedSet<Types.Ordinal>>) => {
          Object.keys(convoToMessages).forEach(cid => {
            const conversationIDKey = Types.stringToConversationIDKey(cid)
            const messages = convoToMessages[cid]
            const ordinals = messages.reduce((arr, message) => {
              const m = canSendType(message)
              if (m) {
                // Sendable so we might have an existing message
                if (!findExisting(conversationIDKey, m)) {
                  arr.push(m.ordinal)
                }
              } else {
                arr.push(message.ordinal)
              }
              return arr
            }, [])

            map.update(conversationIDKey, I.SortedSet(), (set: I.SortedSet<Types.Ordinal>) =>
              set.concat(ordinals)
            )
          })
        }
      )

      const messageMap = state.messageMap.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.Map<Types.Ordinal, Types.Message>>) => {
          Object.keys(convoToMessages).forEach(cid => {
            const conversationIDKey = Types.stringToConversationIDKey(cid)
            const messages = convoToMessages[cid]
            messages.forEach(message => {
              const m = canSendType(message)
              const old = m ? findExisting(conversationIDKey, m) : null
              const toSet = old ? Constants.upgradeMessage(old, message) : message
              map.setIn([conversationIDKey, toSet.ordinal], toSet)
            })
          })
        }
      )

      return state.withMutations(s => {
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
              return message.set('errorReason', null).set('submitState', 'pending')
            }
            if (message.type === 'attachment') {
              return message.set('errorReason', null).set('submitState', 'pending')
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
              return message.set('errorReason', reason).set('submitState', null)
            }
            if (message.type === 'attachment') {
              return message.set('errorReason', reason).set('submitState', null)
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
    case Chat2Gen.updateTypers: {
      return state.set('typingMap', action.payload.conversationToTypers)
    }
    case Chat2Gen.messagesWereDeleted: {
      const {conversationIDKey, messageIDs = [], ordinals = []} = action.payload
      const allOrdinals = I.Set(
        [
          ...ordinals,
          ...messageIDs.map(messageID =>
            messageIDToOrdinal(state.messageMap, state.pendingOutboxToOrdinal, conversationIDKey, messageID)
          ),
        ].filter(Boolean)
      )

      return state.withMutations(s => {
        s.update('messageMap', messageMap =>
          messageMap.update(conversationIDKey, I.Map(), (map: I.Map<Types.Ordinal, Types.Message>) =>
            map.withMutations(m => {
              allOrdinals.forEach(ordinal => {
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
        )

        s.update('messageOrdinals', messageOrdinals =>
          messageOrdinals.update(conversationIDKey, ordinals => ordinals.subtract(allOrdinals))
        )
      })
    }
    // metaMap/messageMap/messageOrdinalsList only actions
    case Chat2Gen.inboxRefresh:
    case Chat2Gen.messageDelete:
    case Chat2Gen.messageEdit:
    case Chat2Gen.messageWasEdited:
    case Chat2Gen.messageAttachmentUploaded:
    case Chat2Gen.metaReceivedError:
    case Chat2Gen.metaRequestingTrusted:
    case Chat2Gen.metasReceived:
    case Chat2Gen.attachmentLoading:
    case Chat2Gen.attachmentUploading:
    case Chat2Gen.attachmentUploaded:
    case Chat2Gen.attachmentLoaded:
    case Chat2Gen.attachmentDownloaded:
    case Chat2Gen.markConversationsStale:
    case Chat2Gen.notificationSettingsUpdated:
    case Chat2Gen.metaDelete:
    case Chat2Gen.metaUpdatePagination:
      return state.withMutations(s => {
        s.set('metaMap', metaMapReducer(state.metaMap, action))
        s.set('messageMap', messageMapReducer(state.messageMap, action, state.pendingOutboxToOrdinal))
        s.set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
      })
    // Saga only actions
    case Chat2Gen.attachmentDownload:
    case Chat2Gen.attachmentHandleQueue:
    case Chat2Gen.attachmentLoad:
    case Chat2Gen.attachmentNeedsUpdating:
    case Chat2Gen.attachmentUpload:
    case Chat2Gen.desktopNotification:
    case Chat2Gen.exitSearch:
    case Chat2Gen.joinConversation:
    case Chat2Gen.leaveConversation:
    case Chat2Gen.loadOlderMessagesDueToScroll:
    case Chat2Gen.markInitiallyLoadedThreadAsRead:
    case Chat2Gen.messageDeleteHistory:
    case Chat2Gen.messageSend:
    case Chat2Gen.metaHandleQueue:
    case Chat2Gen.metaNeedsUpdating:
    case Chat2Gen.metaRequestTrusted:
    case Chat2Gen.muteConversation:
    case Chat2Gen.openFolder:
    case Chat2Gen.resetChatWithoutThem:
    case Chat2Gen.resetLetThemIn:
    case Chat2Gen.sendToPendingConversation:
    case Chat2Gen.sendTyping:
    case Chat2Gen.setupChatHandlers:
    case Chat2Gen.startConversation:
    case Chat2Gen.navigateToInbox:
    case Chat2Gen.navigateToThread:
    case Chat2Gen.messageAttachmentNativeShare:
    case Chat2Gen.messageAttachmentNativeSave:
    case Chat2Gen.updateNotificationSettings:
    case Chat2Gen.blockConversation:
      return state
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // if you get a flow error here it means there's an action you claim to handle but didn't
      return state
  }
}

export default rootReducer
