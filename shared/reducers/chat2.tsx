import * as Chat2Gen from '../actions/chat2-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
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
import {ifTSCComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch} from '../util/switch'

type EngineActions =
  | EngineGen.Chat1NotifyChatChatTypingUpdatePayload
  | EngineGen.Chat1ChatUiChatBotCommandsUpdateStatusPayload

const initialState: Types.State = Constants.makeState()

// Backend gives us messageIDs sometimes so we need to find our ordinal
const messageIDToOrdinal = (
  messageMap: Types.State['messageMap'],
  pendingOutboxToOrdinal: Types.State['pendingOutboxToOrdinal'],
  conversationIDKey: Types.ConversationIDKey,
  messageID: Types.MessageID
): Types.Ordinal | null => {
  // A message we didn't send in this session?
  let m = messageMap.getIn([conversationIDKey, Types.numberToOrdinal(messageID)])
  if (m && m.id && m.id === messageID) {
    return m.ordinal
  }
  // Search through our sent messages
  const pendingOrdinal = (
    pendingOutboxToOrdinal.get(conversationIDKey) || I.Map<Types.OutboxID, Types.Ordinal>()
  ).find(o => {
    m = messageMap.getIn([conversationIDKey, o])
    if (m && m.id && m.id === messageID) {
      return true
    }
    return false
  })

  if (pendingOrdinal) {
    return pendingOrdinal
  }

  return null
}

const metaMapReducer = (
  metaMap: Types.State['metaMap'],
  action: Chat2Gen.Actions
): Types.State['metaMap'] => {
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
          case RPCChatTypes.ConversationErrorType.otherrekeyneeded: // fallthrough
          case RPCChatTypes.ConversationErrorType.selfrekeyneeded: {
            const {username, conversationIDKey} = action.payload
            const rekeyInfo = error.rekeyInfo
            const participants = rekeyInfo
              ? I.Set<string>(
                  ([] as Array<string>)
                    .concat(rekeyInfo.writerNames || [], rekeyInfo.readerNames || [])
                    .filter(Boolean)
                ).toList()
              : I.OrderedSet<string>(error.unverifiedTLFName.split(',')).toList()

            const rekeyers = I.Set<string>(
              error.typ === RPCChatTypes.ConversationErrorType.selfrekeyneeded
                ? [username || '']
                : (error.rekeyInfo && error.rekeyInfo.rekeyers) || []
            )
            let newMeta = Constants.unverifiedInboxUIItemToConversationMeta(error.remoteConv)
            if (!newMeta) {
              // public conversation, do nothing
              return metaMap
            }
            newMeta = newMeta.merge({
              participants,
              rekeyers,
              snippet: error.message,
              snippetDecoration: '',
              trustedState: 'error' as const,
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
          map.clear()
        }
        const neverCreate = !!action.payload.neverCreate
        map.deleteAll(action.payload.removals || [])
        action.payload.metas.forEach(meta => {
          map.update(meta.conversationIDKey, old => {
            if (old) {
              return Constants.updateMeta(old, meta)
            } else {
              return neverCreate ? old : meta
            }
          })
        })
      })
    case Chat2Gen.updateConvRetentionPolicy: {
      const {meta} = action.payload
      const newMeta = meta
      if (metaMap.has(newMeta.conversationIDKey)) {
        // only insert if the convo is already in the inbox
        return metaMap.set(newMeta.conversationIDKey, newMeta)
      }
      return metaMap
    }
    case Chat2Gen.updateTeamRetentionPolicy: {
      const {metas} = action.payload
      const newMetas = metas.reduce<{[key: string]: Types.ConversationMeta}>((updated, meta) => {
        const newMeta = meta
        if (newMeta && metaMap.has(newMeta.conversationIDKey)) {
          // only insert if the convo is already in the inbox
          updated[Types.conversationIDKeyToString(newMeta.conversationIDKey)] = newMeta
        }
        return updated
      }, {})
      return metaMap.merge(newMetas)
    }
    case Chat2Gen.saveMinWriterRole: {
      const {cannotWrite, conversationIDKey, role} = action.payload
      return metaMap.update(conversationIDKey, old => {
        if (old) {
          return old.set('cannotWrite', cannotWrite).set('minWriterRole', role)
        }
        // if we haven't loaded it yet we'll load it on navigation into the
        // convo
        return old
      })
    }
    default:
      return metaMap
  }
}

const messageMapReducer = (
  messageMap: Types.State['messageMap'],
  action: Chat2Gen.Actions,
  pendingOutboxToOrdinal: Types.State['pendingOutboxToOrdinal']
): Types.State['messageMap'] => {
  switch (action.type) {
    case Chat2Gen.markConversationsStale:
      return action.payload.updateType === RPCChatTypes.StaleUpdateType.clear
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
          : message.withMutations((m: any) => {
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
    case Chat2Gen.attachmentUploading: {
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
    }
    case Chat2Gen.attachmentLoading:
      return messageMap.updateIn(
        [action.payload.conversationIDKey, action.payload.message.ordinal],
        message => {
          if (!message || message.type !== 'attachment') {
            return message
          }
          return action.payload.isPreview
            ? message.set('previewTransferState', 'downloading')
            : message
                .set('transferProgress', action.payload.ratio)
                .set('transferState', 'downloading')
                .set('transferErrMsg', null)
        }
      )
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
        return message.set('transferState', 'mobileSaving').set('transferErrMsg', null)
      })
    case Chat2Gen.attachmentMobileSaved:
      return messageMap.updateIn([action.payload.conversationIDKey, action.payload.ordinal], message => {
        if (!message || message.type !== 'attachment') {
          return message
        }
        return message.set('transferState', null).set('transferErrMsg', null)
      })
    case Chat2Gen.attachmentDownload:
      return messageMap.updateIn(
        [action.payload.message.conversationIDKey, action.payload.message.ordinal],
        message => {
          if (!message || message.type !== 'attachment') {
            return message
          }
          return message.set('transferState', 'downloading').set('transferErrMsg', null)
        }
      )
    case Chat2Gen.attachmentDownloaded:
      return messageMap.updateIn(
        [action.payload.message.conversationIDKey, action.payload.message.ordinal],
        message => {
          if (!message || message.type !== 'attachment') {
            return message
          }
          const path = (!actionHasError(action) && action.payload.path) || ''
          return message
            .set('downloadPath', path)
            .set('transferProgress', 0)
            .set('transferState', null)
            .set(
              'transferErrMsg',
              actionHasError(action) ? action.payload.error || 'Error downloading attachment' : null
            )
            .set('fileURLCached', true) // assume we have this on the service now
        }
      )
    case Chat2Gen.metasReceived:
      if (action.payload.clearExistingMessages) {
        return messageMap.clear()
      }
      return messageMap
    case Chat2Gen.updateMessages: {
      const updateOrdinals = action.payload.messages.reduce<
        Array<{msg: Types.Message; ordinal: Types.Ordinal}>
      >((l, msg) => {
        const ordinal = messageIDToOrdinal(
          messageMap,
          pendingOutboxToOrdinal,
          action.payload.conversationIDKey,
          msg.messageID
        )
        if (!ordinal) {
          return l
        }
        // @ts-ignore TODO Fix not sure whats up
        const m: Types.Message = msg.message.set('ordinal', ordinal)
        return l.concat({msg: m, ordinal})
      }, [])
      return messageMap.updateIn(
        [action.payload.conversationIDKey],
        (messages: I.Map<number, Types.Message>) => {
          if (!messages) {
            return messages
          }
          return messages.withMutations(msgs => {
            updateOrdinals.forEach(r => {
              msgs.set(r.ordinal, r.msg)
            })
          })
        }
      )
    }
    case Chat2Gen.messagesExploded: {
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
        return messages.withMutations((msgs: any) => {
          ordinals.forEach(ordinal =>
            msgs.updateIn([ordinal], (msg: any) =>
              msg
                .set('exploded', true)
                .set('explodedBy', action.payload.explodedBy || '')
                .set('text', new HiddenString(''))
                .set('mentionsAt', I.Set())
                .set('reactions', I.Map())
                .set('unfurls', I.Map())
                .set('flipGameID', '')
            )
          )
        })
      })
    }
    default:
      return messageMap
  }
}

const messageOrdinalsReducer = (
  messageOrdinals: Types.State['messageOrdinals'],
  action: Chat2Gen.Actions
): Types.State['messageOrdinals'] => {
  switch (action.type) {
    case Chat2Gen.markConversationsStale:
      return action.payload.updateType === RPCChatTypes.StaleUpdateType.clear
        ? messageOrdinals.deleteAll(action.payload.conversationIDKeys)
        : messageOrdinals
    case Chat2Gen.metasReceived:
      return action.payload.clearExistingMessages ? messageOrdinals.clear() : messageOrdinals
    default:
      return messageOrdinals
  }
}

const badgeKey = String(isMobile ? RPCTypes.DeviceType.mobile : RPCTypes.DeviceType.desktop)

type Actions = Chat2Gen.Actions | TeamBuildingGen.Actions | EngineActions

export default (_state: Types.State = initialState, action: Actions): Types.State =>
  Container.produce(state, (draftState: Container.Draft<Types.State>) => {
    switch (action.type) {
      case Chat2Gen.resetStore:
        return {...initialState, staticConfig: draftState.staticConfig}
      case Chat2Gen.setInboxShowIsNew:
        draftState.inboxShowNew = action.payload.isNew
        return
      case Chat2Gen.toggleSmallTeamsExpanded:
        draftState.smallTeamsExpanded = !draftState.smallTeamsExpanded
        return
      case Chat2Gen.changeFocus:
        draftState.focus = action.payload.nextFocus
        return
      case Chat2Gen.selectConversation:
        {
          // ignore non-changing
          if (draftState.selectedConversation === action.payload.conversationIDKey) {
            return
          }

          const conversationIDKey = action.payload.conversationIDKey
          if (conversationIDKey) {
            const {readMsgID, maxVisibleMsgID} = draftState.metaMap.get(
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
              const messageMap = draftState.messageMap.get(
                conversationIDKey,
                I.Map<Types.Ordinal, Types.Message>()
              )
              const ordinals =
                draftState.messageOrdinals.get(conversationIDKey) || I.OrderedSet<Types.Ordinal>()
              const ord = ordinals.find(o => {
                const message = messageMap.get(o)
                return !!(message && message.id >= readMsgID + 1)
              })
              const message = ord && messageMap.get(ord)
              if (message && message.id) {
                draftState.orangeLineMap = draftState.orangeLineMap.set(conversationIDKey, message.id)
              } else {
                draftState.orangeLineMap = draftState.orangeLineMap.delete(conversationIDKey)
              }
            } else {
              // If there aren't any new messages, we don't want to display an
              // orange line so remove its entry from orangeLineMap
              draftState.orangeLineMap = draftState.orangeLineMap.delete(conversationIDKey)
            }
          }
          const prevConvIDKey = draftState.selectedConversation
          // blank out draft so we don't flash old data when switching convs
          draftState.metaMap = draftState.metaMap.updateIn(
            ['metaMap', prevConvIDKey],
            (m: Types.ConversationMeta) => {
              return m ? m.merge({draft: ''}) : m
            }
          )
          draftState.messageCenterOrdinals = draftState.messageCenterOrdinals.delete(conversationIDKey)
          draftState.threadLoadStatus = draftState.threadLoadStatus.delete(conversationIDKey)
          draftState.containsLatestMessageMap = draftState.containsLatestMessageMap.set(
            conversationIDKey,
            true
          )
          draftState.previousSelectedConversation = prevConvIDKey
          draftState.selectedConversation = conversationIDKey
          if (Constants.isValidConversationIDKey(conversationIDKey)) {
            // If navigating away from error conversation to a valid conv - clear
            // error msg.
            draftState.createConversationError = null
          }
        }
        return
      case Chat2Gen.conversationErrored:
        draftState.createConversationError = action.payload.message
        return
      case Chat2Gen.updateUnreadline:
        if (action.payload.messageID > 0) {
          draftState.orangeLineMap = draftState.orangeLineMap.set(
            action.payload.conversationIDKey,
            action.payload.messageID
          )
        } else {
          draftState.orangeLineMap = draftState.orangeLineMap.delete(action.payload.conversationIDKey)
        }
        return
      case Chat2Gen.unfurlTogglePrompt: {
        const {show, domain} = action.payload
        draftState.unfurlPromptMap = draftState.unfurlPromptMap.updateIn(
          [action.payload.conversationIDKey, action.payload.messageID],
          (prompts = I.Set<string>()) => (show ? prompts.add(domain) : prompts.delete(domain))
        )
        return
      }
      case Chat2Gen.updateCoinFlipStatus: {
        draftState.flipStatusMap = draftState.flipStatusMap.withMutations(fm => {
          action.payload.statuses.forEach(status => {
            fm.set(status.gameID, status)
          })
        })
        return
      }
      case Chat2Gen.messageSend:
        draftState.commandMarkdownMap = draftState.commandMarkdownMap.delete(action.payload.conversationIDKey)
        draftState.replyToMap = draftState.replyToMap.delete(action.payload.conversationIDKey)
        return
      case Chat2Gen.setCommandMarkdown: {
        const {conversationIDKey, md} = action.payload
        if (md) {
          draftState.commandMarkdownMap = draftState.commandMarkdownMap.set(conversationIDKey, md)
        } else {
          draftState.commandMarkdownMap = draftState.commandMarkdownMap.delete(conversationIDKey)
        }
        return
      }
      case Chat2Gen.setThreadLoadStatus:
        draftState.threadLoadStatus = draftState.threadLoadStatus.set(
          action.payload.conversationIDKey,
          action.payload.status
        )
        return
      case Chat2Gen.setCommandStatusInfo:
        draftState.commandStatusMap = draftState.commandStatusMap.set(
          action.payload.conversationIDKey,
          action.payload.info
        )
        return
      case Chat2Gen.clearCommandStatusInfo:
        draftState.commandStatusMap = draftState.commandStatusMap.delete(action.payload.conversationIDKey)
        return
      case Chat2Gen.giphyToggleWindow: {
        const conversationIDKey = action.payload.conversationIDKey
        draftState.giphyWindowMap = draftState.giphyWindowMap.set(conversationIDKey, action.payload.show)
        if (!action.payload.show) {
          draftState.giphyResultMap = draftState.giphyResultMap.set(conversationIDKey, null)
        }
        if (action.payload.clearInput) {
          draftState.unsentTextMap = draftState.unsentTextMap.set(conversationIDKey, new HiddenString(''))
        }
        return
      }
      case Chat2Gen.updateLastCoord:
        draftState.lastCoord = action.payload.coord
        return
      case Chat2Gen.giphyGotSearchResult:
        draftState.giphyResultMap = draftState.giphyResultMap.set(
          action.payload.conversationIDKey,
          action.payload.results
        )
        return
      case Chat2Gen.setPaymentConfirmInfo:
        draftState.paymentConfirmInfo = actionHasError(action)
          ? {error: action.payload.error}
          : {summary: action.payload.summary}
        return
      case Chat2Gen.clearPaymentConfirmInfo:
        draftState.paymentConfirmInfo = null
        return
      case Chat2Gen.badgesUpdated: {
        const badgeMap = I.Map<Types.ConversationIDKey, number>(
          action.payload.conversations.map(({convID, badgeCounts}) => [
            Types.conversationIDToKey(convID),
            badgeCounts[badgeKey] || 0,
          ])
        )
        if (!draftState.badgeMap.equals(badgeMap)) {
          draftState.badgeMap = badgeMap
        }
        const unreadMap = I.Map<Types.ConversationIDKey, number>(
          action.payload.conversations.map(({convID, unreadMessages}) => [
            Types.conversationIDToKey(convID),
            unreadMessages,
          ])
        )
        if (!draftState.unreadMap.equals(unreadMap)) {
          draftState.unreadMap = unreadMap
        }

        return
      }
      case Chat2Gen.messageSetEditing: {
        const {conversationIDKey, editLastUser, ordinal} = action.payload

        // clearing
        if (!editLastUser && !ordinal) {
          draftState.editingMap = draftState.editingMap.delete(conversationIDKey)
          return
        }

        const messageMap = draftState.messageMap.get(conversationIDKey, I.Map<Types.Ordinal, Types.Message>())

        // editing a specific message
        if (ordinal) {
          const message = messageMap.get(ordinal)
          if (message && message.type === 'text') {
            draftState.editingMap = draftState.editingMap.set(conversationIDKey, ordinal)
            return
          } else {
            return
          }
        }

        // Editing your last message
        const ordinals = draftState.messageOrdinals.get(conversationIDKey) || I.OrderedSet<Types.Ordinal>()
        const found = ordinals.findLast(o => {
          const message = messageMap.get(o)
          return !!(
            message &&
            message.type === 'text' &&
            message.author === editLastUser &&
            !message.exploded &&
            message.isEditable
          )
        })
        if (found) {
          draftState.editingMap = draftState.editingMap.set(conversationIDKey, found)
          return
        }
        return
      }
      case Chat2Gen.messageSetQuoting: {
        const {ordinal, sourceConversationIDKey, targetConversationIDKey} = action.payload
        const counter = (state.quote ? state.quote.counter : 0) + 1
        draftState.quote = Constants.makeQuoteInfo({
          counter,
          ordinal,
          sourceConversationIDKey,
          targetConversationIDKey,
        })
        return
      }
      case Chat2Gen.messagesAdd: {
        const {context, shouldClearOthers} = action.payload
        // pull out deletes and handle at the end
        const [messages, deletedMessages] = partition(action.payload.messages, m => m.type !== 'deleted')
        // we want the clear applied when we call findExisting
        let oldMessageOrdinals = draftState.messageOrdinals
        let oldPendingOutboxToOrdinal = draftState.pendingOutboxToOrdinal
        let oldMessageMap = draftState.messageMap

        // so we can keep messages if they haven't mutated
        const previousMessageMap = state.messageMap

        // first group into convoid
        const convoToMessages: {[K in string]: Array<Types.Message>} = messages.reduce((map: any, m) => {
          const key = String(m.conversationIDKey)
          map[key] = map[key] || []
          map[key].push(m)
          return map
        }, {})
        const convoToDeletedOrdinals: {[K in string]: Set<Types.Ordinal>} = deletedMessages.reduce(
          (map: any, m) => {
            const key = String(m.conversationIDKey)
            // @ts-ignore
            map[key] = map[key] || new Set()
            // @ts-ignore
            map[key].add(m.ordinal)
            return map
          },
          {}
        )

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
        const canSendType = (m: Types.Message): Types.MessageText | null | Types.MessageAttachment | null =>
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
              const removedOrdinals: Array<Types.Ordinal> = []
              const ordinals = messages.reduce<Array<Types.Ordinal>>((arr, message) => {
                const m = canSendType(message)
                if (m) {
                  // Sendable so we might have an existing message
                  if (!findExistingSentOrPending(conversationIDKey, m)) {
                    arr.push(m.ordinal)
                  }
                  // We might have a placeholder for this message in there with ordinal of its own ID, let's
                  // get rid of it if that is the case
                  if (m.id) {
                    const oldMsg: Types.Message = oldMessageMap.getIn([
                      conversationIDKey,
                      Types.numberToOrdinal(m.id),
                    ])
                    if (oldMsg && oldMsg.type === 'placeholder' && oldMsg.ordinal !== m.ordinal) {
                      removedOrdinals.push(oldMsg.ordinal)
                    }
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
                    logger.info(
                      `Skipping placeholder for message with id ${message.id} because already exists`
                    )
                  }
                } else {
                  arr.push(message.ordinal)
                }
                return arr
              }, [])

              map.update(conversationIDKey, I.OrderedSet(), (set: I.OrderedSet<Types.Ordinal>) =>
                // add new ones, remove deleted ones, sort
                set
                  .subtract(removedOrdinals)
                  .concat(ordinals)
                  .sort()
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

        const containsLatestMessageMap = draftState.containsLatestMessageMap.withMutations(map => {
          Object.keys(convoToMessages).forEach(cid => {
            const conversationIDKey = Types.stringToConversationIDKey(cid)
            if (!action.payload.forceContainsLatestCalc && map.get(conversationIDKey, false)) {
              return
            }
            const meta = draftState.metaMap.get(conversationIDKey, null)
            const ordinals = messageOrdinals.get(conversationIDKey, I.OrderedSet()).toArray()
            let maxMsgID = 0
            const convMsgMap = messageMap.get(conversationIDKey, I.Map<Types.Ordinal, Types.Message>())
            for (let i = ordinals.length - 1; i >= 0; i--) {
              const ordinal = ordinals[i]
              const message = convMsgMap.get(ordinal)
              if (message && message.id > 0) {
                maxMsgID = message.id
                break
              }
            }
            if (meta && maxMsgID >= meta.maxVisibleMsgID) {
              map.set(conversationIDKey, true)
            } else if (action.payload.forceContainsLatestCalc) {
              map.set(conversationIDKey, false)
            }
          })
        })

        let messageCenterOrdinals = draftState.messageCenterOrdinals
        let centeredMessageIDs = action.payload.centeredMessageIDs || []
        centeredMessageIDs.forEach(cm => {
          let ordinal = messageIDToOrdinal(
            draftState.messageMap,
            draftState.pendingOutboxToOrdinal,
            cm.conversationIDKey,
            cm.messageID
          )
          if (!ordinal) {
            ordinal = Types.numberToOrdinal(Types.messageIDToNumber(cm.messageID))
          }
          messageCenterOrdinals = messageCenterOrdinals.set(cm.conversationIDKey, {
            highlightMode: cm.highlightMode,
            ordinal,
          })
        })

        draftState.messageMap = messageMap
        if (centeredMessageIDs.length > 0) {
          draftState.messageCenterOrdinals = messageCenterOrdinals
        }
        draftState.containsLatestMessageMap = containsLatestMessageMap
        // only if different
        if (!draftState.messageOrdinals.equals(messageOrdinals)) {
          draftState.messageOrdinals = messageOrdinals
        }
        draftState.pendingOutboxToOrdinal = pendingOutboxToOrdinal
        return
      }
      case Chat2Gen.jumpToRecent:
        draftState.messageCenterOrdinals = draftState.messageCenterOrdinals.delete(
          action.payload.conversationIDKey
        )
        return
      case Chat2Gen.setContainsLastMessage:
        draftState.containsLatestMessageMap = draftState.containsLatestMessageMap.set(
          action.payload.conversationIDKey,
          action.payload.contains
        )
        return
      case Chat2Gen.messageRetry: {
        const {conversationIDKey, outboxID} = action.payload
        const ordinal = draftState.pendingOutboxToOrdinal.getIn([conversationIDKey, outboxID])
        if (!ordinal) {
          return
        }
        draftState.messageMap = draftState.messageMap.updateIn([conversationIDKey, ordinal], message => {
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
        return
      }
      case Chat2Gen.messageErrored: {
        const {conversationIDKey, outboxID, reason} = action.payload
        const ordinal = draftState.pendingOutboxToOrdinal.getIn([conversationIDKey, outboxID])
        if (!ordinal) {
          return
        }
        draftState.messageMap = draftState.messageMap.updateIn([conversationIDKey, ordinal], message => {
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
        return
      }
      case EngineGen.chat1ChatUiChatBotCommandsUpdateStatus:
        draftState.botCommandsUpdateStatusMap = draftState.botCommandsUpdateStatusMap.set(
          Types.stringToConversationIDKey(action.payload.params.convID),
          action.payload.params.status
        )
        return
      case EngineGen.chat1NotifyChatChatTypingUpdate: {
        const {typingUpdates} = action.payload.params
        const typingMap = I.Map(
          (typingUpdates || []).reduce<Array<[string, I.Set<string>]>>((arr, u) => {
            arr.push([Types.conversationIDToKey(u.convID), I.Set((u.typers || []).map(t => t.username))])
            return arr
          }, [])
        )
        draftState.typingMap = typingMap
        return
      }
      case Chat2Gen.toggleLocalReaction: {
        const {conversationIDKey, emoji, targetOrdinal, username} = action.payload
        draftState.messageMap = draftState.messageMap.update(
          conversationIDKey,
          I.Map(),
          (map: I.Map<Types.Ordinal, Types.Message>) => {
            return map.update(targetOrdinal, message => {
              if (!Constants.isDecoratedMessage(message)) {
                return message
              }
              const reactions = message.reactions
              // @ts-ignore thinks `message` is the inner type
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
          }
        )
        return
      }
      case Chat2Gen.updateReactions: {
        const {conversationIDKey, updates} = action.payload
        const targetData = updates.map(u => ({
          reactions: u.reactions,
          targetMsgID: u.targetMsgID,
          targetOrdinal: messageIDToOrdinal(
            draftState.messageMap,
            draftState.pendingOutboxToOrdinal,
            conversationIDKey,
            u.targetMsgID
          ),
        }))
        draftState.messageMap = draftState.messageMap.update(
          conversationIDKey,
          I.Map(),
          (map: I.Map<Types.Ordinal, Types.Message>) =>
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
                  // @ts-ignore thinks `message` is the inner type
                  return message.set('reactions', td.reactions)
                })
              })
            })
        )
        return
      }
      case Chat2Gen.messagesWereDeleted: {
        const {
          conversationIDKey,
          deletableMessageTypes = Constants.allMessageTypes,
          messageIDs = [],
          ordinals = [],
          upToMessageID = null,
        } = action.payload

        const upToOrdinals: Array<Types.Ordinal> = []
        if (upToMessageID) {
          const ordinalToMessage = draftState.messageMap.get(
            conversationIDKey,
            I.Map<Types.Ordinal, Types.Message>()
          )
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
              messageIDToOrdinal(
                draftState.messageMap,
                draftState.pendingOutboxToOrdinal,
                conversationIDKey,
                messageID
              )
            ),
            ...upToOrdinals,
          ].reduce<Array<Types.Ordinal>>((arr, n) => {
            if (n) {
              arr.push(n)
            }
            return arr
          }, [])
        )

        draftState.messageMap = draftState.messageMap.update(
          conversationIDKey,
          I.Map(),
          (map: I.Map<Types.Ordinal, Types.Message>) =>
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

        draftState.messageOrdinals = draftState.messageOrdinals.update(conversationIDKey, ordinals =>
          ordinals ? ordinals.subtract(allOrdinals) : ordinals
        )

        return
      }
      case Chat2Gen.updateMoreToLoad:
        draftState.moreToLoadMap = draftState.moreToLoadMap.set(
          action.payload.conversationIDKey,
          action.payload.moreToLoad
        )
        return
      case Chat2Gen.updateConvExplodingModes: {
        const {modes} = action.payload
        const explodingMap = modes.reduce((map, mode) => {
          map[Types.conversationIDKeyToString(mode.conversationIDKey)] = mode.seconds
          return map
        }, {})
        draftState.explodingModes = I.Map(explodingMap)
        return
      }
      case Chat2Gen.setExplodingModeLock: {
        const {conversationIDKey, unset} = action.payload
        const mode = draftState.explodingModes.get(conversationIDKey, 0)
        // we already have the new mode in `explodingModes`, if we've already locked it we shouldn't update
        const alreadyLocked = draftState.explodingModeLocks.get(conversationIDKey, null) !== null
        if (unset) {
          draftState.explodingModeLocks = draftState.explodingModeLocks.delete(conversationIDKey)
          return
        }
        if (!alreadyLocked) {
          draftState.explodingModeLocks = draftState.explodingModeLocks.set(conversationIDKey, mode)
        }
        return
      }
      case Chat2Gen.giphySend: {
        draftState.giphyWindowMap = draftState.giphyWindowMap.set(action.payload.conversationIDKey, false)
        draftState.unsentTextMap = draftState.unsentTextMap.set(
          action.payload.conversationIDKey,
          new HiddenString('')
        )
        return
      }
      case Chat2Gen.setUnsentText:
        draftState.unsentTextMap = draftState.unsentTextMap.set(
          action.payload.conversationIDKey,
          action.payload.text
        )
        return
      case Chat2Gen.setPrependText:
        draftState.prependTextMap = draftState.prependTextMap.set(
          action.payload.conversationIDKey,
          action.payload.text
        )
        return
      case Chat2Gen.toggleReplyToMessage: {
        const {conversationIDKey, ordinal} = action.payload
        if (ordinal) {
          draftState.replyToMap = draftState.replyToMap.set(conversationIDKey, ordinal)
          // we always put something in prepend to trigger the focus regain on the input bar
          draftState.prependTextMap = draftState.prependTextMap.set(conversationIDKey, new HiddenString(''))
          return
        } else {
          draftState.replyToMap = draftState.replyToMap.delete(conversationIDKey)
          return
        }
      }
      case Chat2Gen.replyJump:
        draftState.messageCenterOrdinals = draftState.messageCenterOrdinals.delete(
          action.payload.conversationIDKey
        )
        return
      case Chat2Gen.threadSearchResults:
        draftState.threadSearchInfoMap = draftState.threadSearchInfoMap.update(
          action.payload.conversationIDKey,
          info =>
            info.set(
              'hits',
              action.payload.clear
                ? I.List(action.payload.messages)
                : info.hits.concat(action.payload.messages)
            )
        )
        return
      case Chat2Gen.setThreadSearchStatus:
        draftState.threadSearchInfoMap = draftState.threadSearchInfoMap.update(
          action.payload.conversationIDKey,
          (info = Constants.makeThreadSearchInfo()) => info.set('status', action.payload.status)
        )
        return
      case Chat2Gen.toggleThreadSearch:
        draftState.threadSearchInfoMap = draftState.threadSearchInfoMap.update(
          action.payload.conversationIDKey,
          (old = Constants.makeThreadSearchInfo()) =>
            old.merge({
              hits: I.List(),
              status: 'initial',
              visible: !old.visible,
            })
        )

        draftState.messageCenterOrdinals = draftState.messageCenterOrdinals.delete(
          action.payload.conversationIDKey
        )
        return
      case Chat2Gen.threadSearch:
        draftState.threadSearchInfoMap = draftState.threadSearchInfoMap.update(
          action.payload.conversationIDKey,
          (info = Constants.makeThreadSearchInfo()) => info.set('hits', I.List())
        )
        return
      case Chat2Gen.setThreadSearchQuery:
        draftState.threadSearchQueryMap = draftState.threadSearchQueryMap.set(
          action.payload.conversationIDKey,
          action.payload.query
        )
        return
      case Chat2Gen.inboxSearchSetTextStatus:
        draftState.inboxSearch = (draftState.inboxSearch || Constants.makeInboxSearchInfo()).merge({
          textStatus: action.payload.status,
        })
        return
      case Chat2Gen.inboxSearchSetIndexPercent:
        if (!draftState.inboxSearch || draftState.inboxSearch.textStatus !== 'inprogress') {
          return
        }
        draftState.inboxSearch = (draftState.inboxSearch || Constants.makeInboxSearchInfo()).merge({
          indexPercent: action.payload.percent,
        })
        return
      case Chat2Gen.toggleInboxSearch: {
        if (action.payload.enabled && !draftState.inboxSearch) {
          draftState.inboxSearch = Constants.makeInboxSearchInfo()
        } else if (!action.payload.enabled && draftState.inboxSearch) {
          draftState.inboxSearch = null
        }
        return
      }
      case Chat2Gen.inboxSearchTextResult: {
        if (!draftState.inboxSearch || draftState.inboxSearch.textStatus !== 'inprogress') {
          return
        }
        if (!draftState.metaMap.get(action.payload.result.conversationIDKey)) {
          return
        }
        const old = draftState.inboxSearch || Constants.makeInboxSearchInfo()
        const textResults = old.textResults
          .filter(r => r.conversationIDKey !== action.payload.result.conversationIDKey)
          .push(action.payload.result)
          .sort((l: Types.InboxSearchTextHit, r: Types.InboxSearchTextHit) => r.time - l.time)
        draftState.inboxSearch = old.merge({textResults})
        return
      }
      case Chat2Gen.inboxSearchStarted:
        if (!draftState.inboxSearch) {
          return
        }
        draftState.inboxSearch = (draftState.inboxSearch || Constants.makeInboxSearchInfo()).merge({
          nameStatus: 'inprogress',
          selectedIndex: 0,
          textResults: I.List(),
          textStatus: 'inprogress',
        })
        return
      case Chat2Gen.inboxSearchNameResults: {
        if (!draftState.inboxSearch || draftState.inboxSearch.nameStatus !== 'inprogress') {
          return
        }
        const results = action.payload.results.reduce((l, r) => {
          if (draftState.metaMap.get(r.conversationIDKey)) {
            return l.push(r)
          }
          return l
        }, I.List())
        draftState.inboxSearch = (draftState.inboxSearch || Constants.makeInboxSearchInfo()).merge({
          nameResults: results,
          nameResultsUnread: action.payload.unread,
          nameStatus: 'success',
        })
        return
      }
      case Chat2Gen.inboxSearchMoveSelectedIndex: {
        if (!draftState.inboxSearch) {
          return
        }
        let selectedIndex = draftState.inboxSearch.selectedIndex
        const totalResults = draftState.inboxSearch.nameResults.size + draftState.inboxSearch.textResults.size
        if (action.payload.increment && selectedIndex < totalResults - 1) {
          selectedIndex++
        } else if (!action.payload.increment && selectedIndex > 0) {
          selectedIndex--
        }

        draftState.inboxSearch = (draftState.inboxSearch || Constants.makeInboxSearchInfo()).merge({
          selectedIndex,
        })
        return
      }
      case Chat2Gen.inboxSearchSelect:
        if (!draftState.inboxSearch || action.payload.selectedIndex == null) {
          return
        }
        draftState.inboxSearch = (draftState.inboxSearch || Constants.makeInboxSearchInfo()).merge({
          selectedIndex: action.payload.selectedIndex,
        })
        return
      case Chat2Gen.inboxSearch:
        if (!draftState.inboxSearch) {
          return
        }
        draftState.inboxSearch = (draftState.inboxSearch || Constants.makeInboxSearchInfo()).merge({
          query: action.payload.query,
        })
        return
      case Chat2Gen.loadAttachmentView:
        draftState.attachmentViewMap = draftState.attachmentViewMap.updateIn(
          [action.payload.conversationIDKey, action.payload.viewType],
          (info = Constants.initialAttachmentViewInfo) => info.merge({status: 'loading'})
        )
        return
      case Chat2Gen.addAttachmentViewMessage:
        draftState.attachmentViewMap = draftState.attachmentViewMap.updateIn(
          [action.payload.conversationIDKey, action.payload.viewType],
          (info = Constants.initialAttachmentViewInfo) =>
            info.merge({
              messages:
                info.messages.findIndex((item: any) => item.id === action.payload.message.id) < 0
                  ? info.messages.push(action.payload.message).sort((l: any, r: any) => r.id - l.id)
                  : info.messages,
            })
        )
        return
      case Chat2Gen.setAttachmentViewStatus:
        return state.updateIn(
          ['attachmentViewMap', action.payload.conversationIDKey, action.payload.viewType],
          (info = Constants.initialAttachmentViewInfo) => {
            return info.merge({
              last: action.payload.last,
              status: action.payload.status,
            })
          }
        )
      case Chat2Gen.clearAttachmentView:
        return state.deleteIn(['attachmentViewMap', action.payload.conversationIDKey])
      case Chat2Gen.staticConfigLoaded:
        return state.set('staticConfig', action.payload.staticConfig)
      case Chat2Gen.metasReceived: {
        return state.merge({
          inboxHasLoaded: action.payload.fromInboxRefresh ? true : state.inboxHasLoaded,
          messageMap: messageMapReducer(state.messageMap, action, state.pendingOutboxToOrdinal),
          messageOrdinals: messageOrdinalsReducer(state.messageOrdinals, action),
          metaMap: metaMapReducer(state.metaMap, action),
          trustedInboxHasLoaded: action.payload.initialTrustedLoad ? true : state.trustedInboxHasLoaded,
        })
      }
      case Chat2Gen.paymentInfoReceived: {
        const {conversationIDKey, messageID, paymentInfo} = action.payload
        let nextState = state.update('accountsInfoMap', old =>
          old.setIn([conversationIDKey, messageID], paymentInfo)
        )
        return nextState.update('paymentStatusMap', old => old.setIn([paymentInfo.paymentID], paymentInfo))
      }
      case Chat2Gen.setMaybeMentionInfo: {
        const {name, info} = action.payload
        return state.setIn(['maybeMentionMap', name], info)
      }
      case Chat2Gen.requestInfoReceived: {
        const {conversationIDKey, messageID, requestInfo} = action.payload
        return state.update('accountsInfoMap', old => old.setIn([conversationIDKey, messageID], requestInfo))
      }
      case Chat2Gen.attachmentFullscreenSelection: {
        const {autoPlay, message} = action.payload
        return state.set('attachmentFullscreenSelection', {autoPlay, message})
      }
      case Chat2Gen.handleSeeingWallets: // fallthrough
      case Chat2Gen.setWalletsOld:
        return state.isWalletsNew ? state.set('isWalletsNew', false) : state
      case Chat2Gen.attachmentLoading: {
        const {message} = action.payload
        let nextState = state
        if (
          state.attachmentFullscreenSelection &&
          state.attachmentFullscreenSelection.message.conversationIDKey === message.conversationIDKey &&
          state.attachmentFullscreenSelection.message.id === message.id &&
          message.type === 'attachment'
        ) {
          nextState = nextState.set('attachmentFullscreenSelection', {
            autoPlay: state.attachmentFullscreenSelection.autoPlay,
            message: message
              .set('transferState', 'downloading')
              .set('transferProgress', action.payload.ratio),
          })
        }
        nextState = nextState.updateIn(
          ['attachmentViewMap', action.payload.conversationIDKey, RPCChatTypes.GalleryItemTyp.doc],
          (info = Constants.initialAttachmentViewInfo) =>
            info.merge({
              messages: info.messages.update(
                info.messages.findIndex((item: any) => item.id === action.payload.message.id),
                (item: any) =>
                  item
                    ? item.set('transferState', 'downloading').set('transferProgress', action.payload.ratio)
                    : item
              ),
            })
        )
        return nextState.withMutations(s => {
          s.set('metaMap', metaMapReducer(state.metaMap, action))
          s.set('messageMap', messageMapReducer(state.messageMap, action, state.pendingOutboxToOrdinal))
          s.set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
        })
      }
      case Chat2Gen.attachmentDownloaded: {
        const {message} = action.payload
        let nextState = state
        if (
          !actionHasError(action) &&
          state.attachmentFullscreenSelection &&
          state.attachmentFullscreenSelection.message.conversationIDKey === message.conversationIDKey &&
          state.attachmentFullscreenSelection.message.id === message.id &&
          message.type === 'attachment'
        ) {
          nextState = nextState.set('attachmentFullscreenSelection', {
            autoPlay: state.attachmentFullscreenSelection.autoPlay,
            message: message.set('downloadPath', action.payload.path || null),
          })
        }
        nextState = nextState.updateIn(
          ['attachmentViewMap', message.conversationIDKey, RPCChatTypes.GalleryItemTyp.doc],
          (info = Constants.initialAttachmentViewInfo) =>
            info.merge({
              messages: info.messages.update(
                info.messages.findIndex((item: any) => item.id === message.id),
                (item: any) =>
                  item
                    ? item.merge({
                        // @ts-ignore we aren't checking for the errors!
                        downloadPath: action.payload.path,
                        fileURLCached: true,
                        transferProgress: 0,
                        transferState: null,
                      })
                    : item
              ),
            })
        )
        return nextState.withMutations(s => {
          s.set('metaMap', metaMapReducer(state.metaMap, action))
          s.set('messageMap', messageMapReducer(state.messageMap, action, state.pendingOutboxToOrdinal))
          s.set('messageOrdinals', messageOrdinalsReducer(state.messageOrdinals, action))
        })
      }
      case Chat2Gen.updateUserReacjis: {
        let {skinTone, topReacjis} = action.payload.userReacjis
        if (!topReacjis) {
          topReacjis = Constants.defaultTopReacjis
        }
        return state.merge({userReacjis: {skinTone, topReacjis}})
      }
      case Chat2Gen.dismissBottomBanner: {
        return state.setIn(['dismissedInviteBannersMap', action.payload.conversationIDKey], true)
      }
      // metaMap/messageMap/messageOrdinalsList only actions
      case Chat2Gen.messageDelete:
      case Chat2Gen.messageEdit:
      case Chat2Gen.messageWasEdited:
      case Chat2Gen.pendingMessageWasEdited:
      case Chat2Gen.messageAttachmentUploaded:
      case Chat2Gen.metaReceivedError:
      case Chat2Gen.metaRequestingTrusted:
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
      case TeamBuildingGen.fetchedUserRecs:
      case TeamBuildingGen.fetchUserRecs:
      case TeamBuildingGen.search:
      case TeamBuildingGen.selectRole:
      case TeamBuildingGen.labelsSeen:
      case TeamBuildingGen.changeSendNotification:
        return state.update('teamBuilding', teamBuilding =>
          teamBuildingReducer('chat2', teamBuilding, action)
        )

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
      case Chat2Gen.loadNewerMessagesDueToScroll:
      case Chat2Gen.markInitiallyLoadedThreadAsRead:
      case Chat2Gen.messageDeleteHistory:
      case Chat2Gen.messageReplyPrivately:
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
      case Chat2Gen.hideConversation:
      case Chat2Gen.unhideConversation:
      case Chat2Gen.previewConversation:
      case Chat2Gen.setConvExplodingMode:
      case Chat2Gen.toggleMessageReaction:
      case Chat2Gen.setMinWriterRole:
      case Chat2Gen.openChatFromWidget:
      case Chat2Gen.prepareFulfillRequestForm:
      case Chat2Gen.unfurlResolvePrompt:
      case Chat2Gen.unfurlRemove:
      case Chat2Gen.unsentTextChanged:
      case Chat2Gen.confirmScreenResponse:
      case Chat2Gen.toggleMessageCollapse:
      case Chat2Gen.toggleInfoPanel:
      case Chat2Gen.addUsersToChannel:
      case Chat2Gen.deselectConversation:
      case Chat2Gen.createConversation:
      case Chat2Gen.loadMessagesCentered:
      case Chat2Gen.tabSelected:
      case Chat2Gen.resolveMaybeMention:
      case Chat2Gen.pinMessage:
      case Chat2Gen.unpinMessage:
      case Chat2Gen.ignorePinnedMessage:
        return state
      default:
        ifTSCComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
        return state
    }
  })
