import * as Chat2Gen from '../actions/chat2-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/chat2'
import logger from '../logger'
import HiddenString from '../util/hidden-string'
import partition from 'lodash/partition'
import sortedIndexOf from 'lodash/sortedIndexOf'

type EngineActions =
  | EngineGen.Chat1NotifyChatChatParticipantsInfoPayload
  | EngineGen.Chat1ChatUiChatBotCommandsUpdateStatusPayload
  | EngineGen.Chat1ChatUiChatInboxLayoutPayload
  | EngineGen.Chat1NotifyChatChatAttachmentDownloadCompletePayload
  | EngineGen.Chat1NotifyChatChatAttachmentDownloadProgressPayload

type Actions = Chat2Gen.Actions | EngineActions

// Backend gives us messageIDs sometimes so we need to find our ordinal
const messageIDToOrdinal = (
  map: Constants.ConvoState['messageMap'],
  pendingOutboxToOrdinal: Constants.ConvoState['pendingOutboxToOrdinal'] | undefined,
  messageID: Types.MessageID
) => {
  // A message we didn't send in this session?
  let m = map.get(Types.numberToOrdinal(messageID))
  if (m?.id !== 0 && m?.id === messageID) {
    return m.ordinal
  }
  // Search through our sent messages
  const pendingOrdinal = [...(pendingOutboxToOrdinal?.values() ?? [])].find(o => {
    m = map?.get(o)
    if (m?.id !== 0 && m?.id === messageID) {
      return true
    }
    return false
  })

  if (pendingOrdinal) {
    return pendingOrdinal
  }

  return null
}

const attachmentActions: Container.ActionHandler<Actions, {}> = {
  [Chat2Gen.attachmentMobileSave]: (_, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
    const m = messageMap.get(ordinal)
    if (m?.type === 'attachment') {
      dispatch.updateMessage(ordinal, {
        transferErrMsg: undefined,
        transferState: 'mobileSaving',
      })
    }
  },
  [Chat2Gen.attachmentMobileSaved]: (_, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
    const m = messageMap.get(ordinal)
    if (m?.type === 'attachment') {
      dispatch.updateMessage(ordinal, {
        transferErrMsg: undefined,
        transferState: undefined,
      })
    }
  },
  [Chat2Gen.attachmentDownload]: (_, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
    const m = messageMap.get(ordinal)
    if (m?.type === 'attachment') {
      dispatch.updateMessage(ordinal, {
        transferErrMsg: undefined,
        transferState: 'downloading',
      })
    }
  },
  [Chat2Gen.messageAttachmentUploaded]: (_, action) => {
    const {conversationIDKey, message, placeholderID} = action.payload
    const {pendingOutboxToOrdinal, dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
    const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, placeholderID)
    if (ordinal) {
      const m = messageMap.get(ordinal)
      dispatch.updateMessage(ordinal, m ? Constants.upgradeMessage(m, message) : message)
      const subType = Constants.getMessageRenderType(message)
      Constants.getConvoState(conversationIDKey).dispatch.setMessageTypeMap(ordinal, subType)
    }
  },
  [EngineGen.chat1NotifyChatChatAttachmentDownloadComplete]: (_, action) => {
    const {convID, msgID} = action.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const {pendingOutboxToOrdinal, dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
    const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, msgID)
    if (!ordinal) {
      logger.info(
        `downloadComplete: no ordinal found: conversationIDKey: ${conversationIDKey} msgID: ${msgID}`
      )
      return
    }
    const message = messageMap.get(ordinal)
    if (!message) {
      logger.info(
        `downloadComplete: no message found: conversationIDKey: ${conversationIDKey} ordinal: ${ordinal}`
      )
      return
    }
    if (message?.type === 'attachment') {
      dispatch.updateMessage(ordinal, {
        transferProgress: 0,
        transferState: undefined,
      })
    }
  },
  [EngineGen.chat1NotifyChatChatAttachmentDownloadProgress]: (_, action) => {
    const {convID, msgID, bytesComplete, bytesTotal} = action.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const {pendingOutboxToOrdinal, dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
    const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, msgID)
    if (!ordinal) {
      logger.info(
        `downloadProgress: no ordinal found: conversationIDKey: ${conversationIDKey} msgID: ${msgID}`
      )
      return
    }
    const message = messageMap.get(ordinal)
    if (!message) {
      logger.info(
        `downloadProgress: no message found: conversationIDKey: ${conversationIDKey} ordinal: ${ordinal}`
      )
      return
    }
    const ratio = bytesComplete / bytesTotal

    const m = messageMap.get(message.ordinal)
    if (m?.type === 'attachment') {
      dispatch.updateMessage(ordinal, {
        transferErrMsg: undefined,
        transferProgress: ratio,
        transferState: 'downloading',
      })
    }
  },
  [Chat2Gen.attachmentDownloaded]: (_, action) => {
    const {message, path, error} = action.payload
    const {conversationIDKey, ordinal} = message
    const {dispatch, messageMap} = Constants.getConvoState(conversationIDKey)

    const m = messageMap.get(ordinal)
    if (m?.type === 'attachment') {
      dispatch.updateMessage(ordinal, {
        downloadPath: (!error && path) || '',
        fileURLCached: true, // assume we have this on the service now
        transferErrMsg: error ?? 'Error downloading attachment',
        transferProgress: 0,
        transferState: undefined,
      })
    }
  },
}

const reducer = Container.makeReducer<Actions, {}>(
  {},
  {
    [Chat2Gen.resetStore]: () => {
      return {}
    },
    [Chat2Gen.messagesAdd]: (_, action) => {
      const {context, conversationIDKey, shouldClearOthers} = action.payload
      // pull out deletes and handle at the end
      const [messages, deletedMessages] = partition<Types.Message>(
        action.payload.messages,
        m => m.type !== 'deleted'
      )
      logger.info(
        `messagesAdd: running in context: ${context.type} messages: ${messages.length} deleted: ${deletedMessages.length}`
      )
      // we want the clear applied when we call findExisting
      const oldPendingOutboxToOrdinal = new Map(
        Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
      )
      const oldMessageMap = new Map(Constants.getConvoState(conversationIDKey).messageMap)

      // so we can keep messages if they haven't mutated
      const previousMessageMap = new Map(Constants.getConvoState(conversationIDKey).messageMap)

      if (shouldClearOthers) {
        logger.info(`messagesAdd: clearing existing data`)
        oldPendingOutboxToOrdinal.clear()
        oldMessageMap.clear()
        Constants.getConvoState(conversationIDKey).dispatch.clearMessageTypeMap()
        Constants.getConvoState(conversationIDKey).dispatch.setMessageOrdinals(undefined)
      }

      // Update any pending messages
      const pendingOutboxToOrdinal = new Map(oldPendingOutboxToOrdinal)
      messages.forEach(message => {
        if (message.submitState === 'pending' && message.outboxID) {
          logger.info(
            `messagesAdd: setting new outbox ordinal: ${message.ordinal} outboxID: ${message.outboxID}`
          )
          pendingOutboxToOrdinal.set(message.outboxID, message.ordinal)
        }
      })

      const findExistingSentOrPending = (m: Types.Message) => {
        // something we sent
        if (m.outboxID) {
          // and we know about it
          const ordinal = oldPendingOutboxToOrdinal.get(m.outboxID)
          if (ordinal) {
            return oldMessageMap.get(ordinal)
          }
        }
        const pendingOrdinal = messageIDToOrdinal(oldMessageMap, oldPendingOutboxToOrdinal, m.id)
        if (pendingOrdinal) {
          return oldMessageMap.get(pendingOrdinal)
        }
        return null
      }

      // remove all deleted messages from ordinals that we are passed as a parameter
      const os =
        Constants.getConvoState(conversationIDKey).messageOrdinals?.reduce((arr, o) => {
          if (deletedMessages.find(m => m.ordinal === o)) {
            return arr
          }
          arr.push(o)
          return arr
        }, new Array<Types.Ordinal>()) ?? []

      Constants.getConvoState(conversationIDKey).dispatch.setMessageOrdinals(os)

      const removedOrdinals: Array<Types.Ordinal> = []
      const ordinals = messages.reduce<Array<Types.Ordinal>>((arr, message) => {
        if (message.type === 'placeholder') {
          // sometimes we send then get a placeholder for that send. Lets see if we already have the message id for the sent
          // and ignore the placeholder in that instance
          logger.info(`messagesAdd: got placeholder message with id: ${message.id}`)
          const existingOrdinal = messageIDToOrdinal(oldMessageMap, pendingOutboxToOrdinal, message.id)
          if (!existingOrdinal) {
            arr.push(message.ordinal)
          } else {
            logger.info(
              `messagesAdd: skipping placeholder for message with id ${message.id} because already exists`
            )
          }
        } else {
          // Sendable so we might have an existing message
          const existing = findExistingSentOrPending(message)
          if (
            !existing ||
            sortedIndexOf(
              Constants.getConvoState(conversationIDKey).messageOrdinals ?? [],
              existing.ordinal
            ) === -1
          ) {
            arr.push(message.ordinal)
          } else {
            logger.info(
              `messagesAdd: skipping existing message for ordinal add: ordinal: ${message.ordinal} outboxID: ${message.outboxID}`
            )
          }
          // We might have a placeholder for this message in there with ordinal of its own ID, let's
          // get rid of it if that is the case
          const lookupID = message.id || existing?.id
          if (lookupID) {
            const oldMsg = oldMessageMap.get(Types.numberToOrdinal(lookupID))
            if (
              oldMsg?.type === 'placeholder' &&
              // don't delete the placeholder if we're just about to replace it ourselves
              oldMsg.ordinal !== message.ordinal
            ) {
              logger.info(`messagesAdd: removing old placeholder: ${oldMsg.ordinal}`)
              removedOrdinals.push(oldMsg.ordinal)
            }
          }
        }
        return arr
      }, [])

      // add new ones, remove deleted ones, sort. This pass is for when we remove placeholder messages
      // with their resolved ids
      // need to convert to a set and back due to needing to dedupe, could look into why this is necessary
      const oss =
        Constants.getConvoState(conversationIDKey).messageOrdinals?.reduce((s, o) => {
          if (removedOrdinals.includes(o)) {
            return s
          }
          s.add(o)
          return s
        }, new Set(ordinals)) ?? new Set(ordinals)
      Constants.getConvoState(conversationIDKey).dispatch.setMessageOrdinals([...oss].sort((a, b) => a - b))

      // clear out message map of deleted stuff
      const messageMap = new Map(oldMessageMap)
      deletedMessages.forEach(m => messageMap.delete(m.ordinal))
      removedOrdinals.forEach(o => messageMap.delete(o))

      deletedMessages.forEach(m => {
        Constants.getConvoState(conversationIDKey).dispatch.setMessageTypeMap(m.ordinal, undefined)
      })
      removedOrdinals.forEach(o => {
        Constants.getConvoState(conversationIDKey).dispatch.setMessageTypeMap(o, undefined)
      })

      // update messages
      messages.forEach(message => {
        const oldSentOrPending = findExistingSentOrPending(message)
        let toSet: Types.Message | undefined
        if (oldSentOrPending) {
          toSet = Constants.upgradeMessage(oldSentOrPending, message)
          logger.info(`messagesAdd: upgrade message: ordinal: ${message.ordinal} id: ${message.id}`)
        } else {
          toSet = Constants.mergeMessage(previousMessageMap.get(message.ordinal), message)
        }
        messageMap.set(toSet.ordinal, toSet)

        if (toSet.type === 'text') {
          Constants.getConvoState(conversationIDKey).dispatch.setMessageTypeMap(toSet.ordinal, undefined)
        } else {
          const subType = Constants.getMessageRenderType(toSet)
          Constants.getConvoState(conversationIDKey).dispatch.setMessageTypeMap(toSet.ordinal, subType)
        }
      })

      let containsLatestMessage = Constants.getConvoState(conversationIDKey).containsLatestMessage || false
      if (!action.payload.forceContainsLatestCalc && containsLatestMessage) {
        // do nothing
      } else {
        const meta = Constants.getConvoState(conversationIDKey).meta
        const ordinals = Constants.getConvoState(conversationIDKey).messageOrdinals ?? []
        let maxMsgID = 0
        for (let i = ordinals.length - 1; i >= 0; i--) {
          const ordinal = ordinals[i]!
          const message = messageMap.get(ordinal)
          if (message && message.id > 0) {
            maxMsgID = message.id
            break
          }
        }
        if (meta.conversationIDKey === conversationIDKey && maxMsgID >= meta.maxVisibleMsgID) {
          containsLatestMessage = true
        } else if (action.payload.forceContainsLatestCalc) {
          containsLatestMessage = false
        }
      }
      const {dispatch} = Constants.getConvoState(conversationIDKey)
      dispatch.setContainsLatestMessage(containsLatestMessage)
      dispatch.replaceMessageMap(messageMap)
      dispatch.setPendingOutboxToOrdinal(pendingOutboxToOrdinal)
    },
    [Chat2Gen.messagesWereDeleted]: (_, action) => {
      const {
        deletableMessageTypes = Constants.allMessageTypes,
        messageIDs = [],
        ordinals = [],
      } = action.payload
      const {conversationIDKey, upToMessageID = null} = action.payload
      const {pendingOutboxToOrdinal, dispatch, messageMap} = Constants.getConvoState(conversationIDKey)

      const upToOrdinals: Array<Types.Ordinal> = []
      if (upToMessageID) {
        ;[...messageMap.entries()].reduce((arr, [ordinal, m]) => {
          if (m.id < upToMessageID && deletableMessageTypes.has(m.type)) {
            arr.push(ordinal)
          }
          return arr
        }, upToOrdinals)
      }

      const allOrdinals = new Set(
        [
          ...ordinals,
          ...messageIDs.map(messageID => messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, messageID)),
          ...upToOrdinals,
        ].reduce<Array<Types.Ordinal>>((arr, n) => {
          if (n) {
            arr.push(n)
          }
          return arr
        }, [])
      )

      allOrdinals.forEach(ordinal => {
        const m = messageMap.get(ordinal)
        if (m) {
          dispatch.updateMessage(
            ordinal,
            Constants.makeMessageDeleted({
              author: m.author,
              conversationIDKey: m.conversationIDKey,
              id: m.id,
              ordinal: m.ordinal,
              timestamp: m.timestamp,
            })
          )
        }
      })
    },
    [Chat2Gen.messageDelete]: (_, action) => {
      const {conversationIDKey, ordinal} = action.payload
      const {dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
      const m = messageMap.get(ordinal)
      if (m?.type === 'text') {
        dispatch.updateMessage(ordinal, {
          submitState: 'deleting',
        })
      }
    },
    [Chat2Gen.messageEdit]: (_, action) => {
      const {conversationIDKey, ordinal} = action.payload
      const {dispatch, messageMap} = Constants.getConvoState(conversationIDKey)

      const m = messageMap.get(ordinal)
      if (m?.type === 'text' || m?.type === 'attachment') {
        dispatch.updateMessage(ordinal, {
          submitState: 'editing',
        })
      }
    },
    [Chat2Gen.messageWasEdited]: (_, action) => {
      const {conversationIDKey, messageID, text} = action.payload
      const {mentionsAt, mentionsChannel, mentionsChannelName} = action.payload
      const {pendingOutboxToOrdinal, dispatch, messageMap} = Constants.getConvoState(conversationIDKey)

      const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, messageID)
      if (ordinal) {
        const m = messageMap.get(ordinal)
        if (m?.type === 'text' || m?.type === 'attachment') {
          dispatch.updateMessage(ordinal, {
            ...(m.type === 'text' ? {text} : {}),
            ...(m.type === 'attachment' ? {title: text.stringValue()} : {}),
            hasBeenEdited: true,
            mentionsAt: mentionsAt,
            mentionsChannel: mentionsChannel,
            mentionsChannelName: mentionsChannelName,
            submitState: undefined,
          })
        }
      }
    },
    [Chat2Gen.pendingMessageWasEdited]: (_, action) => {
      const {conversationIDKey, ordinal, text} = action.payload
      const {dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
      const m = messageMap.get(ordinal)
      if (m) {
        dispatch.updateMessage(ordinal, {
          ...(m.type === 'text' ? {text} : {}),
          ...(m.type === 'attachment' ? {title: text.stringValue()} : {}),
        })
      }
    },
    [Chat2Gen.markConversationsStale]: (_, action) => {
      const {updateType, conversationIDKeys} = action.payload
      if (updateType === RPCChatTypes.StaleUpdateType.clear) {
        conversationIDKeys.forEach(convID =>
          Constants.getConvoState(convID).dispatch.replaceMessageMap(new Map())
        )
        conversationIDKeys.forEach(convID => Constants.getConvoState(convID).dispatch.setMessageOrdinals())
      }
    },
    [Chat2Gen.notificationSettingsUpdated]: (_draftState, action) => {
      const {conversationIDKey, settings} = action.payload
      const cs = Constants.getConvoState(conversationIDKey)
      if (cs.meta.conversationIDKey === conversationIDKey) {
        const {notificationsDesktop, notificationsGlobalIgnoreMentions, notificationsMobile} =
          Constants.parseNotificationSettings(settings)
        cs.dispatch.updateMeta({
          notificationsDesktop: notificationsDesktop,
          notificationsGlobalIgnoreMentions: notificationsGlobalIgnoreMentions,
          notificationsMobile: notificationsMobile,
        })
      }
    },
    [Chat2Gen.setConversationOffline]: (_draftState, action) => {
      const {conversationIDKey, offline} = action.payload
      const cs = Constants.getConvoState(conversationIDKey)
      if (cs.meta.conversationIDKey === conversationIDKey) {
        cs.dispatch.updateMeta({
          offline,
        })
      }
    },
    [Chat2Gen.messagesExploded]: (_, action) => {
      const {conversationIDKey, messageIDs, explodedBy} = action.payload
      const {pendingOutboxToOrdinal, dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
      logger.info(`messagesExploded: exploding ${messageIDs.length} messages`)
      const ordinals = messageIDs.reduce<Array<Types.Ordinal>>((arr, mid) => {
        const ord = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, mid)
        ord && arr.push(ord)
        return arr
      }, [])
      if (ordinals.length === 0) {
        // found nothing
        return
      }
      ordinals.forEach(ordinal => {
        const m = messageMap.get(ordinal)
        if (m) {
          dispatch.updateMessage(ordinal, {
            exploded: true,
            explodedBy: explodedBy || '',
            flipGameID: '',
            mentionsAt: new Set(),
            reactions: new Map(),
            text: new HiddenString(''),
            unfurls: new Map(),
          })
        }
      })
    },
    [Chat2Gen.clearMessages]: () => {
      for (const [, cs] of Constants.stores) {
        cs.getState().dispatch.setMessageOrdinals()
        cs.getState().dispatch.replaceMessageMap(new Map())
      }
    },
    ...attachmentActions,
  }
)

export default reducer
