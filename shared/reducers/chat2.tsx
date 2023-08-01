import * as Chat2Gen from '../actions/chat2-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/chat2'
import * as TeamsConstants from '../constants/teams'
import * as Container from '../util/container'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/chat2'
import logger from '../logger'
import HiddenString from '../util/hidden-string'
import partition from 'lodash/partition'
import {mapGetEnsureValue} from '../util/map'
import sortedIndexOf from 'lodash/sortedIndexOf'

type EngineActions =
  | EngineGen.Chat1NotifyChatChatParticipantsInfoPayload
  | EngineGen.Chat1ChatUiChatBotCommandsUpdateStatusPayload
  | EngineGen.Chat1ChatUiChatInboxLayoutPayload
  | EngineGen.Chat1NotifyChatChatAttachmentDownloadCompletePayload
  | EngineGen.Chat1NotifyChatChatAttachmentDownloadProgressPayload

type Actions = Chat2Gen.Actions | EngineActions

const initialState: Types.State = Constants.makeState()

// Backend gives us messageIDs sometimes so we need to find our ordinal
const messageIDToOrdinal = (
  messageMap: Container.Draft<Types.State['messageMap']>,
  pendingOutboxToOrdinal: Constants.ConvoState['pendingOutboxToOrdinal'] | undefined,
  conversationIDKey: Types.ConversationIDKey,
  messageID: Types.MessageID
) => {
  // A message we didn't send in this session?
  const map = messageMap.get(conversationIDKey)
  let m = map?.get(Types.numberToOrdinal(messageID))
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

const paymentActions: Container.ActionHandler<Actions, Types.State> = {}

const attachmentActions: Container.ActionHandler<Actions, Types.State> = {
  [Chat2Gen.attachmentUploading]: (draftState, action) => {
    const {conversationIDKey, outboxID, ratio} = action.payload
    const {messageMap} = draftState
    const convMap = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    const ordinal = convMap.get(outboxID)
    if (ordinal) {
      const map = messageMap.get(conversationIDKey)
      const m = map?.get(ordinal)
      if (m?.type === 'attachment') {
        m.transferProgress = ratio
        m.transferState = 'uploading'
      }
    }
  },
  [Chat2Gen.attachmentUploaded]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState
    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'attachment') {
      m.transferProgress = 0
      m.transferState = undefined
    }
  },
  [Chat2Gen.attachmentMobileSave]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'attachment') {
      m.transferState = 'mobileSaving'
      m.transferErrMsg = undefined
    }
  },
  [Chat2Gen.attachmentMobileSaved]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState
    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'attachment') {
      m.transferState = undefined
      m.transferErrMsg = undefined
    }
  },
  [Chat2Gen.attachmentDownload]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState
    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'attachment') {
      m.transferState = 'downloading'
      m.transferErrMsg = undefined
    }
  },
  [Chat2Gen.messageAttachmentUploaded]: (draftState, action) => {
    const {conversationIDKey, message, placeholderID} = action.payload
    const {messageMap} = draftState
    const pendingOutboxToOrdinal = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    const ordinal = messageIDToOrdinal(
      draftState.messageMap,
      pendingOutboxToOrdinal,
      conversationIDKey,
      placeholderID
    )
    if (ordinal) {
      const map = mapGetEnsureValue(messageMap, conversationIDKey, new Map())
      const m = map.get(ordinal)
      map.set(ordinal, m ? Constants.upgradeMessage(m, message) : message)
      const subType = Constants.getMessageRenderType(message)
      Constants.getConvoState(conversationIDKey).dispatch.setMessageTypeMap(ordinal, subType)
    }
  },
  [EngineGen.chat1NotifyChatChatAttachmentDownloadComplete]: (draftState, action) => {
    const {convID, msgID} = action.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const pendingOutboxToOrdinal = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    const ordinal = messageIDToOrdinal(
      draftState.messageMap,
      pendingOutboxToOrdinal,
      conversationIDKey,
      msgID
    )
    if (!ordinal) {
      logger.info(
        `downloadComplete: no ordinal found: conversationIDKey: ${conversationIDKey} msgID: ${msgID}`
      )
      return
    }
    const message = draftState.messageMap.get(conversationIDKey)?.get(ordinal)
    if (!message) {
      logger.info(
        `downloadComplete: no message found: conversationIDKey: ${conversationIDKey} ordinal: ${ordinal}`
      )
      return
    }
    if (message?.type === 'attachment') {
      message.transferState = undefined
      message.transferProgress = 0
    }
  },
  [EngineGen.chat1NotifyChatChatAttachmentDownloadProgress]: (draftState, action) => {
    const {convID, msgID, bytesComplete, bytesTotal} = action.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const pendingOutboxToOrdinal = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    const ordinal = messageIDToOrdinal(
      draftState.messageMap,
      pendingOutboxToOrdinal,
      conversationIDKey,
      msgID
    )
    if (!ordinal) {
      logger.info(
        `downloadProgress: no ordinal found: conversationIDKey: ${conversationIDKey} msgID: ${msgID}`
      )
      return
    }
    const message = draftState.messageMap.get(conversationIDKey)?.get(ordinal)
    if (!message) {
      logger.info(
        `downloadProgress: no message found: conversationIDKey: ${conversationIDKey} ordinal: ${ordinal}`
      )
      return
    }
    const ratio = bytesComplete / bytesTotal
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    const m = map?.get(message.ordinal)
    if (m?.type === 'attachment') {
      m.transferProgress = ratio
      m.transferState = 'downloading'
      m.transferErrMsg = undefined
    }
  },
  [Chat2Gen.attachmentDownloaded]: (draftState, action) => {
    const {message, path, error} = action.payload
    const {conversationIDKey, ordinal} = message
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'attachment') {
      m.downloadPath = (!error && path) || ''
      m.transferProgress = 0
      m.transferState = undefined
      m.transferErrMsg = error ? error ?? 'Error downloading attachment' : undefined
      m.fileURLCached = true // assume we have this on the service now
    }
  },
}

const getConversationIDKeyMetasToLoad = (conversationIDKeys: Array<Types.ConversationIDKey>) =>
  conversationIDKeys.reduce((arr: Array<string>, id) => {
    if (id && Constants.isValidConversationIDKey(id)) {
      const trustedState = Constants.getConvoState(id).meta.trustedState
      if (trustedState !== 'requesting' && trustedState !== 'trusted') {
        arr.push(id)
      }
    }
    return arr
  }, [])
const reducer = Container.makeReducer<Actions, Types.State>(initialState, {
  [Chat2Gen.resetStore]: () => {
    return {...initialState}
  },
  [Chat2Gen.selectedConversation]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {metaMap} = draftState

    // blank out draft so we don't flash old data when switching convs
    const meta = metaMap.get(conversationIDKey)
    if (meta) {
      meta.draft = ''
    }
    Constants.getConvoState(conversationIDKey).dispatch.setThreadLoadStatus(
      RPCChatTypes.UIChatThreadStatusTyp.none
    )
    if (Constants.isValidConversationIDKey(conversationIDKey)) {
      // If navigating away from error conversation to a valid conv - clear
      // error msg.
      Constants.useState.getState().dispatch.resetConversationErrored()
    }
  },
  [Chat2Gen.messagesAdd]: (draftState, action) => {
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
    const oldMessageMap = new Map(draftState.messageMap)

    // so we can keep messages if they haven't mutated
    const previousMessageMap = new Map(draftState.messageMap)

    if (shouldClearOthers) {
      logger.info(`messagesAdd: clearing existing data`)
      oldPendingOutboxToOrdinal.clear()
      oldMessageMap.delete(conversationIDKey)
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

    const findExistingSentOrPending = (conversationIDKey: Types.ConversationIDKey, m: Types.Message) => {
      // something we sent
      if (m.outboxID) {
        // and we know about it
        const ordinal = oldPendingOutboxToOrdinal.get(m.outboxID)
        if (ordinal) {
          const map = oldMessageMap.get(conversationIDKey)
          return map?.get(ordinal)
        }
      }
      const pendingOrdinal = messageIDToOrdinal(
        oldMessageMap,
        oldPendingOutboxToOrdinal,
        conversationIDKey,
        m.id
      )
      if (pendingOrdinal) {
        const map = oldMessageMap.get(conversationIDKey)
        return map?.get(pendingOrdinal)
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
            `messagesAdd: skipping placeholder for message with id ${message.id} because already exists`
          )
        }
      } else {
        // Sendable so we might have an existing message
        const existing = findExistingSentOrPending(conversationIDKey, message)
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
          const map = oldMessageMap.get(conversationIDKey)
          const oldMsg = map?.get(Types.numberToOrdinal(lookupID))
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
    const map = messageMap.get(conversationIDKey)
    if (map) {
      deletedMessages.forEach(m => map.delete(m.ordinal))
      removedOrdinals.forEach(o => map.delete(o))
    }

    deletedMessages.forEach(m => {
      Constants.getConvoState(conversationIDKey).dispatch.setMessageTypeMap(m.ordinal, undefined)
    })
    removedOrdinals.forEach(o => {
      Constants.getConvoState(conversationIDKey).dispatch.setMessageTypeMap(o, undefined)
    })

    // update messages
    messages.forEach(message => {
      const oldSentOrPending = findExistingSentOrPending(conversationIDKey, message)
      let toSet: Types.Message | undefined
      if (oldSentOrPending) {
        toSet = Constants.upgradeMessage(oldSentOrPending, message)
        logger.info(`messagesAdd: upgrade message: ordinal: ${message.ordinal} id: ${message.id}`)
      } else {
        const map = previousMessageMap.get(conversationIDKey)
        toSet = Constants.mergeMessage(map?.get(message.ordinal), message)
      }
      const map = messageMap.get(conversationIDKey) || new Map<Types.Ordinal, Types.Message>()
      messageMap.set(conversationIDKey, map)
      map.set(toSet.ordinal, toSet)

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
      const meta = draftState.metaMap.get(conversationIDKey)
      const ordinals = Constants.getConvoState(conversationIDKey).messageOrdinals ?? []
      let maxMsgID = 0
      const convMsgMap = messageMap.get(conversationIDKey) || new Map<Types.Ordinal, Types.Message>()
      messageMap.set(conversationIDKey, convMsgMap)
      for (let i = ordinals.length - 1; i >= 0; i--) {
        const ordinal = ordinals[i]!
        const message = convMsgMap.get(ordinal)
        if (message && message.id > 0) {
          maxMsgID = message.id
          break
        }
      }
      if (meta && maxMsgID >= meta.maxVisibleMsgID) {
        containsLatestMessage = true
      } else if (action.payload.forceContainsLatestCalc) {
        containsLatestMessage = false
      }
    }
    Constants.getConvoState(conversationIDKey).dispatch.setContainsLatestMessage(containsLatestMessage)
    draftState.messageMap = messageMap
    Constants.getConvoState(conversationIDKey).dispatch.setPendingOutboxToOrdinal(pendingOutboxToOrdinal)
  },
  [Chat2Gen.messageRetry]: (draftState, action) => {
    const {conversationIDKey, outboxID} = action.payload
    const {messageMap} = draftState
    const outToOrd = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    const ordinal = outToOrd?.get(outboxID)
    if (!ordinal) {
      return
    }
    const m = messageMap.get(conversationIDKey)?.get(ordinal)
    if (!m) {
      return
    }
    m.errorReason = undefined
    m.submitState = 'pending'
  },
  [Chat2Gen.messageErrored]: (draftState, action) => {
    const {conversationIDKey, errorTyp, outboxID, reason} = action.payload
    const {messageMap} = draftState
    const outToOrd = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    const ordinal = outToOrd?.get(outboxID)
    if (!ordinal) {
      return
    }
    const m = messageMap.get(conversationIDKey)?.get(ordinal)
    if (!m) {
      return
    }
    m.errorReason = reason
    m.submitState = 'failed'
    m.errorTyp = errorTyp || undefined
  },
  [Chat2Gen.toggleLocalReaction]: (draftState, action) => {
    const {conversationIDKey, decorated, emoji, targetOrdinal, username} = action.payload
    const {messageMap} = draftState

    const m = messageMap.get(conversationIDKey)?.get(targetOrdinal)
    if (m && Constants.isMessageWithReactions(m)) {
      const reactions = m.reactions
      const rs = {
        decorated: reactions.get(emoji)?.decorated ?? decorated,
        users: reactions.get(emoji)?.users ?? new Set(),
      }
      reactions.set(emoji, rs)
      const existing = [...rs.users].find(r => r.username === username)
      if (existing) {
        // found an existing reaction. remove it from our list
        rs.users.delete(existing)
      }
      // no existing reaction. add this one to the map
      rs.users.add(Constants.makeReaction({timestamp: Date.now(), username}))
      if (rs.users.size === 0) {
        reactions.delete(emoji)
      }
    }
  },
  [Chat2Gen.updateReactions]: (draftState, action) => {
    const {conversationIDKey, updates} = action.payload
    const {messageMap} = draftState
    const pendingOutboxToOrdinal = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    const targetData = updates.map(u => ({
      reactions: u.reactions,
      targetMsgID: u.targetMsgID,
      targetOrdinal: messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, u.targetMsgID),
    }))

    const map = messageMap.get(conversationIDKey)
    if (map) {
      targetData.forEach(td => {
        if (!td.targetOrdinal) {
          logger.info(
            `updateReactions: couldn't find target ordinal for targetMsgID=${td.targetMsgID} in convID=${conversationIDKey}`
          )
          return
        }
        const m = map.get(td.targetOrdinal)
        if (m && m.type !== 'deleted' && m.type !== 'placeholder') {
          m.reactions = td.reactions
        }
      })
    }
  },
  [Chat2Gen.messagesWereDeleted]: (draftState, action) => {
    const {deletableMessageTypes = Constants.allMessageTypes, messageIDs = [], ordinals = []} = action.payload
    const {conversationIDKey, upToMessageID = null} = action.payload
    const {messageMap} = draftState

    const upToOrdinals: Array<Types.Ordinal> = []
    if (upToMessageID) {
      const ordinalToMessage = messageMap.get(conversationIDKey)
      ordinalToMessage &&
        [...ordinalToMessage.entries()].reduce((arr, [ordinal, m]) => {
          if (m.id < upToMessageID && deletableMessageTypes.has(m.type)) {
            arr.push(ordinal)
          }
          return arr
        }, upToOrdinals)
    }

    const pendingOutboxToOrdinal = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    const allOrdinals = new Set(
      [
        ...ordinals,
        ...messageIDs.map(messageID =>
          messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, messageID)
        ),
        ...upToOrdinals,
      ].reduce<Array<Types.Ordinal>>((arr, n) => {
        if (n) {
          arr.push(n)
        }
        return arr
      }, [])
    )

    const map = messageMap.get(conversationIDKey) || new Map<Types.Ordinal, Types.Message>()
    messageMap.set(conversationIDKey, map)

    allOrdinals.forEach(ordinal => {
      const m = map.get(ordinal)
      if (m) {
        map.set(
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

    const os = Constants.getConvoState(conversationIDKey).messageOrdinals
    if (os) {
      allOrdinals.forEach(o => {
        const idx = sortedIndexOf(os, o)
        if (idx !== -1) os.splice(idx, 1)
      })
    }
  },
  [Chat2Gen.metasReceived]: (draftState, action) => {
    const {metas, removals} = action.payload
    const {metaMap} = draftState
    removals && removals.forEach(m => metaMap.delete(m))
    metas.forEach(m => {
      const old = metaMap.get(m.conversationIDKey)
      metaMap.set(m.conversationIDKey, old ? Constants.updateMeta(old, m) : m)
    })
  },
  [Chat2Gen.messageDelete]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'text') {
      m.submitState = 'deleting'
    }
  },
  [Chat2Gen.messageEdit]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState

    const m = messageMap.get(conversationIDKey)?.get(ordinal)
    if (m?.type === 'text' || m?.type === 'attachment') {
      m.submitState = 'editing'
    }
  },
  [Chat2Gen.messageWasEdited]: (draftState, action) => {
    const {conversationIDKey, messageID, text} = action.payload
    const {mentionsAt, mentionsChannel, mentionsChannelName} = action.payload
    const {messageMap} = draftState
    const pendingOutboxToOrdinal = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal

    const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, messageID)
    if (ordinal) {
      const m = messageMap.get(conversationIDKey)?.get(ordinal)
      if (m?.type === 'text' || m?.type === 'attachment') {
        if (m.type === 'text') {
          m.text = text
        } else if (m.type === 'attachment') {
          m.title = text.stringValue()
        }
        m.hasBeenEdited = true
        m.submitState = undefined
        m.mentionsAt = mentionsAt
        m.mentionsChannel = mentionsChannel
        m.mentionsChannelName = mentionsChannelName
      }
    }
  },
  [Chat2Gen.pendingMessageWasEdited]: (draftState, action) => {
    const {conversationIDKey, ordinal, text} = action.payload
    const {messageMap} = draftState

    const m = messageMap.get(conversationIDKey)?.get(ordinal)
    if (m?.type === 'text') {
      m.text = text
    } else if (m?.type === 'attachment') {
      m.title = text.stringValue()
    }
  },
  [Chat2Gen.metaReceivedError]: (draftState, action) => {
    const {error, username, conversationIDKey} = action.payload
    if (error) {
      if (
        error.typ === RPCChatTypes.ConversationErrorType.otherrekeyneeded ||
        error.typ === RPCChatTypes.ConversationErrorType.selfrekeyneeded
      ) {
        const {rekeyInfo} = error
        const participants = [
          ...(rekeyInfo
            ? new Set<string>(
                ([] as Array<string>)
                  .concat(rekeyInfo.writerNames || [], rekeyInfo.readerNames || [])
                  .filter(Boolean)
              )
            : new Set<string>(error.unverifiedTLFName.split(','))),
        ]

        const rekeyers = new Set<string>(
          error.typ === RPCChatTypes.ConversationErrorType.selfrekeyneeded
            ? [username || '']
            : (rekeyInfo && rekeyInfo.rekeyers) || []
        )
        const newMeta = Constants.unverifiedInboxUIItemToConversationMeta(error.remoteConv)
        if (!newMeta) {
          // public conversation, do nothing
          return
        }
        draftState.metaMap.set(conversationIDKey, {
          ...newMeta,
          rekeyers,
          snippet: error.message,
          snippetDecoration: RPCChatTypes.SnippetDecoration.none,
          trustedState: 'error' as const,
        })
        Constants.getConvoState(conversationIDKey).dispatch.setParticipants({
          all: participants,
          contactName: Constants.noParticipantInfo.contactName,
          name: participants,
        })
      } else {
        const old = draftState.metaMap.get(conversationIDKey)
        if (old) {
          old.snippet = error.message
          old.snippetDecoration = RPCChatTypes.SnippetDecoration.none
          old.trustedState = 'error'
        }
      }
    } else {
      draftState.metaMap.delete(conversationIDKey)
    }
  },
  [Chat2Gen.metaRequestingTrusted]: (draftState, action) => {
    // TODO
    const {conversationIDKeys} = action.payload
    const ids = getConversationIDKeyMetasToLoad(conversationIDKeys)
    ids.forEach(conversationIDKey => {
      const old = metaMap.get(conversationIDKey)
      if (old) {
        old.trustedState = 'requesting'
      }
    })
  },
  [Chat2Gen.markConversationsStale]: (draftState, action) => {
    const {updateType, conversationIDKeys} = action.payload
    if (updateType === RPCChatTypes.StaleUpdateType.clear) {
      conversationIDKeys.forEach(convID => draftState.messageMap.delete(convID))
      conversationIDKeys.forEach(convID => Constants.getConvoState(convID).dispatch.setMessageOrdinals())
    }
  },
  [Chat2Gen.notificationSettingsUpdated]: (draftState, action) => {
    const {conversationIDKey, settings} = action.payload
    const {metaMap} = draftState
    const old = metaMap.get(conversationIDKey)
    old && metaMap.set(conversationIDKey, Constants.updateMetaWithNotificationSettings(old, settings))
  },
  [Chat2Gen.metaDelete]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    draftState.metaMap.delete(conversationIDKey)
  },
  [Chat2Gen.setConversationOffline]: (draftState, action) => {
    const {conversationIDKey, offline} = action.payload
    const old = draftState.metaMap.get(conversationIDKey)
    if (old) {
      old.offline = offline
    }
  },
  [Chat2Gen.updateConvRetentionPolicy]: (draftState, action) => {
    const {meta} = action.payload
    const {metaMap} = draftState
    const newMeta = meta
    if (metaMap.has(meta.conversationIDKey)) {
      // only insert if the convo is already in the inbox
      metaMap.set(newMeta.conversationIDKey, newMeta)
    }
  },
  [Chat2Gen.updateTeamRetentionPolicy]: (draftState, action) => {
    const {metas} = action.payload
    const {metaMap} = draftState
    metas.forEach(meta => {
      if (meta && metaMap.has(meta.conversationIDKey)) {
        // only insert if the convo is already in the inbox
        metaMap.set(meta.conversationIDKey, meta)
      }
    })
    TeamsConstants.useState.getState().dispatch.updateTeamRetentionPolicy(metas)
  },
  [Chat2Gen.messagesExploded]: (draftState, action) => {
    const {conversationIDKey, messageIDs, explodedBy} = action.payload
    const {messageMap} = draftState
    const pendingOutboxToOrdinal = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    logger.info(`messagesExploded: exploding ${messageIDs.length} messages`)
    const ordinals = messageIDs.reduce<Array<Types.Ordinal>>((arr, mid) => {
      const ord = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, mid)
      ord && arr.push(ord)
      return arr
    }, [])
    if (ordinals.length === 0) {
      // found nothing
      return
    }
    const map = messageMap.get(conversationIDKey)
    map &&
      ordinals.forEach(ordinal => {
        const m: any = map.get(ordinal) // TODO fix types
        m.exploded = true
        m.explodedBy = explodedBy || ''
        m.text = new HiddenString('')
        m.mentionsAt = new Set()
        m.reactions = new Map()
        m.unfurls = new Map()
        m.flipGameID = ''
      })
  },
  [Chat2Gen.saveMinWriterRole]: (draftState, action) => {
    const {cannotWrite, conversationIDKey, role} = action.payload
    const old = draftState.metaMap.get(conversationIDKey)
    if (old) {
      old.cannotWrite = cannotWrite
      old.minWriterRole = role
    }
  },
  [Chat2Gen.updateMessages]: (draftState, action) => {
    const {messages, conversationIDKey} = action.payload
    const {messageMap} = draftState
    const pendingOutboxToOrdinal = Constants.getConvoState(conversationIDKey).pendingOutboxToOrdinal
    messages.forEach(({messageID, message}) => {
      const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, conversationIDKey, messageID)
      if (!ordinal) {
        return
      }
      const map = messageMap.get(conversationIDKey)
      if (!map) {
        return
      }

      let m = message
      if (m.ordinal !== ordinal) {
        m = {...message, ordinal}
      }
      map.set(ordinal, m)
    })
  },
  [Chat2Gen.clearMessages]: draftState => {
    draftState.messageMap.clear()
    for (const [, cs] of Constants.stores) {
      cs.getState().dispatch.setMessageOrdinals()
    }
  },
  [Chat2Gen.clearMetas]: draftState => {
    draftState.metaMap.clear()
  },
  ...paymentActions,
  ...attachmentActions,
})

export default reducer
