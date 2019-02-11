// @flow
import * as Chat2Gen from '../actions/chat2-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/chat2'
import * as I from 'immutable'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/chat2'
import teamBuildingReducer from './team-building'
import {isMobile} from '../constants/platform'
import logger from '../logger'
import HiddenString from '../util/hidden-string'
import {partition} from 'lodash-es'
import {actionHasError} from '../util/container'
import * as Flow from '../util/flow'

type EngineActions = EngineGen.Chat1NotifyChatChatTypingUpdatePayload

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
    case Chat2Gen.setConversationOffline:
      return metaMap.update(action.payload.conversationIDKey, meta =>
        meta ? meta.set('offline', action.payload.offline) : meta
      )
    case Chat2Gen.metaDelete:
      return metaMap.delete(action.payload.conversationIDKey)
    case Chat2Gen.notificationSettingsUpdated:
      return metaMap.update(action.payload.conversationIDKey, meta =>
        meta ? Constants.updateMetaWithNotificationSettings(meta, action.payload.settings) : meta
      )
    case Chat2Gen.metaRequestingTrusted:
      return metaMap.withMutations(map =>
        Constants.getConversationIDKeyMetasToLoad(action.payload.conversationIDKeys, metaMap).forEach(
          conversationIDKey =>
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
              ? I.Set(
                  [].concat(error.rekeyInfo.writerNames, error.rekeyInfo.readerNames).filter(Boolean)
                ).toList()
              : I.OrderedSet(error.unverifiedTLFName.split(',')).toList()

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
              snippetDecoration: '',
              trustedState: 'error',
            })
            return metaMap.set(conversationIDKey, newMeta)
          }
          default:
            return metaMap.update(action.payload.conversationIDKey, old =>
              old
                ? old.withMutations(m => {
                    m.set('trustedState', 'error')
                    m.set('snippet', error.message)
                    m.set('snippetDecoration', '')
                  })
                : old
            )
        }
      } else {
        return metaMap.delete(action.payload.conversationIDKey)
      }
    }
    case Chat2Gen.metasReceived:
      return metaMap.withMutations(map => {
        if (action.payload.clearExistingMetas) {
          // keep pending conversation
          const pending = map.get(Constants.pendingConversationIDKey)
          map.clear().set(Constants.pendingConversationIDKey, pending)
        }
        const neverCreate = !!action.payload.neverCreate
        action.payload.metas.forEach(meta => {
          map.update(meta.conversationIDKey, old => {
            if (old) {
              return action.payload.fromExpunge ? meta : Constants.updateMeta(old, meta)
            } else {
              return neverCreate ? old : meta
            }
          })
        })
      })
    case Chat2Gen.updateConvRetentionPolicy:
      const {conv} = action.payload
      const newMeta = Constants.inboxUIItemToConversationMeta(conv, true)
      if (!newMeta) {
        logger.warn('Invalid inboxUIItem received in conv retention policy update')
        return metaMap
      }
      if (metaMap.has(newMeta.conversationIDKey)) {
        // only insert if the convo is already in the inbox
        return metaMap.set(newMeta.conversationIDKey, newMeta)
      }
      return metaMap
    case Chat2Gen.updateTeamRetentionPolicy:
      const {convs} = action.payload
      const newMetas = convs.reduce((updated, conv) => {
        const newMeta = Constants.inboxUIItemToConversationMeta(conv, true)
        if (newMeta && metaMap.has(newMeta.conversationIDKey)) {
          // only insert if the convo is already in the inbox
          updated[Types.conversationIDKeyToString(newMeta.conversationIDKey)] = newMeta
        }
        return updated
      }, {})
      return metaMap.merge(newMetas)
    case Chat2Gen.saveMinWriterRole:
      const {conversationIDKey, role} = action.payload
      return metaMap.update(conversationIDKey, old => {
        if (old) {
          return old.set('minWriterRole', role)
        }
        // if we haven't loaded it yet we'll load it on navigation into the
        // convo
        return old
      })
    default:
      return metaMap
  }
}

const messageMapReducer = (messageMap, action, pendingOutboxToOrdinal) => {
  switch (action.type) {
    case Chat2Gen.markConversationsStale:
      return action.payload.updateType === RPCChatTypes.notifyChatStaleUpdateType.clear
        ? messageMap.deleteAll(action.payload.conversationIDKeys)
        : messageMap
    case Chat2Gen.messageEdit: // fallthrough
    case Chat2Gen.messageDelete:
      return messageMap.updateIn([action.payload.conversationIDKey, action.payload.ordinal], message =>
        message && message.type === 'text'
          ? message.set('submitState', action.type === Chat2Gen.messageDelete ? 'deleting' : 'editing')
          : message
      )
    case Chat2Gen.messageAttachmentUploaded: {
      const {conversationIDKey, message, placeholderID} = action.payload
      const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, placeholderID)
      if (!ordinal) {
        return messageMap
      }
      return messageMap.updateIn([conversationIDKey, ordinal], old =>
        old ? Constants.upgradeMessage(old, message) : message
      )
    }
    case Chat2Gen.messageWasEdited: {
      const {
        conversationIDKey,
        messageID,
        text,
        mentionsAt,
        mentionsChannel,
        mentionsChannelName,
      } = action.payload

      const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, messageID)
      if (!ordinal) {
        return messageMap
      }

      return messageMap.updateIn([conversationIDKey, ordinal], message =>
        !message || message.type !== 'text'
          ? message
          : message.withMutations(m => {
              m.set('text', text)
              m.set('hasBeenEdited', true)
              m.set('submitState', null)
              m.set('mentionsAt', mentionsAt)
              m.set('mentionsChannel', mentionsChannel)
              m.set('mentionsChannelName', mentionsChannelName)
            })
      )
    }
    case Chat2Gen.pendingMessageWasEdited: {
      const {conversationIDKey, ordinal, text} = action.payload
      return messageMap.updateIn([conversationIDKey, ordinal], message =>
        !message || message.type !== 'text' ? message : message.set('text', text)
      )
    }
    case Chat2Gen.attachmentUploading:
      const convMap = pendingOutboxToOrdinal.get(action.payload.conversationIDKey, I.Map())
      const ordinal = convMap.get(action.payload.outboxID)
      if (!ordinal) {
        return messageMap
      }
      return messageMap.updateIn([action.payload.conversationIDKey, ordinal], message => {
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
    case Chat2Gen.attachmentMobileSave:
      return messageMap.updateIn([action.payload.conversationIDKey, action.payload.ordinal], message => {
        if (!message || message.type !== 'attachment') {
          return message
        }
        return message.set('transferState', 'mobileSaving')
      })
    case Chat2Gen.attachmentMobileSaved:
      return messageMap.updateIn([action.payload.conversationIDKey, action.payload.ordinal], message => {
        if (!message || message.type !== 'attachment') {
          return message
        }
        return message.set('transferState', null)
      })
    case Chat2Gen.attachmentDownload:
      return messageMap.updateIn(
        [action.payload.message.conversationIDKey, action.payload.message.ordinal],
        message => {
          if (!message || message.type !== 'attachment') {
            return message
          }
          return message.set('transferState', 'downloading')
        }
      )
    case Chat2Gen.attachmentDownloaded:
      return messageMap.updateIn(
        [action.payload.message.conversationIDKey, action.payload.message.ordinal],
        message => {
          if (!message || message.type !== 'attachment') {
            return message
          }
          const path = actionHasError(action) ? '' : action.payload.path
          return message
            .set('downloadPath', path)
            .set('transferProgress', 0)
            .set('transferState', null)
            .set('fileURLCached', true) // assume we have this on the service now
        }
      )
    case Chat2Gen.metasReceived:
      const existingPending = messageMap.get(Constants.pendingConversationIDKey)
      if (action.payload.clearExistingMessages) {
        return existingPending
          ? messageMap.clear().set(Constants.pendingConversationIDKey, existingPending)
          : messageMap.clear()
      }
      return messageMap
    case Chat2Gen.updateMessages:
      const updateOrdinals = action.payload.messages.reduce((l, msg) => {
        const ordinal = messageIDToOrdinal(
          messageMap,
          pendingOutboxToOrdinal,
          action.payload.conversationIDKey,
          msg.messageID
        )
        if (!ordinal) {
          return l
        }
        // $FlowIssue it's not really possible to do anything to a message in general
        return l.concat({msg: msg.message.set('ordinal', ordinal), ordinal})
      }, [])
      return messageMap.updateIn([action.payload.conversationIDKey], messages => {
        if (!messages) {
          return messages
        }
        return messages.withMutations(msgs => {
          updateOrdinals.forEach(r => {
            msgs.set(r.ordinal, r.msg)
          })
        })
      })
    case Chat2Gen.messagesExploded:
      const {conversationIDKey, messageIDs} = action.payload
      logger.info(`messagesExploded: exploding ${messageIDs.length} messages`)
      const ordinals = messageIDs
        .map(mid => messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, mid))
        .filter(Boolean)
      if (ordinals.length === 0) {
        // found nothing
        return messageMap
      }
      return messageMap.updateIn([action.payload.conversationIDKey], messages => {
        return messages.withMutations(msgs => {
          ordinals.forEach(ordinal =>
            msgs.updateIn([ordinal], msg =>
              // $FlowIssue thinks `message` is the inner type
              msg
                .set('exploded', true)
                .set('explodedBy', action.payload.explodedBy || '')
                .set('text', new HiddenString(''))
                .set('mentionsAt', I.Set())
                .set('reactions', I.Map())
                .set('unfurls', I.Map())
            )
          )
        })
      })
    default:
      return messageMap
  }
}

const messageOrdinalsReducer = (messageOrdinals, action) => {
  switch (action.type) {
    case Chat2Gen.markConversationsStale:
      return action.payload.updateType === RPCChatTypes.notifyChatStaleUpdateType.clear
        ? messageOrdinals.deleteAll(action.payload.conversationIDKeys)
        : messageOrdinals
    case Chat2Gen.metasReceived:
      const existingPending = messageOrdinals.get(Constants.pendingConversationIDKey)
      if (action.payload.clearExistingMessages) {
        return existingPending
          ? messageOrdinals.clear().set(Constants.pendingConversationIDKey, existingPending)
          : messageOrdinals.clear()
      }
      return messageOrdinals
    default:
      return messageOrdinals
  }
}

const badgeKey = String(isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop)

const rootReducer = (
  state: Types.State = initialState,
  action: Chat2Gen.Actions | TeamBuildingGen.Actions | EngineActions
): Types.State => {
  switch (action.type) {
    case Chat2Gen.resetStore:
      return initialState
    case Chat2Gen.toggleSmallTeamsExpanded:
      return state.set('smallTeamsExpanded', !state.smallTeamsExpanded)
    case Chat2Gen.changeFocus:
      return state.set('focus', action.payload.nextFocus)
    case Chat2Gen.selectConversation:
      // ignore non-changing
      if (state.selectedConversation === action.payload.conversationIDKey) {
        return state
      }
      return state.withMutations(s => {
        const conversationIDKey = action.payload.conversationIDKey
        if (conversationIDKey) {
          const {readMsgID, maxVisibleMsgID} = state.metaMap.get(
            conversationIDKey,
            Constants.makeConversationMeta()
          )
          logger.info(
            `rootReducer: selectConversation: setting orange line: convID: ${conversationIDKey} maxVisible: ${maxVisibleMsgID} read: ${readMsgID}`
          )
          if (maxVisibleMsgID > readMsgID) {
            // Store the message ID that will display the orange line above it,
            // which is the first message after the last read message. We can't
            // just increment `readMsgID` since that msgID might be a
            // non-visible (edit, delete, reaction...) message so we scan the
            // ordinals for the appropriate value.
            const messageMap = state.messageMap.get(conversationIDKey, I.Map())
            const ordinals = state.messageOrdinals.get(conversationIDKey, I.OrderedSet())
            const ord = ordinals.find(o => {
              const message = messageMap.get(o)
              return message && message.id >= readMsgID + 1
            })
            const message = messageMap.get(ord)
            if (message && message.id) {
              s.setIn(['orangeLineMap', conversationIDKey], message.id)
            } else {
              s.deleteIn(['orangeLineMap', conversationIDKey])
            }
          } else {
            // If there aren't any new messages, we don't want to display an
            // orange line so remove its entry from orangeLineMap
            s.deleteIn(['orangeLineMap', conversationIDKey])
          }
        }
        s.set('selectedConversation', conversationIDKey)
      })
    case Chat2Gen.updateUnreadline:
      if (action.payload.messageID > 0) {
        return state.setIn(['orangeLineMap', action.payload.conversationIDKey], action.payload.messageID)
      } else {
        return state.deleteIn(['orangeLineMap', action.payload.conversationIDKey])
      }
    case Chat2Gen.unfurlTogglePrompt:
      const {show, domain} = action.payload
      return state.updateIn(
        ['unfurlPromptMap', action.payload.conversationIDKey, action.payload.messageID],
        I.Set(),
        prompts => {
          return show ? prompts.add(domain) : prompts.delete(domain)
        }
      )
    case Chat2Gen.setInboxFilter:
      return state.set('inboxFilter', action.payload.filter)
    case Chat2Gen.setPendingMode:
      return state.withMutations(_s => {
        const s = (_s: Types.State)
        s.set('pendingMode', action.payload.pendingMode)
        s.set('pendingStatus', 'none')
        if (action.payload.pendingMode === 'none') {
          s.setIn(['metaMap', Constants.pendingConversationIDKey, 'participants'], I.List())
          s.setIn(
            ['metaMap', Constants.pendingConversationIDKey, 'conversationIDKey'],
            Constants.noConversationIDKey
          )
          s.deleteIn(['messageOrdinals', Constants.pendingConversationIDKey])
          s.deleteIn(['pendingOutboxToOrdinal', Constants.pendingConversationIDKey])
          s.deleteIn(['messageMap', Constants.pendingConversationIDKey])
        }
      })
    case Chat2Gen.setPaymentConfirmInfo:
      return action.error
        ? state.set('paymentConfirmInfo', {error: action.payload.error})
        : state.set('paymentConfirmInfo', {summary: action.payload.summary})
    case Chat2Gen.clearPaymentConfirmInfo:
      return state.set('paymentConfirmInfo', null)
    case Chat2Gen.setPendingStatus:
      return state.set('pendingStatus', action.payload.pendingStatus)
    case Chat2Gen.createConversation:
      return state.set('pendingStatus', 'none')
    case Chat2Gen.setPendingConversationUsers:
      return state.setIn(
        ['metaMap', Constants.pendingConversationIDKey, 'participants'],
        I.List(action.payload.users)
      )
    case Chat2Gen.setPendingConversationExistingConversationIDKey:
      return state.setIn(
        ['metaMap', Constants.pendingConversationIDKey, 'conversationIDKey'],
        action.payload.conversationIDKey
      )
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
        if (!s.badgeMap.equals(badgeMap)) {
          s.set('badgeMap', badgeMap)
        }
        if (!s.unreadMap.equals(unreadMap)) {
          s.set('unreadMap', unreadMap)
        }
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
        const ordinals = state.messageOrdinals.get(conversationIDKey, I.OrderedSet())
        const found = ordinals.findLast(o => {
          const message = messageMap.get(o)
          return message && message.type === 'text' && message.author === editLastUser && !message.exploded
        })
        if (found) {
          return editingMap.set(conversationIDKey, found)
        }
        return editingMap
      })
    case Chat2Gen.messageSetQuoting:
      const {ordinal, sourceConversationIDKey, targetConversationIDKey} = action.payload
      const counter = (state.quote ? state.quote.counter : 0) + 1
      return state.set(
        'quote',
        Constants.makeQuoteInfo({counter, ordinal, sourceConversationIDKey, targetConversationIDKey})
      )
    case Chat2Gen.messagesAdd: {
      const {context, shouldClearOthers} = action.payload
      // pull out deletes and handle at the end
      const [messages, deletedMessages] = partition(action.payload.messages, m => m.type !== 'deleted')
      // we want the clear applied when we call findExisting
      let oldMessageOrdinals = state.messageOrdinals
      let oldPendingOutboxToOrdinal = state.pendingOutboxToOrdinal
      let oldMessageMap = state.messageMap

      // so we can keep messages if they haven't mutated
      const previousMessageMap = state.messageMap

      // first group into convoid
      const convoToMessages: {[cid: string]: Array<Types.Message>} = messages.reduce((map, m) => {
        const key = String(m.conversationIDKey)
        map[key] = map[key] || []
        map[key].push(m)
        return map
      }, {})
      const convoToDeletedOrdinals: {[cid: string]: Set<Types.Ordinal>} = deletedMessages.reduce((map, m) => {
        const key = String(m.conversationIDKey)
        map[key] = map[key] || new Set()
        map[key].add(m.ordinal)
        return map
      }, {})

      if (shouldClearOthers) {
        oldMessageOrdinals = oldMessageOrdinals.withMutations(map => {
          Object.keys(convoToMessages).forEach(cid => map.delete(Types.stringToConversationIDKey(cid)))
        })
        oldPendingOutboxToOrdinal = oldPendingOutboxToOrdinal.withMutations(map => {
          Object.keys(convoToMessages).forEach(cid => map.delete(Types.stringToConversationIDKey(cid)))
        })
        oldMessageMap = oldMessageMap.withMutations(map => {
          Object.keys(convoToMessages).forEach(cid => map.delete(Types.stringToConversationIDKey(cid)))
        })
      }

      // Types we can send and have to deal with outbox ids
      const canSendType = (m: Types.Message): ?Types.MessageText | ?Types.MessageAttachment =>
        m.type === 'text' || m.type === 'attachment' ? m : null

      // Update any pending messages
      const pendingOutboxToOrdinal = oldPendingOutboxToOrdinal.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.Map<Types.OutboxID, Types.Ordinal>>) => {
          if (context.type === 'sent' || context.type === 'threadLoad' || context.type === 'incoming') {
            messages.forEach(message => {
              const m = canSendType(message)
              if (m && !m.id && m.outboxID) {
                map.setIn([m.conversationIDKey, m.outboxID], m.ordinal)
              }
            })
          }
        }
      )

      const findExistingSentOrPending = (
        conversationIDKey: Types.ConversationIDKey,
        m: Types.MessageText | Types.MessageAttachment
      ) => {
        // something we sent
        if (m.outboxID) {
          // and we know about it
          const ordinal = oldPendingOutboxToOrdinal.getIn([conversationIDKey, m.outboxID])
          if (ordinal) {
            return oldMessageMap.getIn([conversationIDKey, ordinal])
          }
        }
        const pendingOrdinal = messageIDToOrdinal(
          oldMessageMap,
          oldPendingOutboxToOrdinal,
          conversationIDKey,
          m.id
        )
        if (pendingOrdinal) {
          return oldMessageMap.getIn([conversationIDKey, pendingOrdinal])
        }
        return null
      }

      let messageOrdinals = oldMessageOrdinals.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.OrderedSet<Types.Ordinal>>) => {
          Object.keys(convoToDeletedOrdinals).forEach(cid => {
            const conversationIDKey = Types.stringToConversationIDKey(cid)
            map.update(conversationIDKey, I.OrderedSet(), (set: I.OrderedSet<Types.Ordinal>) =>
              set.subtract(convoToDeletedOrdinals[conversationIDKey])
            )
          })
        }
      )
      messageOrdinals = messageOrdinals.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.OrderedSet<Types.Ordinal>>) => {
          Object.keys(convoToMessages).forEach(cid => {
            const conversationIDKey = Types.stringToConversationIDKey(cid)
            const messages = convoToMessages[cid]
            const ordinals = messages.reduce((arr, message) => {
              const m = canSendType(message)
              if (m) {
                // Sendable so we might have an existing message
                if (!findExistingSentOrPending(conversationIDKey, m)) {
                  arr.push(m.ordinal)
                }
              } else if (message.type === 'placeholder') {
                // sometimes we send then get a placeholder for that send. Lets see if we already have the message id for the sent
                // and ignore the placeholder in that instance
                logger.info(`Got placeholder message with id: ${message.id}`)
                const existingOrdinal = messageIDToOrdinal(
                  oldMessageMap,
                  pendingOutboxToOrdinal,
                  conversationIDKey,
                  message.id
                )
                if (!existingOrdinal) {
                  arr.push(message.ordinal)
                } else {
                  logger.info(`Skipping placeholder for message with id ${message.id} because already exists`)
                }
              } else {
                arr.push(message.ordinal)
              }
              return arr
            }, [])

            map.update(conversationIDKey, I.OrderedSet(), (set: I.OrderedSet<Types.Ordinal>) =>
              // add new ones, remove deleted ones, sort
              set.concat(ordinals).sort()
            )
          })
        }
      )

      let messageMap = oldMessageMap.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.Map<Types.Ordinal, Types.Message>>) => {
          Object.keys(convoToDeletedOrdinals).forEach(cid => {
            const conversationIDKey = Types.stringToConversationIDKey(cid)
            map.update(conversationIDKey, (m = I.Map()) =>
              m.deleteAll(convoToDeletedOrdinals[conversationIDKey])
            )
          })
        }
      )
      messageMap = messageMap.withMutations(
        (map: I.Map<Types.ConversationIDKey, I.Map<Types.Ordinal, Types.Message>>) => {
          Object.keys(convoToMessages).forEach(cid => {
            const conversationIDKey = Types.stringToConversationIDKey(cid)
            const messages = convoToMessages[cid]
            messages.forEach(message => {
              const m = canSendType(message)
              const oldSentOrPending = m ? findExistingSentOrPending(conversationIDKey, m) : null
              let toSet
              if (oldSentOrPending) {
                toSet = Constants.upgradeMessage(oldSentOrPending, message)
              } else {
                toSet = Constants.mergeMessage(
                  m ? previousMessageMap.getIn([conversationIDKey, m.ordinal]) : null,
                  message
                )
              }
              map.setIn([conversationIDKey, toSet.ordinal], toSet)
            })
          })
        }
      )

      return state.withMutations(s => {
        s.set('messageMap', messageMap)
        // only if different
        if (!state.messageOrdinals.equals(messageOrdinals)) {
          s.set('messageOrdinals', messageOrdinals)
        }
        s.set('pendingOutboxToOrdinal', pendingOutboxToOrdinal)
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
              return message.set('errorReason', reason).set('submitState', 'failed')
            }
            if (message.type === 'attachment') {
              return message.set('errorReason', reason).set('submitState', 'failed')
            }
          }
          return message
        })
      )
    }
    case EngineGen.chat1NotifyChatChatTypingUpdate: {
      const {typingUpdates} = action.payload.params
      const typingMap = I.Map(
        (typingUpdates || []).reduce((arr, u) => {
          arr.push([Types.conversationIDToKey(u.convID), I.Set((u.typers || []).map(t => t.username))])
          return arr
        }, [])
      )
      return state.merge({typingMap})
    }
    case Chat2Gen.toggleLocalReaction: {
      const {conversationIDKey, emoji, targetOrdinal, username} = action.payload
      return state.update('messageMap', messageMap =>
        messageMap.update(conversationIDKey, I.Map(), (map: I.Map<Types.Ordinal, Types.Message>) => {
          return map.update(targetOrdinal, message => {
            if (!message || message.type === 'deleted' || message.type === 'placeholder') {
              return message
            }
            const reactions = message.reactions
            // $FlowIssue thinks `message` is the inner type
            return message.set(
              'reactions',
              reactions.withMutations(reactionMap => {
                reactionMap.update(emoji, I.Set(), rs => {
                  const existing = rs.find(r => r.username === username)
                  if (existing) {
                    // found an existing reaction. remove it from our list
                    return rs.delete(existing)
                  }
                  // no existing reaction. add this one to the map
                  return rs.add(Constants.makeReaction({timestamp: Date.now(), username}))
                })
                const newSet = reactionMap.get(emoji)
                if (newSet && newSet.size === 0) {
                  reactionMap.delete(emoji)
                }
              })
            )
          })
        })
      )
    }
    case Chat2Gen.updateReactions: {
      const {conversationIDKey, updates} = action.payload
      const targetData = updates.map(u => ({
        reactions: u.reactions,
        targetMsgID: u.targetMsgID,
        targetOrdinal: messageIDToOrdinal(
          state.messageMap,
          state.pendingOutboxToOrdinal,
          conversationIDKey,
          u.targetMsgID
        ),
      }))
      return state.update('messageMap', messageMap =>
        messageMap.update(conversationIDKey, I.Map(), (map: I.Map<Types.Ordinal, Types.Message>) =>
          map.withMutations(mm => {
            targetData.forEach(td => {
              if (!td.targetOrdinal) {
                logger.info(
                  `updateReactions: couldn't find target ordinal for targetMsgID=${
                    td.targetMsgID
                  } in convID=${conversationIDKey}`
                )
                return
              }
              mm.update(td.targetOrdinal, message => {
                if (!message || message.type === 'deleted' || message.type === 'placeholder') {
                  return message
                }
                // $FlowIssue thinks `message` is the inner type
                return message.set('reactions', td.reactions)
              })
            })
          })
        )
      )
    }
    case Chat2Gen.messagesWereDeleted: {
      const {
        conversationIDKey,
        deletableMessageTypes = Constants.allMessageTypes,
        messageIDs = [],
        ordinals = [],
        upToMessageID = null,
      } = action.payload

      let upToOrdinals = []
      if (upToMessageID) {
        const ordinalToMessage = state.messageMap.get(conversationIDKey, I.Map())
        ordinalToMessage.reduce((arr, m, ordinal) => {
          if (m.id < upToMessageID && deletableMessageTypes.has(m.type)) {
            arr.push(ordinal)
          }
          return arr
        }, upToOrdinals)
      }

      const allOrdinals = I.Set(
        [
          ...ordinals,
          ...messageIDs.map(messageID =>
            messageIDToOrdinal(state.messageMap, state.pendingOutboxToOrdinal, conversationIDKey, messageID)
          ),
          ...upToOrdinals,
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
          messageOrdinals.update(conversationIDKey, ordinals =>
            ordinals ? ordinals.subtract(allOrdinals) : ordinals
          )
        )
      })
    }
    case Chat2Gen.updateMoreToLoad:
      return state.update('moreToLoadMap', moreToLoadMap =>
        moreToLoadMap.set(action.payload.conversationIDKey, action.payload.moreToLoad)
      )

    case Chat2Gen.updateConvExplodingModes:
      const {modes} = action.payload
      const explodingMap = modes.reduce((map, mode) => {
        map[Types.conversationIDKeyToString(mode.conversationIDKey)] = mode.seconds
        return map
      }, {})
      return state.set('explodingModes', I.Map(explodingMap))
    case Chat2Gen.setExplodingModeLock:
      const {conversationIDKey, unset} = action.payload
      const mode = state.getIn(['explodingModes', conversationIDKey], 0)
      // we already have the new mode in `explodingModes`, if we've already locked it we shouldn't update
      const alreadyLocked = state.getIn(['explodingModeLocks', conversationIDKey], null) !== null
      if (unset) {
        return state.update('explodingModeLocks', el => el.delete(conversationIDKey))
      }
      return alreadyLocked ? state : state.setIn(['explodingModeLocks', conversationIDKey], mode)
    case Chat2Gen.setUnsentText:
      return state.update('unsentTextMap', old =>
        old.setIn([action.payload.conversationIDKey], action.payload.text)
      )
    case Chat2Gen.staticConfigLoaded:
      return state.set('staticConfig', action.payload.staticConfig)
    case Chat2Gen.metasReceived: {
      const nextState = action.payload.fromInboxRefresh ? state.set('inboxHasLoaded', true) : state
      return nextState.withMutations(s => {
        s.set('metaMap', metaMapReducer(state.metaMap, action))
        s.set('messageMap', messageMapReducer(state.messageMap, action, state.pendingOutboxToOrdinal))
        s.set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
      })
    }
    case Chat2Gen.paymentInfoReceived: {
      const {conversationIDKey, messageID, paymentInfo} = action.payload
      let nextState = state.update('accountsInfoMap', old =>
        old.setIn([conversationIDKey, messageID], paymentInfo)
      )
      return nextState.update('paymentStatusMap', old => old.setIn([paymentInfo.paymentID], paymentInfo))
    }
    case Chat2Gen.requestInfoReceived: {
      const {conversationIDKey, messageID, requestInfo} = action.payload
      return state.update('accountsInfoMap', old => old.setIn([conversationIDKey, messageID], requestInfo))
    }
    case Chat2Gen.attachmentFullscreenSelection: {
      const {message} = action.payload
      return state.set('attachmentFullscreenMessage', message)
    }
    case Chat2Gen.handleSeeingWallets: // fallthrough
    case Chat2Gen.setWalletsOld:
      return state.isWalletsNew ? state.set('isWalletsNew', false) : state
    case Chat2Gen.attachmentDownloaded:
      const {message, path} = action.payload
      let nextState = state
      // check fullscreen attachment message in case we downloaded it
      if (
        state.attachmentFullscreenMessage &&
        state.attachmentFullscreenMessage.conversationIDKey === message.conversationIDKey &&
        state.attachmentFullscreenMessage.id === message.id &&
        message.type === 'attachment'
      ) {
        nextState = nextState.set('attachmentFullscreenMessage', message.set('downloadPath', path))
      }
      return nextState.withMutations(s => {
        s.set('metaMap', metaMapReducer(state.metaMap, action))
        s.set('messageMap', messageMapReducer(state.messageMap, action, state.pendingOutboxToOrdinal))
        s.set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
      })
    // metaMap/messageMap/messageOrdinalsList only actions
    case Chat2Gen.messageDelete:
    case Chat2Gen.messageEdit:
    case Chat2Gen.messageWasEdited:
    case Chat2Gen.pendingMessageWasEdited:
    case Chat2Gen.messageAttachmentUploaded:
    case Chat2Gen.metaReceivedError:
    case Chat2Gen.metaRequestingTrusted:
    case Chat2Gen.attachmentLoading:
    case Chat2Gen.attachmentUploading:
    case Chat2Gen.attachmentUploaded:
    case Chat2Gen.attachmentMobileSave:
    case Chat2Gen.attachmentMobileSaved:
    case Chat2Gen.attachmentDownload:
    case Chat2Gen.markConversationsStale:
    case Chat2Gen.notificationSettingsUpdated:
    case Chat2Gen.metaDelete:
    case Chat2Gen.setConversationOffline:
    case Chat2Gen.updateConvRetentionPolicy:
    case Chat2Gen.updateTeamRetentionPolicy:
    case Chat2Gen.messagesExploded:
    case Chat2Gen.saveMinWriterRole:
    case Chat2Gen.updateMessages:
      return state.withMutations(s => {
        s.set('metaMap', metaMapReducer(state.metaMap, action))
        s.set('messageMap', messageMapReducer(state.messageMap, action, state.pendingOutboxToOrdinal))
        s.set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
      })
    case TeamBuildingGen.resetStore:
    case TeamBuildingGen.cancelTeamBuilding:
    case TeamBuildingGen.addUsersToTeamSoFar:
    case TeamBuildingGen.removeUsersFromTeamSoFar:
    case TeamBuildingGen.searchResultsLoaded:
    case TeamBuildingGen.finishedTeamBuilding:
    case TeamBuildingGen.search:
    case TeamBuildingGen.fetchedUserRecs:
    case TeamBuildingGen.fetchUserRecs:
      return teamBuildingReducer(state, action)

    // Saga only actions
    case Chat2Gen.attachmentPreviewSelect:
    case Chat2Gen.attachmentsUpload:
    case Chat2Gen.attachmentPasted:
    case Chat2Gen.attachmentFullscreenNext:
    case Chat2Gen.desktopNotification:
    case Chat2Gen.inboxRefresh:
    case Chat2Gen.joinConversation:
    case Chat2Gen.leaveConversation:
    case Chat2Gen.loadOlderMessagesDueToScroll:
    case Chat2Gen.markInitiallyLoadedThreadAsRead:
    case Chat2Gen.messageDeleteHistory:
    case Chat2Gen.messageReplyPrivately:
    case Chat2Gen.messageSend:
    case Chat2Gen.metaHandleQueue:
    case Chat2Gen.metaNeedsUpdating:
    case Chat2Gen.metaRequestTrusted:
    case Chat2Gen.muteConversation:
    case Chat2Gen.openFolder:
    case Chat2Gen.resetChatWithoutThem:
    case Chat2Gen.resetLetThemIn:
    case Chat2Gen.sendTyping:
    case Chat2Gen.setConvRetentionPolicy:
    case Chat2Gen.navigateToInbox:
    case Chat2Gen.navigateToThread:
    case Chat2Gen.messageAttachmentNativeShare:
    case Chat2Gen.messageAttachmentNativeSave:
    case Chat2Gen.updateNotificationSettings:
    case Chat2Gen.blockConversation:
    case Chat2Gen.previewConversation:
    case Chat2Gen.setConvExplodingMode:
    case Chat2Gen.toggleMessageReaction:
    case Chat2Gen.setMinWriterRole:
    case Chat2Gen.openChatFromWidget:
    case Chat2Gen.prepareFulfillRequestForm:
    case Chat2Gen.unfurlResolvePrompt:
    case Chat2Gen.unfurlRemove:
    case Chat2Gen.confirmScreenResponse:
    case Chat2Gen.toggleMessageCollapse:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}

export default rootReducer
