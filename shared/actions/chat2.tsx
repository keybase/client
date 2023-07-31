import * as Z from '../util/zustand'
import * as Chat2Gen from './chat2-gen'
import * as ConfigConstants from '../constants/config'
import * as RouterConstants from '../constants/router2'
import * as UsersConstants from '../constants/users'
import * as LinksConstants from '../constants/deeplinks'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as FsConstants from '../constants/fs'
import * as FsTypes from '../constants/types/fs'
import * as Platform from '../constants/platform'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from './../constants/types/rpc-gen'
import * as Styles from '../styles'
import * as Tabs from '../constants/tabs'
import * as TeamsConstants from '../constants/teams'
import * as TeamsTypes from '../constants/types/teams'
import * as Types from '../constants/types/chat2'
import * as WaitingConstants from '../constants/waiting'
import {findLast} from '../util/arrays'
import KB2 from '../util/electron'
import NotifyPopup from '../util/notify-popup'
import logger from '../logger'
import {RPCError} from '../util/errors'
import {isIOS} from '../constants/platform'
import {saveAttachmentToCameraRoll, showShareActionSheet} from './platform-specific'

const {darwinCopyToChatTempUploadFile} = KB2.functions

const onGetInboxUnverifiedConvs = (_: unknown, action: EngineGen.Chat1ChatUiChatInboxUnverifiedPayload) => {
  const {inbox} = action.payload.params
  const result = JSON.parse(inbox) as RPCChatTypes.UnverifiedInboxUIItems
  const items: Array<RPCChatTypes.UnverifiedInboxUIItem> = result.items ?? []
  // We get a subset of meta information from the cache even in the untrusted payload
  const metas = items.reduce<Array<Types.ConversationMeta>>((arr, item) => {
    const m = Constants.unverifiedInboxUIItemToConversationMeta(item)
    m && arr.push(m)
    return arr
  }, [])
  Constants.useState.getState().dispatch.setTrustedInboxHasLoaded()
  // Check if some of our existing stored metas might no longer be valid
  return Chat2Gen.createMetasReceived({fromInboxRefresh: true, metas})
}

// Only get the untrusted conversations out
const untrustedConversationIDKeys = (state: Container.TypedState, ids: Array<Types.ConversationIDKey>) =>
  ids.filter(id => (state.chat2.metaMap.get(id) ?? {trustedState: 'untrusted'}).trustedState === 'untrusted')

// We keep a set of conversations to unbox
let metaQueue = new Set<Types.ConversationIDKey>()
const queueMetaToRequest = (state: Container.TypedState, action: Chat2Gen.MetaNeedsUpdatingPayload) => {
  let added = false
  untrustedConversationIDKeys(state, action.payload.conversationIDKeys).forEach(k => {
    if (!metaQueue.has(k)) {
      added = true
      metaQueue.add(k)
    }
  })
  if (added) {
    // only unboxMore if something changed
    return Chat2Gen.createMetaHandleQueue()
  } else {
    logger.info('skipping meta queue run, queue unchanged')
    return false
  }
}

// Watch the meta queue and take up to 10 items. Choose the last items first since they're likely still visible
const requestMeta = async (state: Container.TypedState, _a: unknown, listenerApi: Container.ListenerApi) => {
  const maxToUnboxAtATime = 10
  const ar = [...metaQueue]
  const maybeUnbox = ar.slice(0, maxToUnboxAtATime)
  metaQueue = new Set(ar.slice(maxToUnboxAtATime))

  const conversationIDKeys = untrustedConversationIDKeys(state, maybeUnbox)
  if (conversationIDKeys.length) {
    listenerApi.dispatch(Chat2Gen.createMetaRequestTrusted({conversationIDKeys, reason: 'scroll'}))
  }
  if (metaQueue.size && conversationIDKeys.length) {
    await Container.timeoutPromise(100)
  }
  if (metaQueue.size) {
    listenerApi.dispatch(Chat2Gen.createMetaHandleQueue())
  }
}

// Get valid keys that we aren't already loading or have loaded
const rpcMetaRequestConversationIDKeys = (
  state: Container.TypedState,
  action: Chat2Gen.MetaRequestTrustedPayload | Chat2Gen.SelectedConversationPayload
) => {
  let keys: Array<Types.ConversationIDKey>
  switch (action.type) {
    case Chat2Gen.metaRequestTrusted:
      keys = action.payload.conversationIDKeys
      if (action.payload.force) {
        return keys.filter(Constants.isValidConversationIDKey)
      }
      break
    case Chat2Gen.selectedConversation:
      keys = [action.payload.conversationIDKey].filter(Constants.isValidConversationIDKey)
      break
    default:
      throw new Error('Invalid action passed to unboxRows')
  }
  return Constants.getConversationIDKeyMetasToLoad(keys, state.chat2.metaMap)
}

const onGetInboxConvsUnboxed = (
  state: Container.TypedState,
  action: EngineGen.Chat1ChatUiChatInboxConversationPayload
) => {
  // TODO not reactive
  const {infoMap} = UsersConstants.useState.getState()
  const actions: Array<Container.TypedActions> = []
  const {convs} = action.payload.params
  const inboxUIItems = JSON.parse(convs) as Array<RPCChatTypes.InboxUIItem>
  const metas: Array<Types.ConversationMeta> = []
  let added = false
  const usernameToFullname: {[username: string]: string} = {}
  inboxUIItems.forEach(inboxUIItem => {
    const meta = Constants.inboxUIItemToConversationMeta(state, inboxUIItem)
    if (meta) {
      metas.push(meta)
    }
    const participantInfo: Types.ParticipantInfo = Constants.uiParticipantsToParticipantInfo(
      inboxUIItem.participants ?? []
    )
    if (participantInfo.all.length > 0) {
      Constants.getConvoState(Types.stringToConversationIDKey(inboxUIItem.convID)).dispatch.setParticipants(
        participantInfo
      )
    }
    inboxUIItem.participants?.forEach((part: RPCChatTypes.UIParticipant) => {
      const {assertion, fullName} = part
      if (!infoMap.get(assertion) && fullName) {
        added = true
        usernameToFullname[assertion] = fullName
      }
    })
  })
  if (added) {
    UsersConstants.useState
      .getState()
      .dispatch.updates(
        Object.keys(usernameToFullname).map(name => ({info: {fullname: usernameToFullname[name]}, name}))
      )
  }
  if (metas.length > 0) {
    actions.push(Chat2Gen.createMetasReceived({metas}))
  }
  return actions
}

const onGetInboxConvFailed = (_: unknown, action: EngineGen.Chat1ChatUiChatInboxFailedPayload) => {
  const username = ConfigConstants.useCurrentUserState.getState().username
  const {convID, error} = action.payload.params
  const conversationIDKey = Types.conversationIDToKey(convID)
  switch (error.typ) {
    case RPCChatTypes.ConversationErrorType.transient:
      logger.info(
        `onFailed: ignoring transient error for convID: ${conversationIDKey} error: ${error.message}`
      )
      return false
    default:
      logger.info(`onFailed: displaying error for convID: ${conversationIDKey} error: ${error.message}`)
      return Chat2Gen.createMetaReceivedError({conversationIDKey, error, username})
  }
}

const maybeChangeSelectedConv = () => {
  const selectedConversation = Constants.getSelectedConversation()
  const {inboxLayout} = Constants.useState.getState()
  if (!inboxLayout || !inboxLayout.reselectInfo) {
    return false
  }
  const {reselectInfo} = inboxLayout
  if (
    !Constants.isValidConversationIDKey(selectedConversation) ||
    selectedConversation === reselectInfo.oldConvID
  ) {
    if (Container.isPhone) {
      // on mobile just head back to the inbox if we have something selected
      if (Constants.isValidConversationIDKey(selectedConversation)) {
        logger.info(`maybeChangeSelectedConv: mobile: navigating up on conv change`)
        return Chat2Gen.createNavigateToInbox()
      }
      logger.info(`maybeChangeSelectedConv: mobile: ignoring conv change, no conv selected`)
      return false
    }
    if (reselectInfo.newConvID) {
      logger.info(`maybeChangeSelectedConv: selecting new conv: ${reselectInfo.newConvID}`)
      return Chat2Gen.createNavigateToThread({
        conversationIDKey: reselectInfo.newConvID,
        reason: 'findNewestConversation',
      })
    } else {
      logger.info(`maybeChangeSelectedConv: deselecting conv, service provided no new conv`)
      return Chat2Gen.createNavigateToThread({
        conversationIDKey: Constants.noConversationIDKey,
        reason: 'findNewestConversation',
      })
    }
  } else {
    logger.info(
      `maybeChangeSelectedConv: selected conv mismatch on reselect (ignoring): selected: ${selectedConversation} srvold: ${reselectInfo.oldConvID}`
    )
    return false
  }
}

// We want to unbox rows that have scroll into view
const unboxRows = (
  state: Container.TypedState,
  action: Chat2Gen.MetaRequestTrustedPayload | Chat2Gen.SelectedConversationPayload
) => {
  if (!ConfigConstants.useConfigState.getState().loggedIn) {
    return false
  }
  switch (action.type) {
    case Chat2Gen.metaRequestTrusted:
      logger.info(`unboxRows: metaRequestTrusted: reason: ${action.payload.reason}`)
      break
    case Chat2Gen.selectedConversation:
      logger.info(`unboxRows: selectedConversation`)
      break
  }
  const conversationIDKeys = rpcMetaRequestConversationIDKeys(state, action)
  if (!conversationIDKeys.length) {
    return
  }
  logger.info(`unboxRows: unboxing len: ${conversationIDKeys.length} convs: ${conversationIDKeys.join(',')}`)
  RPCChatTypes.localRequestInboxUnboxRpcPromise({
    convIDs: conversationIDKeys.map(k => Types.keyToConversationID(k)),
  })
    .then(() => {})
    .catch((error: unknown) => {
      if (error instanceof RPCError) {
        logger.info(`unboxRows: failed ${error.desc}`)
      }
    })
  return Chat2Gen.createMetaRequestingTrusted({conversationIDKeys})
}

// We get an incoming message streamed to us
const onIncomingMessage = (
  state: Container.TypedState,
  incoming: RPCChatTypes.IncomingMessage
): Array<Container.TypedActions> => {
  const {message: cMsg} = incoming
  const actions: Array<Container.TypedActions> = []
  const {modifiedMessage, convID, displayDesktopNotification, desktopNotificationSnippet} = incoming

  const username = ConfigConstants.useCurrentUserState.getState().username
  if (convID && cMsg) {
    const conversationIDKey = Types.conversationIDToKey(convID)

    // check for a reaction outbox notification before doing anything
    if (
      cMsg.state === RPCChatTypes.MessageUnboxedState.outbox &&
      cMsg.outbox.messageType === RPCChatTypes.MessageType.reaction
    ) {
      actions.push(
        Chat2Gen.createToggleLocalReaction({
          conversationIDKey,
          decorated: cMsg.outbox.decoratedTextBody ?? '',
          emoji: cMsg.outbox.body,
          targetOrdinal: cMsg.outbox.supersedes,
          username,
        })
      )
      return actions
    }

    const shouldAddMessage = Constants.getConvoState(conversationIDKey).containsLatestMessage ?? false

    const {getLastOrdinal, devicename} = Constants.getMessageStateExtras(state, conversationIDKey)
    const message = Constants.uiMessageToMessage(
      conversationIDKey,
      cMsg,
      username,
      getLastOrdinal,
      devicename
    )
    if (message) {
      // The attachmentuploaded call is like an 'edit' of an attachment. We get the placeholder, then its replaced by the actual image
      if (
        cMsg.state === RPCChatTypes.MessageUnboxedState.valid &&
        cMsg.valid?.messageBody.messageType === RPCChatTypes.MessageType.attachmentuploaded &&
        cMsg.valid?.messageBody.attachmentuploaded &&
        message.type === 'attachment'
      ) {
        actions.push(
          Chat2Gen.createMessageAttachmentUploaded({
            conversationIDKey,
            message,
            placeholderID: cMsg.valid.messageBody.attachmentuploaded.messageID,
          })
        )
      } else if (shouldAddMessage) {
        // A normal message
        actions.push(
          Chat2Gen.createMessagesAdd({context: {type: 'incoming'}, conversationIDKey, messages: [message]})
        )
      }
    } else if (cMsg.state === RPCChatTypes.MessageUnboxedState.valid && cMsg.valid) {
      const {valid} = cMsg
      const body = valid.messageBody
      logger.info(`Got chat incoming message of messageType: ${body.messageType}`)
      // Types that are mutations
      switch (body.messageType) {
        case RPCChatTypes.MessageType.edit:
          if (modifiedMessage) {
            const modMessage = Constants.uiMessageToMessage(
              conversationIDKey,
              modifiedMessage,
              username,
              getLastOrdinal,
              devicename
            )
            if (modMessage) {
              actions.push(
                Chat2Gen.createMessagesAdd({
                  context: {type: 'incoming'},
                  conversationIDKey,
                  messages: [modMessage],
                })
              )
            }
          }
          break
        case RPCChatTypes.MessageType.delete: {
          const {delete: d} = body
          const {messageMap} = state.chat2
          if (d?.messageIDs) {
            // check if the delete is acting on an exploding message
            const messageIDs = d.messageIDs
            const messages = messageMap.get(conversationIDKey)
            const isExplodeNow =
              !!messages &&
              messageIDs.some(_id => {
                const id = Types.numberToOrdinal(_id)
                const message = messages.get(id) ?? [...messages.values()].find(msg => msg.id === id)
                if ((message?.type === 'text' || message?.type === 'attachment') && message?.exploding) {
                  return true
                }
                return false
              })

            actions.push(
              isExplodeNow
                ? Chat2Gen.createMessagesExploded({
                    conversationIDKey,
                    explodedBy: valid.senderUsername,
                    messageIDs,
                  })
                : Chat2Gen.createMessagesWereDeleted({conversationIDKey, messageIDs})
            )
          }
          break
        }
        default:
      }
    }
    if (
      !Container.isMobile &&
      displayDesktopNotification &&
      desktopNotificationSnippet &&
      cMsg.state === RPCChatTypes.MessageUnboxedState.valid &&
      cMsg.valid
    ) {
      actions.push(
        Chat2Gen.createDesktopNotification({
          author: cMsg.valid.senderUsername,
          body: desktopNotificationSnippet,
          conversationIDKey,
        })
      )
    }
  }

  return actions
}

// Helper to handle incoming inbox updates that piggy back on various calls
const chatActivityToMetasAction = (
  state: Container.TypedState,
  payload: {
    readonly conv?: RPCChatTypes.InboxUIItem | null
  }
) => {
  const conv = payload?.conv
  if (!conv) {
    return []
  }
  const meta = Constants.inboxUIItemToConversationMeta(state, conv)
  const usernameToFullname = (conv.participants ?? []).reduce<{[key: string]: string}>((map, part) => {
    if (part.fullName) {
      map[part.assertion] = part.fullName
    }
    return map
  }, {})

  UsersConstants.useState.getState().dispatch.updates(
    Object.keys(usernameToFullname).map(name => ({
      info: {fullname: usernameToFullname[name]},
      name,
    }))
  )

  return meta ? Chat2Gen.createMetasReceived({metas: [meta]}) : false
}

// We got errors from the service
const onErrorMessage = (outboxRecords: Array<RPCChatTypes.OutboxRecord>) => {
  const actions = outboxRecords.reduce<Array<Container.TypedActions>>((arr, outboxRecord) => {
    const s = outboxRecord.state
    if (s.state === RPCChatTypes.OutboxStateType.error) {
      const {error} = s
      const conversationIDKey = Types.conversationIDToKey(outboxRecord.convID)
      const outboxID = Types.rpcOutboxIDToOutboxID(outboxRecord.outboxID)

      // This is temp until fixed by CORE-7112. We get this error but not the call to let us show the red banner
      const reason = Constants.rpcErrorToString(error)
      let tempForceRedBox: string | undefined
      if (error.typ === RPCChatTypes.OutboxErrorType.identify) {
        // Find out the user who failed identify
        const match = error.message.match(/"(.*)"/)
        tempForceRedBox = match?.[1]
      }
      arr.push(Chat2Gen.createMessageErrored({conversationIDKey, errorTyp: error.typ, outboxID, reason}))
      if (tempForceRedBox) {
        UsersConstants.useState.getState().dispatch.updates([{info: {broken: true}, name: tempForceRedBox}])
      }
    }
    return arr
  }, [])

  return actions
}

// Some participants are broken/fixed now
const onChatIdentifyUpdate = (_: unknown, action: EngineGen.Chat1NotifyChatChatIdentifyUpdatePayload) => {
  const {update} = action.payload.params
  const usernames = update.CanonicalName.split(',')
  const broken = (update.breaks.breaks || []).map(b => b.user.username)
  const updates = usernames.map(name => ({info: {broken: broken.includes(name)}, name}))
  UsersConstants.useState.getState().dispatch.updates(updates)
}

// Get actions to update messagemap / metamap when retention policy expunge happens

const expungeToActions = (expunge: RPCChatTypes.ExpungeInfo) => {
  const actions: Array<Container.TypedActions> = []
  const conversationIDKey = Types.conversationIDToKey(expunge.convID)
  const staticConfig = Constants.useState.getState().staticConfig
  // The types here are askew. It confuses frontend MessageType with protocol MessageType.
  // Placeholder is an example where it doesn't make sense.
  const deletableMessageTypes = staticConfig?.deletableByDeleteHistory || Constants.allMessageTypes
  actions.push(
    Chat2Gen.createMessagesWereDeleted({
      conversationIDKey,
      deletableMessageTypes,
      upToMessageID: expunge.expunge.upto,
    })
  )
  return actions
}

// Get actions to update messagemap / metamap when ephemeral messages expire
const ephemeralPurgeToActions = (info: RPCChatTypes.EphemeralPurgeNotifInfo) => {
  const actions: Array<Container.TypedActions> = []
  const conversationIDKey = Types.conversationIDToKey(info.convID)
  const messageIDs =
    !!info.msgs &&
    info.msgs.reduce<Array<Types.MessageID>>((arr, msg) => {
      const msgID = Constants.getMessageID(msg)
      if (msgID) {
        arr.push(msgID)
      }
      return arr
    }, [])
  !!messageIDs && actions.push(Chat2Gen.createMessagesExploded({conversationIDKey, messageIDs}))
  return actions
}

const messagesUpdatedToActions = (state: Container.TypedState, info: RPCChatTypes.MessagesUpdated) => {
  const conversationIDKey = Types.conversationIDToKey(info.convID)

  const {username, getLastOrdinal, devicename} = Constants.getMessageStateExtras(state, conversationIDKey)
  const messages = (info.updates ?? []).reduce<
    Array<{
      message: Types.Message
      messageID: Types.MessageID
    }>
  >((l, msg) => {
    const messageID = Constants.getMessageID(msg)
    if (!messageID) {
      return l
    }
    const uiMsg = Constants.uiMessageToMessage(conversationIDKey, msg, username, getLastOrdinal, devicename)
    if (!uiMsg) {
      return l
    }
    return l.concat({
      message: uiMsg,
      messageID: Types.numberToMessageID(messageID),
    })
  }, [])
  return [Chat2Gen.createUpdateMessages({conversationIDKey, messages})]
}

// Get actions to update the messagemap when reactions are updated
const reactionUpdateToActions = (info: RPCChatTypes.ReactionUpdateNotif) => {
  const conversationIDKey = Types.conversationIDToKey(info.convID)
  if (!info.reactionUpdates || info.reactionUpdates.length === 0) {
    logger.warn(`Got ReactionUpdateNotif with no reactionUpdates for convID=${conversationIDKey}`)
    return
  }
  const updates = info.reactionUpdates.map(ru => ({
    reactions: Constants.reactionMapToReactions(ru.reactions),
    targetMsgID: ru.targetMsgID,
  }))
  logger.info(`Got ${updates.length} reaction updates for convID=${conversationIDKey}`)
  const reduxDispatch = Z.getReduxDispatch()
  reduxDispatch(Chat2Gen.createUpdateReactions({conversationIDKey, updates}))
  Constants.useState.getState().dispatch.updateUserReacjis(info.userReacjis)
}

const onChatPromptUnfurl = (_: unknown, action: EngineGen.Chat1NotifyChatChatPromptUnfurlPayload) => {
  const {convID, domain, msgID} = action.payload.params
  Constants.getConvoState(Types.conversationIDToKey(convID)).dispatch.unfurlTogglePrompt(
    Types.numberToMessageID(msgID),
    domain,
    true
  )
}

const onChatAttachmentUploadProgress = (
  _: unknown,
  action: EngineGen.Chat1NotifyChatChatAttachmentUploadProgressPayload
) => {
  const {convID, outboxID, bytesComplete, bytesTotal} = action.payload.params
  return Chat2Gen.createAttachmentUploading({
    conversationIDKey: Types.conversationIDToKey(convID),
    outboxID: Types.rpcOutboxIDToOutboxID(outboxID),
    ratio: bytesComplete / bytesTotal,
  })
}

const onChatAttachmentUploadStart = (
  _: unknown,
  action: EngineGen.Chat1NotifyChatChatAttachmentUploadStartPayload
) => {
  const {convID, outboxID} = action.payload.params
  return Chat2Gen.createAttachmentUploading({
    conversationIDKey: Types.conversationIDToKey(convID),
    outboxID: Types.rpcOutboxIDToOutboxID(outboxID),
    ratio: 0.01,
  })
}

const onChatInboxSyncStarted = () => {
  const {increment} = WaitingConstants.useWaitingState.getState().dispatch
  increment(Constants.waitingKeyInboxSyncStarted)
}

// Service tells us it's done syncing
const onChatInboxSynced = (
  _state: Container.TypedState,
  action: EngineGen.Chat1NotifyChatChatInboxSyncedPayload
) => {
  const {syncRes} = action.payload.params

  const {clear} = WaitingConstants.useWaitingState.getState().dispatch
  const {inboxRefresh} = Constants.useState.getState().dispatch
  clear(Constants.waitingKeyInboxSyncStarted)
  const actions: Array<Container.TypedActions> = []

  switch (syncRes.syncType) {
    // Just clear it all
    case RPCChatTypes.SyncInboxResType.clear:
      inboxRefresh('inboxSyncedClear')
      break
    // We're up to date
    case RPCChatTypes.SyncInboxResType.current:
      break
    // We got some new messages appended
    case RPCChatTypes.SyncInboxResType.incremental: {
      const selectedConversation = Constants.getSelectedConversation()
      const items = syncRes.incremental?.items || []
      const metas = items.reduce<Array<Types.ConversationMeta>>((arr, i) => {
        const meta = Constants.unverifiedInboxUIItemToConversationMeta(i.conv)
        if (meta) {
          if (meta.conversationIDKey === selectedConversation) {
            // First thing load the messages
            actions.unshift(
              Chat2Gen.createMarkConversationsStale({
                conversationIDKeys: [selectedConversation],
                updateType: RPCChatTypes.StaleUpdateType.newactivity,
              })
            )
          }
          arr.push(meta)
        }
        return arr
      }, [])
      const removals = ((!syncRes.incremental ? undefined : syncRes.incremental.removals) || []).map(
        Types.stringToConversationIDKey
      )
      // Update new untrusted
      if (metas.length || removals.length) {
        actions.push(Chat2Gen.createMetasReceived({metas, removals}))
      }
      // Unbox items
      actions.push(
        Chat2Gen.createMetaRequestTrusted({
          conversationIDKeys: items
            .filter(i => i.shouldUnbox)
            .map(i => Types.stringToConversationIDKey(i.conv.convID)),
          force: true,
          reason: 'inboxSynced',
        })
      )
      break
    }
    default:
      inboxRefresh('inboxSyncedUnknown')
  }
  return actions
}

const onChatPaymentInfo = (_: unknown, action: EngineGen.Chat1NotifyChatChatPaymentInfoPayload) => {
  const {convID, info, msgID} = action.payload.params
  const conversationIDKey = convID ? Types.conversationIDToKey(convID) : Constants.noConversationIDKey
  const paymentInfo = Constants.uiPaymentInfoToChatPaymentInfo([info])
  if (!paymentInfo) {
    // This should never happen
    const errMsg = `got 'NotifyChat.ChatPaymentInfo' with no valid paymentInfo for convID ${conversationIDKey} messageID: ${msgID}. The local version may be absent or out of date.`
    logger.error(errMsg)
    throw new Error(errMsg)
  }
  Constants.useState.getState().dispatch.paymentInfoReceived(paymentInfo)
  Constants.getConvoState(conversationIDKey).dispatch.paymentInfoReceived(msgID, paymentInfo)
}

const onChatRequestInfo = (_: unknown, action: EngineGen.Chat1NotifyChatChatRequestInfoPayload) => {
  const {convID, info, msgID} = action.payload.params
  const conversationIDKey = Types.conversationIDToKey(convID)
  const requestInfo = Constants.uiRequestInfoToChatRequestInfo(info)
  if (!requestInfo) {
    // This should never happen
    const errMsg = `got 'NotifyChat.ChatRequestInfo' with no valid requestInfo for convID ${conversationIDKey} messageID: ${msgID}. The local version may be absent or out of date.`
    logger.error(errMsg)
    throw new Error(errMsg)
  }
  Constants.getConvoState(conversationIDKey).dispatch.requestInfoReceived(msgID, requestInfo)
}

const onChatSetConvRetention = (
  state: Container.TypedState,
  action: EngineGen.Chat1NotifyChatChatSetConvRetentionPayload
) => {
  const {conv, convID} = action.payload.params
  if (!conv) {
    logger.warn('onChatSetConvRetention: no conv given')
    return false
  }
  const meta = Constants.inboxUIItemToConversationMeta(state, conv)
  if (!meta) {
    logger.warn(`onChatSetConvRetention: no meta found for ${convID.toString()}`)
    return false
  }
  if (conv) {
    return Chat2Gen.createUpdateConvRetentionPolicy({meta})
  }
  logger.warn('got NotifyChat.ChatSetConvRetention with no attached InboxUIItem. Forcing update.')
  // force to get the new retention policy
  return Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys: [Types.conversationIDToKey(convID)],
    force: true,
    reason: 'setConvRetention',
  })
}

const onChatSetConvSettings = (_: unknown, action: EngineGen.Chat1NotifyChatChatSetConvSettingsPayload) => {
  const {conv, convID} = action.payload.params
  const conversationIDKey = Types.conversationIDToKey(convID)
  const newRole =
    (conv?.convSettings && conv.convSettings.minWriterRoleInfo && conv.convSettings.minWriterRoleInfo.role) ||
    undefined
  const role = newRole && TeamsConstants.teamRoleByEnum[newRole]
  const cannotWrite = conv?.convSettings?.minWriterRoleInfo?.cannotWrite || false
  logger.info(
    `got new minWriterRole ${role || ''} for convID ${conversationIDKey}, cannotWrite ${cannotWrite ? 1 : 0}`
  )
  if (role && role !== 'none' && cannotWrite !== undefined) {
    return Chat2Gen.createSaveMinWriterRole({cannotWrite, conversationIDKey, role})
  }
  logger.warn(
    `got NotifyChat.ChatSetConvSettings with no valid minWriterRole for convID ${conversationIDKey}. The local version may be out of date.`
  )
  return false
}

const onChatSetTeamRetention = (
  state: Container.TypedState,
  action: EngineGen.Chat1NotifyChatChatSetTeamRetentionPayload
) => {
  const {convs} = action.payload.params
  const metas = (convs ?? []).reduce<Array<Types.ConversationMeta>>((l, c) => {
    const meta = Constants.inboxUIItemToConversationMeta(state, c)
    if (meta) {
      l.push(meta)
    }
    return l
  }, [])
  if (metas.length) {
    return Chat2Gen.createUpdateTeamRetentionPolicy({metas})
  }
  // this is a more serious problem, but we don't need to bug the user about it
  logger.error(
    'got NotifyChat.ChatSetTeamRetention with no attached InboxUIItems. The local version may be out of date'
  )
  return false
}

const onChatSubteamRename = (_: unknown, action: EngineGen.Chat1NotifyChatChatSubteamRenamePayload) => {
  const {convs} = action.payload.params
  const conversationIDKeys = (convs ?? []).map(c => Types.stringToConversationIDKey(c.convID))
  return Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys,
    force: true,
    reason: 'subTeamRename',
  })
}

const onChatChatTLFFinalizePayload = (
  _: unknown,
  action: EngineGen.Chat1NotifyChatChatTLFFinalizePayload
) => {
  const {convID} = action.payload.params
  return Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys: [Types.conversationIDToKey(convID)],
    reason: 'tlfFinalize',
  })
}

const onChatThreadStale = (_: unknown, action: EngineGen.Chat1NotifyChatChatThreadsStalePayload) => {
  const {updates} = action.payload.params
  let actions: Array<Container.TypedActions> = []
  const keys = ['clear', 'newactivity'] as const
  if (__DEV__) {
    if (keys.length * 2 !== Object.keys(RPCChatTypes.StaleUpdateType).length) {
      throw new Error('onChatThreadStale invalid enum')
    }
  }
  keys.forEach(key => {
    const conversationIDKeys = (updates || []).reduce<Array<string>>((arr, u) => {
      if (u.updateType === RPCChatTypes.StaleUpdateType[key]) {
        arr.push(Types.conversationIDToKey(u.convID))
      }
      return arr
    }, [])
    // load the inbox instead
    if (conversationIDKeys.length > 0) {
      logger.info(
        `onChatThreadStale: dispatching thread reload actions for ${conversationIDKeys.length} convs of type ${key}`
      )
      actions = actions.concat([
        Chat2Gen.createMarkConversationsStale({
          conversationIDKeys,
          updateType: RPCChatTypes.StaleUpdateType[key],
        }),
        Chat2Gen.createMetaRequestTrusted({conversationIDKeys, force: true, reason: 'threadStale'}),
      ])
    }
  })
  return actions
}

const onNewChatActivity = (
  state: Container.TypedState,
  action: EngineGen.Chat1NotifyChatNewChatActivityPayload
) => {
  const {activity} = action.payload.params
  logger.info(`Got new chat activity of type: ${activity.activityType}`)
  let actions: Container.ListenActionReturn = []
  switch (activity.activityType) {
    case RPCChatTypes.ChatActivityType.incomingMessage: {
      const {incomingMessage} = activity
      actions = actions.concat(onIncomingMessage(state, incomingMessage))
      actions = actions.concat(chatActivityToMetasAction(state, incomingMessage))
      break
    }
    case RPCChatTypes.ChatActivityType.setStatus:
      actions = chatActivityToMetasAction(state, activity.setStatus)
      break
    case RPCChatTypes.ChatActivityType.readMessage:
      actions = chatActivityToMetasAction(state, activity.readMessage)
      break
    case RPCChatTypes.ChatActivityType.newConversation:
      actions = chatActivityToMetasAction(state, activity.newConversation)
      break
    case RPCChatTypes.ChatActivityType.failedMessage: {
      const {failedMessage} = activity
      const {outboxRecords} = failedMessage
      if (outboxRecords) {
        actions = actions.concat(onErrorMessage(outboxRecords))
        actions = actions.concat(chatActivityToMetasAction(state, failedMessage))
      }
      break
    }
    case RPCChatTypes.ChatActivityType.membersUpdate:
      actions = [
        Chat2Gen.createMetaRequestTrusted({
          conversationIDKeys: [Types.conversationIDToKey(activity.membersUpdate.convID)],
          force: true,
          reason: 'membersUpdate',
        }),
      ]
      break
    case RPCChatTypes.ChatActivityType.setAppNotificationSettings:
      {
        const {setAppNotificationSettings} = activity
        actions = [
          Chat2Gen.createNotificationSettingsUpdated({
            conversationIDKey: Types.conversationIDToKey(setAppNotificationSettings.convID),
            settings: setAppNotificationSettings.settings,
          }),
        ]
      }
      break
    case RPCChatTypes.ChatActivityType.expunge: {
      actions = expungeToActions(activity.expunge)
      break
    }
    case RPCChatTypes.ChatActivityType.ephemeralPurge:
      actions = ephemeralPurgeToActions(activity.ephemeralPurge)
      break
    case RPCChatTypes.ChatActivityType.reactionUpdate:
      reactionUpdateToActions(activity.reactionUpdate)
      break
    case RPCChatTypes.ChatActivityType.messagesUpdated: {
      actions = messagesUpdatedToActions(state, activity.messagesUpdated)
      break
    }
    default:
  }
  return actions
}

const onChatConvUpdate = (
  state: Container.TypedState,
  action: EngineGen.Chat1NotifyChatChatConvUpdatePayload
) => {
  const {conv} = action.payload.params
  if (conv) {
    const meta = Constants.inboxUIItemToConversationMeta(state, conv)
    if (meta) {
      return [Chat2Gen.createMetasReceived({metas: [meta]})]
    }
  }
  return []
}

type ScrollDirection = 'none' | 'back' | 'forward'

const scrollDirectionToPagination = (sd: ScrollDirection, numberOfMessagesToLoad: number) => {
  const pagination = {
    last: false,
    next: '',
    num: numberOfMessagesToLoad,
    previous: '',
  }
  switch (sd) {
    case 'none':
      break
    case 'back':
      pagination.next = 'deadbeef'
      break
    case 'forward':
      pagination.previous = 'deadbeef'
  }
  return pagination
}

// Load new messages on a thread. We call this when you select a conversation,
// we get a thread-is-stale notification, or when you scroll up and want more
// messages
const loadMoreMessages = (
  action?:
    | Chat2Gen.NavigateToThreadPayload
    | Chat2Gen.JumpToRecentPayload
    | Chat2Gen.LoadOlderMessagesDueToScrollPayload
    | Chat2Gen.LoadNewerMessagesDueToScrollPayload
    | Chat2Gen.LoadMessagesCenteredPayload
    | Chat2Gen.MarkConversationsStalePayload
    | Chat2Gen.TabSelectedPayload
) => {
  const f = async () => {
    const getReduxStore = Z.getReduxStore()
    const reduxDispatch = Z.getReduxDispatch()
    // Get the conversationIDKey
    let key: Types.ConversationIDKey | undefined
    let reason: string = ''
    let sd: ScrollDirection = 'none'
    let messageIDControl: RPCChatTypes.MessageIDControl | undefined
    let forceClear = false
    let forceContainsLatestCalc = false
    const knownRemotes: Array<string> = []
    const centeredMessageIDs: Array<{
      conversationIDKey: Types.ConversationIDKey
      messageID: Types.MessageID
      highlightMode: Types.CenterOrdinalHighlightMode
    }> = []

    switch (action?.type) {
      case undefined:
        if (!Container.isMobile || !ConfigConstants.useConfigState.getState().appFocused) {
          return
        }
        key = Constants.getSelectedConversation()
        reason = 'foregrounding'
        break
      case Chat2Gen.markConversationsStale:
        key = Constants.getSelectedConversation()
        // not mentioned?
        if (!action.payload.conversationIDKeys.includes(key)) {
          return
        }
        reason = 'got stale'
        break
      case Chat2Gen.tabSelected:
        key = Constants.getSelectedConversation()
        reason = 'tab selected'
        break
      case Chat2Gen.navigateToThread:
        key = action.payload.conversationIDKey
        reason = action.payload.reason || 'navigated'
        if (action.payload.pushBody && action.payload.pushBody.length > 0) {
          knownRemotes.push(action.payload.pushBody)
        }
        if (action.payload.highlightMessageID) {
          reason = 'centered'
          messageIDControl = {
            mode: RPCChatTypes.MessageIDControlMode.centered,
            num: Constants.numMessagesOnInitialLoad,
            pivot: action.payload.highlightMessageID,
          }
          forceClear = true
          forceContainsLatestCalc = true
          centeredMessageIDs.push({
            conversationIDKey: key,
            highlightMode: 'flash',
            messageID: action.payload.highlightMessageID,
          })
        }
        break
      case Chat2Gen.loadOlderMessagesDueToScroll:
        key = action.payload.conversationIDKey
        break
      case Chat2Gen.loadNewerMessagesDueToScroll:
        key = action.payload.conversationIDKey
        reason = 'scroll forward'
        break
      case Chat2Gen.loadMessagesCentered:
        key = action.payload.conversationIDKey
        reason = 'centered'
        messageIDControl = {
          mode: RPCChatTypes.MessageIDControlMode.centered,
          num: Constants.numMessagesOnInitialLoad,
          pivot: action.payload.messageID,
        }
        forceClear = true
        forceContainsLatestCalc = true
        centeredMessageIDs.push({
          conversationIDKey: key,
          highlightMode: action.payload.highlightMode,
          messageID: action.payload.messageID,
        })
        break
      case Chat2Gen.jumpToRecent:
        key = action.payload.conversationIDKey
        reason = 'jump to recent'
        forceClear = true
        break
      default:
    }

    if (!key || !Constants.isValidConversationIDKey(key)) {
      logger.info('bail: no conversationIDKey')
      return
    }

    const conversationIDKey = key
    const conversationID = Types.keyToConversationID(conversationIDKey)
    let numberOfMessagesToLoad: number

    const meta = Constants.getMeta(getReduxStore(), conversationIDKey)

    if (meta.membershipType === 'youAreReset' || meta.rekeyers.size > 0) {
      logger.info('bail: we are reset')
      return
    }

    if (action?.type === Chat2Gen.loadOlderMessagesDueToScroll) {
      if (!Constants.getConvoState(conversationIDKey).moreToLoad) {
        logger.info('bail: scrolling back and at the end')
        return
      }
      sd = 'back'
      numberOfMessagesToLoad = Constants.numMessagesOnScrollback
    } else if (action?.type === Chat2Gen.loadNewerMessagesDueToScroll) {
      sd = 'forward'
      numberOfMessagesToLoad = Constants.numMessagesOnScrollback
    } else {
      numberOfMessagesToLoad = Constants.numMessagesOnInitialLoad
    }

    logger.info(`calling rpc convo: ${conversationIDKey} num: ${numberOfMessagesToLoad} reason: ${reason}`)

    const loadingKey = Constants.waitingKeyThreadLoad(conversationIDKey)
    let calledClear = false
    const onGotThread = (thread: string) => {
      if (!thread) {
        return
      }

      const {username, getLastOrdinal, devicename} = Constants.getMessageStateExtras(
        getReduxStore(),
        conversationIDKey
      )
      const uiMessages: RPCChatTypes.UIMessages = JSON.parse(thread)
      let shouldClearOthers = false
      if ((forceClear || sd === 'none') && !calledClear) {
        shouldClearOthers = true
        calledClear = true
      }
      const messages = (uiMessages.messages ?? []).reduce<Array<Types.Message>>((arr, m) => {
        const message = conversationIDKey
          ? Constants.uiMessageToMessage(conversationIDKey, m, username, getLastOrdinal, devicename)
          : undefined
        if (message) {
          arr.push(message)
        }
        return arr
      }, [])

      // logger.info(`thread load ordinals ${messages.map(m => m.ordinal)}`)

      const moreToLoad = uiMessages.pagination ? !uiMessages.pagination.last : true
      Constants.getConvoState(conversationIDKey).dispatch.setMoreToLoad(moreToLoad)

      if (messages.length) {
        reduxDispatch(
          Chat2Gen.createMessagesAdd({
            centeredMessageIDs,
            context: {conversationIDKey, type: 'threadLoad'},
            conversationIDKey,
            forceContainsLatestCalc,
            messages,
            shouldClearOthers,
          })
        )
      }
    }

    const pagination = messageIDControl ? null : scrollDirectionToPagination(sd, numberOfMessagesToLoad)
    try {
      let validated = false
      const results = await RPCChatTypes.localGetThreadNonblockRpcListener(
        {
          incomingCallMap: {
            'chat.1.chatUi.chatThreadCached': p => p && onGotThread(p.thread || ''),
            'chat.1.chatUi.chatThreadFull': p => p && onGotThread(p.thread || ''),
            'chat.1.chatUi.chatThreadStatus': p => {
              // if we're validated, never undo that
              if (p.status.typ === RPCChatTypes.UIChatThreadStatusTyp.validated) {
                validated = true
              } else if (validated) {
                return
              }
              if (p) {
                Constants.getConvoState(conversationIDKey).dispatch.setThreadLoadStatus(p.status.typ)
              }
            },
          },
          params: {
            cbMode: RPCChatTypes.GetThreadNonblockCbMode.incremental,
            conversationID,
            identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
            knownRemotes,
            pagination,
            pgmode: RPCChatTypes.GetThreadNonblockPgMode.server,
            query: {
              disablePostProcessThread: false,
              disableResolveSupersedes: false,
              enableDeletePlaceholders: true,
              markAsRead: false,
              messageIDControl,
              messageTypes: Constants.loadThreadMessageTypes,
            },
            reason: Constants.reasonToRPCReason(reason),
          },
          waitingKey: loadingKey,
        },
        Z.dummyListenerApi
      )
      reduxDispatch(
        Chat2Gen.createSetConversationOffline({conversationIDKey, offline: results && results.offline})
      )
    } catch (error) {
      if (error instanceof RPCError) {
        logger.warn(error.desc)
        // no longer in team
        if (error.code === RPCTypes.StatusCode.scchatnotinteam) {
          const {inboxRefresh} = Constants.useState.getState().dispatch
          inboxRefresh('maybeKickedFromTeam')
          reduxDispatch(Chat2Gen.createNavigateToInbox())
        }
        if (error.code !== RPCTypes.StatusCode.scteamreaderror) {
          // scteamreaderror = user is not in team. they'll see the rekey screen so don't throw for that
          throw error
        }
      }
    }
  }
  Z.ignorePromise(f())
}

// Show a desktop notification
const desktopNotify = async (state: Container.TypedState, action: Chat2Gen.DesktopNotificationPayload) => {
  const {conversationIDKey, author, body} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)

  if (
    Constants.isUserActivelyLookingAtThisThread(conversationIDKey) ||
    meta.isMuted // ignore muted convos
  ) {
    logger.info('not sending notification')
    return
  }

  logger.info('sending chat notification')
  let title = ['small', 'big'].includes(meta.teamType) ? meta.teamname : author
  if (meta.teamType === 'big') {
    title += `#${meta.channelname}`
  }

  const actions = await new Promise<Array<Container.TypedActions>>(resolve => {
    const onClick = () => {
      ConfigConstants.useConfigState.getState().dispatch.showMain()
      resolve([
        Chat2Gen.createNavigateToInbox(),
        Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'desktopNotification'}),
      ])
    }
    const onClose = () => {
      resolve([])
    }
    logger.info('invoking NotifyPopup for chat notification')
    const sound = ConfigConstants.useConfigState.getState().notifySound
    NotifyPopup(title, {body, sound}, -1, author, onClick, onClose)
  })

  return actions
}

// Delete a message. We cancel pending messages
const messageDelete = async (state: Container.TypedState, action: Chat2Gen.MessageDeletePayload) => {
  const {conversationIDKey, ordinal} = action.payload
  const {metaMap, messageMap} = state.chat2
  const map = messageMap.get(conversationIDKey)
  const message = map?.get(ordinal)
  if (!message) {
    logger.warn('Deleting message')
    logger.debug('Deleting invalid message:', message)
    return false
  }

  const meta = metaMap.get(conversationIDKey)
  if (!meta) {
    logger.warn('Deleting message w/ no meta')
    logger.debug('Deleting message w/ no meta', message)
    return false
  }

  // We have to cancel pending messages
  if (!message.id) {
    if (message.outboxID) {
      await RPCChatTypes.localCancelPostRpcPromise(
        {outboxID: Types.outboxIDToRpcOutboxID(message.outboxID)},
        Constants.waitingKeyCancelPost
      )
      return Chat2Gen.createMessagesWereDeleted({conversationIDKey, ordinals: [message.ordinal]})
    } else {
      logger.warn('Delete of no message id and no outboxid')
    }
  } else {
    await RPCChatTypes.localPostDeleteNonblockRpcPromise(
      {
        clientPrev: 0,
        conversationID: Types.keyToConversationID(conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        outboxID: null,
        supersedes: message.id,
        tlfName: meta.tlfname,
        tlfPublic: false,
      },
      Constants.waitingKeyDeletePost
    )
  }
  return false
}

const messageEdit = async (
  state: Container.TypedState,
  action: Chat2Gen.MessageEditPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, text, ordinal} = action.payload
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
  if (!message) {
    logger.warn("Can't find message to edit", ordinal)
    return
  }

  if (message.type === 'text' || message.type === 'attachment') {
    // Skip if the content is the same
    if (message.type === 'text' && message.text.stringValue() === text.stringValue()) {
      Constants.getConvoState(conversationIDKey).dispatch.setEditing(false)
      return
    } else if (message.type === 'attachment' && message.title === text.stringValue()) {
      Constants.getConvoState(conversationIDKey).dispatch.setEditing(false)
      return
    }
    const meta = Constants.getMeta(state, conversationIDKey)
    const tlfName = meta.tlfname
    const clientPrev = Constants.getClientPrev(state, conversationIDKey)
    const outboxID = Constants.generateOutboxID()
    const target = {
      messageID: message.id,
      outboxID: message.outboxID ? Types.outboxIDToRpcOutboxID(message.outboxID) : undefined,
    }
    await RPCChatTypes.localPostEditNonblockRpcPromise(
      {
        body: text.stringValue(),
        clientPrev,
        conversationID: Types.keyToConversationID(conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        outboxID,
        target,
        tlfName,
        tlfPublic: false,
      },
      Constants.waitingKeyEditPost
    )

    if (!message.id) {
      listenerApi.dispatch(Chat2Gen.createPendingMessageWasEdited({conversationIDKey, ordinal, text}))
    }
  }
}

const messageRetry = async (_: unknown, action: Chat2Gen.MessageRetryPayload) => {
  const {outboxID} = action.payload
  await RPCChatTypes.localRetryPostRpcPromise(
    {outboxID: Types.outboxIDToRpcOutboxID(outboxID)},
    Constants.waitingKeyRetryPost
  )
}

const onReplyJump = (_: unknown, action: Chat2Gen.ReplyJumpPayload) =>
  Chat2Gen.createLoadMessagesCentered({
    conversationIDKey: action.payload.conversationIDKey,
    highlightMode: 'flash',
    messageID: action.payload.messageID,
  })

const messageSend = async (
  state: Container.TypedState,
  action: Chat2Gen.MessageSendPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, text, replyTo} = action.payload

  const meta = Constants.getMeta(state, conversationIDKey)
  const tlfName = meta.tlfname
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)

  // disable sending exploding messages if flag is false
  const ephemeralLifetime = Constants.getConvoState(conversationIDKey).explodingMode
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
  const confirmRouteName = 'chatPaymentsConfirm'
  try {
    await RPCChatTypes.localPostTextNonblockRpcListener(
      {
        customResponseIncomingCallMap: {
          'chat.1.chatUi.chatStellarDataConfirm': (_, response) => {
            // immediate fail
            response.result(false)
          },
          'chat.1.chatUi.chatStellarDataError': (_, response) => {
            // immediate fail
            response.result(false)
          },
        },
        incomingCallMap: {
          'chat.1.chatUi.chatStellarDone': ({canceled}) => {
            const visibleScreen = RouterConstants.getVisibleScreen()
            if (visibleScreen && visibleScreen.name === confirmRouteName) {
              RouterConstants.useState.getState().dispatch.clearModals()
              return
            }
            if (canceled) {
              Constants.getConvoState(conversationIDKey).dispatch.setUnsentText(text.stringValue())
              return
            }
            return false
          },
          'chat.1.chatUi.chatStellarShowConfirm': () => {},
        },
        params: {
          ...ephemeralData,
          body: text.stringValue(),
          clientPrev,
          conversationID: Types.keyToConversationID(conversationIDKey),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          outboxID: undefined,
          replyTo,
          tlfName,
          tlfPublic: false,
        },
        waitingKey: action.payload.waitingKey || Constants.waitingKeyPost,
      },
      listenerApi
    )
    logger.info('success')
  } catch (_) {
    logger.info('error')
  }

  // If there are block buttons on this conversation, clear them.
  if (Constants.useState.getState().blockButtonsMap.has(meta.teamID)) {
    listenerApi.dispatch(Chat2Gen.createDismissBlockButtons({teamID: meta.teamID}))
  }

  // Do some logging to track down the root cause of a bug causing
  // messages to not send. Do this after creating the objects above to
  // narrow down the places where the action can possibly stop.
  logger.info('non-empty text?', text.stringValue().length > 0)
}

const messageSendByUsernames = async (_: unknown, action: Chat2Gen.MessageSendByUsernamesPayload) => {
  const username = ConfigConstants.useCurrentUserState.getState().username
  const tlfName = `${username},${action.payload.usernames}`
  try {
    const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
      {
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.ConversationMembersType.impteamnative,
        tlfName,
        tlfVisibility: RPCTypes.TLFVisibility.private,
        topicType: RPCChatTypes.TopicType.chat,
      },
      action.payload.waitingKey
    )
    const {text, waitingKey} = action.payload
    return Chat2Gen.createMessageSend({
      conversationIDKey: Types.conversationIDToKey(result.conv.info.id),
      text,
      waitingKey,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.warn('Could not send in messageSendByUsernames', error.message)
    }
  }
  return []
}

type StellarConfirmWindowResponse = {result: (b: boolean) => void}
let _stellarConfirmWindowResponse: StellarConfirmWindowResponse | undefined

function storeStellarConfirmWindowResponse(accept: boolean, response?: StellarConfirmWindowResponse) {
  _stellarConfirmWindowResponse?.result(accept)
  _stellarConfirmWindowResponse = response
}

const confirmScreenResponse = (_: unknown, action: Chat2Gen.ConfirmScreenResponsePayload) => {
  storeStellarConfirmWindowResponse(action.payload.accept)
}

// We always make adhoc convos and never preview it
const previewConversationPersonMakesAConversation = (
  _: unknown,
  action: Chat2Gen.PreviewConversationPayload
) => {
  const {participants, teamname, reason, highlightMessageID} = action.payload
  if (teamname) return false
  if (!participants) return false

  // if stellar just search first, could do others maybe
  if ((reason === 'requestedPayment' || reason === 'sentPayment') && participants.length === 1) {
    const username = ConfigConstants.useCurrentUserState.getState().username
    const toFind = participants[0]
    for (const cs of Constants.stores.values()) {
      const p = cs.getState().participants
      if (p.name.length === 2) {
        const other = p.name.filter(n => n !== username)
        if (other[0] === toFind) {
          return Chat2Gen.createNavigateToThread({
            conversationIDKey: cs.getState().id,
            reason: 'justCreated',
          })
        }
      }
    }
  }

  return [
    Chat2Gen.createNavigateToThread({
      conversationIDKey: Constants.pendingWaitingConversationIDKey,
      reason: 'justCreated',
    }),
    Chat2Gen.createCreateConversation({highlightMessageID, participants}),
  ]
}

// We preview channels
const previewConversationTeam = async (
  state: Container.TypedState,
  action: Chat2Gen.PreviewConversationPayload
) => {
  const {conversationIDKey, highlightMessageID, teamname, reason} = action.payload
  if (conversationIDKey) {
    if (
      reason === 'messageLink' ||
      reason === 'teamMention' ||
      reason === 'channelHeader' ||
      reason === 'manageView'
    ) {
      // Add preview channel to inbox
      await RPCChatTypes.localPreviewConversationByIDLocalRpcPromise({
        convID: Types.keyToConversationID(conversationIDKey),
      })
    }
    return Chat2Gen.createNavigateToThread({conversationIDKey, highlightMessageID, reason: 'previewResolved'})
  }

  if (!teamname) {
    return false
  }

  const channelname = action.payload.channelname || 'general'

  try {
    const results = await RPCChatTypes.localFindConversationsLocalRpcPromise({
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      membersType: RPCChatTypes.ConversationMembersType.team,
      oneChatPerTLF: true,
      tlfName: teamname,
      topicName: channelname,
      topicType: RPCChatTypes.TopicType.chat,
      visibility: RPCTypes.TLFVisibility.private,
    })
    const resultMetas = (results.uiConversations || [])
      .map(row => Constants.inboxUIItemToConversationMeta(state, row))
      .filter(Boolean)

    const first = resultMetas[0]
    if (!first) {
      if (action.payload.reason === 'appLink') {
        LinksConstants.useState
          .getState()
          .dispatch.setLinkError(
            "We couldn't find this team chat channel. Please check that you're a member of the team and the channel exists."
          )
        RouterConstants.useState.getState().dispatch.navigateAppend('keybaseLinkError')
        return
      } else {
        return []
      }
    }

    const results2 = await RPCChatTypes.localPreviewConversationByIDLocalRpcPromise({
      convID: Types.keyToConversationID(first.conversationIDKey),
    })
    const actions: Array<Container.TypedActions> = []
    const meta = Constants.inboxUIItemToConversationMeta(state, results2.conv)
    if (meta) {
      actions.push(Chat2Gen.createMetasReceived({metas: [meta]}))
    }
    actions.push(
      Chat2Gen.createNavigateToThread({
        conversationIDKey: first.conversationIDKey,
        highlightMessageID,
        reason: 'previewResolved',
      })
    )
    return actions
  } catch (error) {
    if (
      error instanceof RPCError &&
      error.code === RPCTypes.StatusCode.scteamnotfound &&
      reason === 'appLink'
    ) {
      LinksConstants.useState
        .getState()
        .dispatch.setLinkError(
          "We couldn't find this team. Please check that you're a member of the team and the channel exists."
        )
      RouterConstants.useState.getState().dispatch.navigateAppend('keybaseLinkError')
      return
    } else {
      throw error
    }
  }
}

const openFolder = (state: Container.TypedState, action: Chat2Gen.OpenFolderPayload) => {
  const meta = Constants.getMeta(state, action.payload.conversationIDKey)
  const participantInfo = Constants.getConvoState(action.payload.conversationIDKey).participants
  const path = FsTypes.stringToPath(
    meta.teamType !== 'adhoc'
      ? ConfigConstants.teamFolder(meta.teamname)
      : ConfigConstants.privateFolderWithUsers(participantInfo.name)
  )
  return FsConstants.makeActionForOpenPathInFilesTab(path)
}

const downloadAttachment = async (
  downloadToCache: boolean,
  message: Types.Message,
  listenerApi: Container.ListenerApi
) => {
  try {
    const {conversationIDKey} = message
    const rpcRes = await RPCChatTypes.localDownloadFileAttachmentLocalRpcPromise({
      conversationID: Types.keyToConversationID(conversationIDKey),
      downloadToCache,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      messageID: message.id,
      preview: false,
    })
    listenerApi.dispatch(Chat2Gen.createAttachmentDownloaded({message, path: rpcRes.filePath}))
    return rpcRes.filePath
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info(`downloadAttachment error: ${error.message}`)
      listenerApi.dispatch(
        Chat2Gen.createAttachmentDownloaded({error: error.message || 'Error downloading attachment', message})
      )
    } else {
      listenerApi.dispatch(
        Chat2Gen.createAttachmentDownloaded({error: 'Error downloading attachment', message})
      )
    }
    return false
  }
}

// Download an attachment to your device
const attachmentDownload = async (
  state: Container.TypedState,
  action: Chat2Gen.AttachmentDownloadPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, ordinal} = action.payload

  const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)

  if (message?.type !== 'attachment') {
    throw new Error('Trying to download missing / incorrect message?')
  }

  // already downloaded?
  if (message.downloadPath) {
    logger.warn('Attachment already downloaded')
    return
  }

  await downloadAttachment(false, message, listenerApi)
}

const attachmentPreviewSelect = (_: unknown, action: Chat2Gen.AttachmentPreviewSelectPayload) => {
  RouterConstants.useState.getState().dispatch.navigateAppend({
    props: {
      conversationIDKey: action.payload.conversationIDKey,
      ordinal: action.payload.ordinal,
    },
    selected: 'chatAttachmentFullscreen',
  })
}

// Handle an image pasted into a conversation
const attachmentPasted = async (_: unknown, action: Chat2Gen.AttachmentPastedPayload) => {
  const {conversationIDKey, data} = action.payload
  const outboxID = Constants.generateOutboxID()
  const path = await RPCChatTypes.localMakeUploadTempFileRpcPromise({data, filename: 'paste.png', outboxID})

  const pathAndOutboxIDs = [{outboxID, path}]

  RouterConstants.useState.getState().dispatch.navigateAppend({
    props: {conversationIDKey, noDragDrop: true, pathAndOutboxIDs},
    selected: 'chatAttachmentGetTitles',
  })
}

const attachmentUploadCanceled = async (_: unknown, action: Chat2Gen.AttachmentUploadCanceledPayload) => {
  const {outboxIDs} = action.payload
  for (const outboxID of outboxIDs) {
    await RPCChatTypes.localCancelUploadTempFileRpcPromise({outboxID})
  }
}

const sendAudioRecording = async (
  state: Container.TypedState,
  action: Chat2Gen.SendAudioRecordingPayload
) => {
  const {conversationIDKey, amps, path, duration} = action.payload
  const outboxID = Constants.generateOutboxID()
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)
  const ephemeralLifetime = Constants.getConvoState(conversationIDKey).explodingMode
  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (!meta) {
    logger.warn('sendAudioRecording: no meta for send')
    return
  }

  let callerPreview: RPCChatTypes.MakePreviewRes | undefined
  if (amps) {
    callerPreview = await RPCChatTypes.localMakeAudioPreviewRpcPromise({amps, duration})
  }
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
  try {
    await RPCChatTypes.localPostFileAttachmentLocalNonblockRpcPromise({
      arg: {
        ...ephemeralData,
        callerPreview,
        conversationID: Types.keyToConversationID(conversationIDKey),
        filename: path,
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        metadata: Buffer.from([]),
        outboxID,
        title: '',
        tlfName: meta.tlfname,
        visibility: RPCTypes.TLFVisibility.private,
      },
      clientPrev,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.warn('sendAudioRecording: failed to send attachment: ' + error.message)
    }
  }
}

// Upload an attachment
const attachmentsUpload = async (state: Container.TypedState, action: Chat2Gen.AttachmentsUploadPayload) => {
  const {conversationIDKey, paths, titles} = action.payload
  let tlfName = action.payload.tlfName
  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (!meta) {
    if (!tlfName) {
      logger.warn('attachmentsUpload: missing meta for attachment upload', conversationIDKey)
      return
    }
  } else {
    tlfName = meta.tlfname
  }
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)
  // disable sending exploding messages if flag is false
  const ephemeralLifetime = Constants.getConvoState(conversationIDKey).explodingMode
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
  const outboxIDs = paths.reduce<Array<Buffer>>((obids, p) => {
    obids.push(p.outboxID ? p.outboxID : Constants.generateOutboxID())
    return obids
  }, [])
  await Promise.all(
    paths.map(async (p, i) =>
      RPCChatTypes.localPostFileAttachmentLocalNonblockRpcPromise({
        arg: {
          ...ephemeralData,
          conversationID: Types.keyToConversationID(conversationIDKey),
          filename: Styles.unnormalizePath(p.path),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          metadata: Buffer.from([]),
          outboxID: outboxIDs[i],
          title: titles[i] ?? '',
          tlfName: tlfName ?? '',
          visibility: RPCTypes.TLFVisibility.private,
        },
        clientPrev,
      })
    )
  )
}

const attachFromDragAndDrop = async (
  _: Container.TypedState,
  action: Chat2Gen.AttachFromDragAndDropPayload
) => {
  if (Platform.isDarwin && darwinCopyToChatTempUploadFile) {
    const paths = await Promise.all(
      action.payload.paths.map(async p => {
        const outboxID = Constants.generateOutboxID()
        const dst = await RPCChatTypes.localGetUploadTempFileRpcPromise({filename: p.path, outboxID})
        await darwinCopyToChatTempUploadFile(dst, p.path)
        return {outboxID, path: dst}
      })
    )

    return Chat2Gen.createAttachmentsUpload({
      conversationIDKey: action.payload.conversationIDKey,
      paths,
      titles: action.payload.titles,
    })
  }
  return Chat2Gen.createAttachmentsUpload({
    conversationIDKey: action.payload.conversationIDKey,
    paths: action.payload.paths,
    titles: action.payload.titles,
  })
}

// Tell service we're typing
const sendTyping = async (_: unknown, action: Chat2Gen.SendTypingPayload) => {
  const {conversationIDKey, typing} = action.payload
  await RPCChatTypes.localUpdateTypingRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    typing,
  })
}

// Implicit teams w/ reset users we can invite them back in or chat w/o them
const resetChatWithoutThem = (state: Container.TypedState, action: Chat2Gen.ResetChatWithoutThemPayload) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  const participantInfo = Constants.getConvoState(conversationIDKey).participants
  // remove all bad people
  const goodParticipants = new Set(participantInfo.all)
  meta.resetParticipants.forEach(r => goodParticipants.delete(r))
  return Chat2Gen.createPreviewConversation({
    participants: [...goodParticipants],
    reason: 'resetChatWithoutThem',
  })
}

// let them back in after they reset
const resetLetThemIn = async (_: unknown, action: Chat2Gen.ResetLetThemInPayload) => {
  await RPCChatTypes.localAddTeamMemberAfterResetRpcPromise({
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
    username: action.payload.username,
  })
}

const markThreadAsRead = (
  action?:
    | Chat2Gen.MessagesAddPayload
    | Chat2Gen.UpdateUnreadlinePayload
    | Chat2Gen.MarkInitiallyLoadedThreadAsReadPayload
    | Chat2Gen.UpdateReactionsPayload
    | Chat2Gen.TabSelectedPayload
) => {
  const f = async () => {
    const getReduxStore = Z.getReduxStore()
    if (!ConfigConstants.useConfigState.getState().loggedIn) {
      logger.info('bail on not logged in')
      return
    }
    const conversationIDKey = Constants.getSelectedConversation()

    if (!Constants.isValidConversationIDKey(conversationIDKey)) {
      logger.info('bail on no selected conversation')
      return
    }

    const meta = getReduxStore().chat2.metaMap.get(conversationIDKey)

    if (action?.type === Chat2Gen.markInitiallyLoadedThreadAsRead) {
      if (action?.payload.conversationIDKey !== conversationIDKey) {
        logger.info('bail on not looking at this thread anymore?')
        return
      }
    }

    if (!Constants.isUserActivelyLookingAtThisThread(conversationIDKey)) {
      logger.info('bail on not looking at this thread')
      return
    }

    // Check to see if we do not have the latest message, and don't mark anything as read in that case
    // If we have no information at all, then just mark as read
    if (!Constants.getConvoState(conversationIDKey).containsLatestMessage) {
      logger.info('bail on not containing latest message')
      return
    }

    let message: Types.Message | undefined
    const mmap = getReduxStore().chat2.messageMap.get(conversationIDKey)
    if (mmap) {
      const ordinals = Constants.getMessageOrdinals(getReduxStore(), conversationIDKey)
      const ordinal =
        ordinals &&
        findLast([...ordinals], (o: Types.Ordinal) => {
          const m = mmap.get(o)
          return m ? !!m.id : false
        })
      message = ordinal ? mmap.get(ordinal) : undefined
    }

    let readMsgID: number | undefined
    if (meta) {
      readMsgID = message ? (message.id > meta.maxMsgID ? message.id : meta.maxMsgID) : meta.maxMsgID
    }
    if (action?.type === Chat2Gen.updateUnreadline && readMsgID && readMsgID >= action?.payload.messageID) {
      // If we are marking as unread, don't send the local RPC.
      return
    }

    logger.info(`marking read messages ${conversationIDKey} ${readMsgID} for ${action?.type ?? ''}`)
    await RPCChatTypes.localMarkAsReadLocalRpcPromise({
      conversationID: Types.keyToConversationID(conversationIDKey),
      forceUnread: false,
      msgID: readMsgID,
    })
  }
  Z.ignorePromise(f())
}

const markTeamAsRead = async (_: unknown, action: Chat2Gen.MarkTeamAsReadPayload) => {
  if (!ConfigConstants.useConfigState.getState().loggedIn) {
    logger.info('bail on not logged in')
    return
  }
  const tlfID = Buffer.from(TeamsTypes.teamIDToString(action.payload.teamID), 'hex')
  await RPCChatTypes.localMarkTLFAsReadLocalRpcPromise({
    tlfID,
  })
}

// Delete a message and any older
const deleteMessageHistory = async (
  state: Container.TypedState,
  action: Chat2Gen.MessageDeleteHistoryPayload
) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)

  if (!meta.tlfname) {
    logger.warn('Deleting message history for non-existent TLF:')
    return
  }

  await RPCChatTypes.localPostDeleteHistoryByAgeRpcPromise({
    age: 0,
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: meta.tlfname,
    tlfPublic: false,
  })
}

const dismissJourneycard = (_: unknown, action: Chat2Gen.DismissJourneycardPayload) => {
  const {cardType, conversationIDKey, ordinal} = action.payload
  RPCChatTypes.localDismissJourneycardRpcPromise({
    cardType: cardType,
    convID: Types.keyToConversationID(conversationIDKey),
  }).catch((error: unknown) => {
    if (error instanceof RPCError) {
      logger.error(`Failed to dismiss journeycard: ${error.message}`)
    }
  })
  return Chat2Gen.createMessagesWereDeleted({conversationIDKey, ordinals: [ordinal]})
}

const fetchUserEmoji = async (_: unknown, action: Chat2Gen.FetchUserEmojiPayload) => {
  const {conversationIDKey, onlyInTeam} = action.payload
  const results = await RPCChatTypes.localUserEmojisRpcPromise(
    {
      convID:
        conversationIDKey && conversationIDKey !== Constants.noConversationIDKey
          ? Types.keyToConversationID(conversationIDKey)
          : null,
      opts: {
        getAliases: true,
        getCreationInfo: false,
        onlyInTeam: onlyInTeam ?? false,
      },
    },
    Constants.waitingKeyLoadingEmoji
  )
  Constants.useState.getState().dispatch.loadedUserEmoji(results)
}

// Helpers to nav you to the right place
const navigateToInbox = (
  _: unknown,
  action: Chat2Gen.NavigateToInboxPayload | Chat2Gen.LeaveConversationPayload
) => {
  if (action.type === Chat2Gen.leaveConversation && action.payload.dontNavigateToInbox) {
    return
  }
  RouterConstants.useState.getState().dispatch.navUpToScreen('chatRoot')
  RouterConstants.useState.getState().dispatch.switchTab(Tabs.chatTab)
}

const navigateToThread = (_: unknown, action: Chat2Gen.NavigateToThreadPayload) => {
  const {conversationIDKey, reason} = action.payload
  // don't nav if its caused by a nav
  if (reason === 'navChanged') {
    return
  }
  const visible = RouterConstants.getVisibleScreen()
  // @ts-ignore TODO better types
  const visibleConvo: Types.ConversationIDKey | undefined = visible?.params?.conversationIDKey
  const visibleRouteName = visible?.name

  if (visibleRouteName !== Constants.threadRouteName && reason === 'findNewestConversation') {
    // service is telling us to change our selection but we're not looking, ignore
    return
  }

  // we select the chat tab and change the params
  if (Constants.isSplit) {
    RouterConstants.navToThread(conversationIDKey)
  } else {
    // immediately switch stack to an inbox | thread stack
    if (reason === 'push' || reason === 'savedLastState') {
      RouterConstants.navToThread(conversationIDKey)
      return
    } else {
      // replace if looking at the pending / waiting screen
      const replace =
        visibleRouteName === Constants.threadRouteName &&
        !Constants.isValidConversationIDKey(visibleConvo ?? '')
      // note: we don't switch tabs on non split
      const modalPath = RouterConstants.getModalStack()
      if (modalPath.length > 0) {
        RouterConstants.useState.getState().dispatch.clearModals()
      }
      RouterConstants.useState
        .getState()
        .dispatch.navigateAppend({props: {conversationIDKey}, selected: Constants.threadRouteName}, replace)
    }
  }
}

const maybeLoadTeamFromMeta = (meta: Types.ConversationMeta) => {
  const {teamID} = meta
  if (meta.teamname) {
    TeamsConstants.useState.getState().dispatch.getMembers(teamID)
  }
}

const ensureSelectedTeamLoaded = (
  state: Container.TypedState,
  action: Chat2Gen.SelectedConversationPayload | Chat2Gen.MetasReceivedPayload
) => {
  const selectedConversation = Constants.getSelectedConversation()
  const meta = state.chat2.metaMap.get(selectedConversation)
  return meta
    ? action.type === Chat2Gen.selectedConversation ||
      !TeamsConstants.useState.getState().teamIDToMembers.get(meta.teamID)
      ? maybeLoadTeamFromMeta(meta)
      : false
    : false
}

const ensureSelectedMeta = (state: Container.TypedState, action: Chat2Gen.SelectedConversationPayload) => {
  const {conversationIDKey} = action.payload
  const {metaMap} = state.chat2
  const meta = metaMap.get(conversationIDKey)
  const participantInfo = Constants.getConvoState(conversationIDKey).participants
  return !meta || participantInfo.all.length === 0
    ? Chat2Gen.createMetaRequestTrusted({
        conversationIDKeys: [conversationIDKey],
        force: true,
        noWaiting: true,
        reason: 'ensureSelectedMeta',
      })
    : false
}

const ensureWidgetMetas = (state: Container.TypedState) => {
  const {inboxLayout} = Constants.useState.getState()
  const {metaMap} = state.chat2
  if (!inboxLayout?.widgetList) {
    return false
  }
  const missing = inboxLayout.widgetList.reduce<Array<Types.ConversationIDKey>>((l, v) => {
    if (!metaMap.get(v.convID)) {
      l.push(v.convID)
    }
    return l
  }, [])
  if (missing.length === 0) {
    return false
  }
  return Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys: missing,
    force: true,
    noWaiting: true,
    reason: 'ensureWidgetMetas',
  })
}

// Native share sheet for attachments
const mobileMessageAttachmentShare = async (
  _: Container.TypedState,
  action: Chat2Gen.MessageAttachmentNativeSharePayload,
  listenerApi: Container.ListenerApi
) => {
  const {message} = action.payload
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  const filePath = await downloadAttachment(true, message, listenerApi)
  if (!filePath) {
    logger.info('Downloading attachment failed')
    return
  }

  if (isIOS && message.fileName.endsWith('.pdf')) {
    RouterConstants.useState.getState().dispatch.navigateAppend({
      props: {
        message,
        // Prepend the 'file://' prefix here. Otherwise when webview
        // automatically does that, it triggers onNavigationStateChange
        // with the new address and we'd call stoploading().
        url: 'file://' + filePath,
      },
      selected: 'chatPDF',
    })
    return
  }

  try {
    await showShareActionSheet({filePath, mimeType: message.fileType})
  } catch (e) {
    logger.error('Failed to share attachment: ' + JSON.stringify(e))
  }
}

// Native save to camera roll
const mobileMessageAttachmentSave = async (
  _: Container.TypedState,
  action: Chat2Gen.MessageAttachmentNativeSavePayload,
  listenerApi: Container.ListenerApi
) => {
  const {message} = action.payload
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  const {conversationIDKey, ordinal, fileType} = message
  const fileName = await downloadAttachment(true, message, listenerApi)
  if (!fileName) {
    // failed to download
    logger.info('Downloading attachment failed')
    return
  }
  listenerApi.dispatch(Chat2Gen.createAttachmentMobileSave({conversationIDKey, ordinal}))
  try {
    logger.info('Trying to save chat attachment to camera roll')
    await saveAttachmentToCameraRoll(fileName, fileType)
  } catch (err) {
    logger.error('Failed to save attachment: ' + err)
    throw new Error('Failed to save attachment: ' + err)
  }
  listenerApi.dispatch(Chat2Gen.createAttachmentMobileSaved({conversationIDKey, ordinal}))
}

const joinConversation = async (_: unknown, action: Chat2Gen.JoinConversationPayload) => {
  await RPCChatTypes.localJoinConversationByIDLocalRpcPromise(
    {convID: Types.keyToConversationID(action.payload.conversationIDKey)},
    Constants.waitingKeyJoinConversation
  )
}

const fetchConversationBio = (_: unknown, action: Chat2Gen.SelectedConversationPayload) => {
  const {conversationIDKey} = action.payload
  const participantInfo = Constants.getConvoState(conversationIDKey).participants
  const username = ConfigConstants.useCurrentUserState.getState().username
  const otherParticipants = Constants.getRowParticipants(participantInfo, username || '')
  if (otherParticipants.length === 1) {
    // we're in a one-on-one convo
    const username = otherParticipants[0] || ''

    // if this is an SBS/phone/email convo or we get a garbage username, don't do anything
    if (username === '' || username.includes('@')) {
      return
    }

    UsersConstants.useState.getState().dispatch.getBio(username)
  }
}

const leaveConversation = async (_: unknown, action: Chat2Gen.LeaveConversationPayload) => {
  await RPCChatTypes.localLeaveConversationLocalRpcPromise(
    {
      convID: Types.keyToConversationID(action.payload.conversationIDKey),
    },
    Constants.waitingKeyLeaveConversation
  )
}

const updateNotificationSettings = async (_: unknown, action: Chat2Gen.UpdateNotificationSettingsPayload) => {
  const {notificationsGlobalIgnoreMentions, notificationsMobile, notificationsDesktop} = action.payload
  const {conversationIDKey} = action.payload
  await RPCChatTypes.localSetAppNotificationSettingsLocalRpcPromise({
    channelWide: notificationsGlobalIgnoreMentions,
    convID: Types.keyToConversationID(conversationIDKey),
    settings: [
      {
        deviceType: RPCTypes.DeviceType.desktop,
        enabled: notificationsDesktop === 'onWhenAtMentioned',
        kind: RPCChatTypes.NotificationKind.atmention,
      },
      {
        deviceType: RPCTypes.DeviceType.desktop,
        enabled: notificationsDesktop === 'onAnyActivity',
        kind: RPCChatTypes.NotificationKind.generic,
      },
      {
        deviceType: RPCTypes.DeviceType.mobile,
        enabled: notificationsMobile === 'onWhenAtMentioned',
        kind: RPCChatTypes.NotificationKind.atmention,
      },
      {
        deviceType: RPCTypes.DeviceType.mobile,
        enabled: notificationsMobile === 'onAnyActivity',
        kind: RPCChatTypes.NotificationKind.generic,
      },
    ],
  })
}

const blockConversation = async (
  _: Container.TypedState,
  action: Chat2Gen.BlockConversationPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, reportUser} = action.payload
  listenerApi.dispatch(Chat2Gen.createNavigateToInbox())
  ConfigConstants.useConfigState.getState().dispatch.dynamic.persistRoute?.()
  await RPCChatTypes.localSetConversationStatusLocalRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    status: reportUser ? RPCChatTypes.ConversationStatus.reported : RPCChatTypes.ConversationStatus.blocked,
  })
}

const hideConversation = async (
  _: Container.TypedState,
  action: Chat2Gen.HideConversationPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey} = action.payload
  // Nav to inbox but don't use findNewConversation since changeSelectedConversation
  // does that with better information. It knows the conversation is hidden even before
  // that state bounces back.
  listenerApi.dispatch(Chat2Gen.createNavigateToInbox())
  Constants.useState.getState().dispatch.showInfoPanel(false)
  try {
    await RPCChatTypes.localSetConversationStatusLocalRpcPromise(
      {
        conversationID: Types.keyToConversationID(conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        status: RPCChatTypes.ConversationStatus.ignored,
      },
      Constants.waitingKeyConvStatusChange(conversationIDKey)
    )
  } catch (err) {
    logger.error('Failed to hide conversation: ' + err)
  }
}

const unhideConversation = async (_: Container.TypedState, action: Chat2Gen.UnhideConversationPayload) => {
  const {conversationIDKey} = action.payload
  try {
    await RPCChatTypes.localSetConversationStatusLocalRpcPromise(
      {
        conversationID: Types.keyToConversationID(conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        status: RPCChatTypes.ConversationStatus.unfiled,
      },
      Constants.waitingKeyConvStatusChange(conversationIDKey)
    )
  } catch (err) {
    logger.error('Failed to unhide conversation: ' + err)
  }
}

const setConvRetentionPolicy = async (_: unknown, action: Chat2Gen.SetConvRetentionPolicyPayload) => {
  const {conversationIDKey} = action.payload
  const convID = Types.keyToConversationID(conversationIDKey)
  let policy: RPCChatTypes.RetentionPolicy | undefined
  try {
    policy = TeamsConstants.retentionPolicyToServiceRetentionPolicy(action.payload.policy)
    if (policy) {
      await RPCChatTypes.localSetConvRetentionLocalRpcPromise({convID, policy})
      return
    }
  } catch (error) {
    if (error instanceof RPCError) {
      // should never happen
      logger.error(`Unable to parse retention policy: ${error.message}`)
    }
    throw error
  }
  return false
}

const toggleMessageCollapse = async (
  state: Container.TypedState,
  action: Chat2Gen.ToggleMessageCollapsePayload
) => {
  const {conversationIDKey, messageID, ordinal} = action.payload
  const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
  let isCollapsed = false

  if (messageID !== ordinal) {
    const unfurlInfos = [...(m?.unfurls?.values() ?? [])]
    const ui = unfurlInfos.find(u => u.unfurlMessageID === messageID)

    if (ui) {
      isCollapsed = ui.isCollapsed
    }
  } else {
    isCollapsed = m?.isCollapsed ?? false
  }
  await RPCChatTypes.localToggleMessageCollapseRpcPromise({
    collapse: !isCollapsed,
    convID: Types.keyToConversationID(conversationIDKey),
    msgID: messageID,
  })
}

// TODO This will break if you try to make 2 new conversations at the same time because there is
// only one pending conversation state.
// The fix involves being able to make multiple pending conversations
const createConversation = async (
  state: Container.TypedState,
  action: Chat2Gen.CreateConversationPayload,
  listenerApi: Container.ListenerApi
) => {
  const username = ConfigConstants.useCurrentUserState.getState().username
  if (!username) {
    logger.error('Making a convo while logged out?')
    return
  }
  try {
    const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
      {
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.ConversationMembersType.impteamnative,
        tlfName: [...new Set([username, ...action.payload.participants])].join(','),
        tlfVisibility: RPCTypes.TLFVisibility.private,
        topicType: RPCChatTypes.TopicType.chat,
      },
      Constants.waitingKeyCreating
    )
    const {conv, uiConv} = result
    const conversationIDKey = Types.conversationIDToKey(conv.info.id)
    if (!conversationIDKey) {
      logger.warn("Couldn't make a new conversation?")
    } else {
      const meta = Constants.inboxUIItemToConversationMeta(state, uiConv)
      if (meta) {
        listenerApi.dispatch(Chat2Gen.createMetasReceived({metas: [meta]}))
      }

      const participantInfo: Types.ParticipantInfo = Constants.uiParticipantsToParticipantInfo(
        uiConv.participants ?? []
      )
      if (participantInfo.all.length > 0) {
        Constants.getConvoState(Types.stringToConversationIDKey(uiConv.convID)).dispatch.setParticipants(
          participantInfo
        )
      }
      listenerApi.dispatch(
        Chat2Gen.createNavigateToThread({
          conversationIDKey,
          highlightMessageID: action.payload.highlightMessageID,
          reason: 'justCreated',
        })
      )
    }
  } catch (error) {
    if (error instanceof RPCError) {
      const errUsernames = error.fields?.filter((elem: any) => elem.key === 'usernames') as
        | undefined
        | Array<{key: string; value: string}>
      let disallowedUsers: Array<string> = []
      if (errUsernames?.length) {
        const {value} = errUsernames[0] ?? {value: ''}
        disallowedUsers = value.split(',')
      }
      const allowedUsers = action.payload.participants.filter(x => !disallowedUsers?.includes(x))
      Constants.useState
        .getState()
        .dispatch.conversationErrored(allowedUsers, disallowedUsers, error.code, error.desc)
      listenerApi.dispatch(
        Chat2Gen.createNavigateToThread({
          conversationIDKey: Constants.pendingErrorConversationIDKey,
          highlightMessageID: action.payload.highlightMessageID,
          reason: 'justCreated',
        })
      )
    }
  }
}

const messageReplyPrivately = async (
  state: Container.TypedState,
  action: Chat2Gen.MessageReplyPrivatelyPayload
) => {
  const {sourceConversationIDKey, ordinal} = action.payload
  const message = Constants.getMessage(state, sourceConversationIDKey, ordinal)
  if (!message) {
    logger.warn("messageReplyPrivately: can't find message to reply to", ordinal)
    return
  }

  const username = ConfigConstants.useCurrentUserState.getState().username
  if (!username) {
    throw new Error('messageReplyPrivately: making a convo while logged out?')
  }
  const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
    {
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      membersType: RPCChatTypes.ConversationMembersType.impteamnative,
      tlfName: [...new Set([username, message.author])].join(','),
      tlfVisibility: RPCTypes.TLFVisibility.private,
      topicType: RPCChatTypes.TopicType.chat,
    },
    Constants.waitingKeyCreating
  )
  const conversationIDKey = Types.conversationIDToKey(result.conv.info.id)
  if (!conversationIDKey) {
    logger.warn("messageReplyPrivately: couldn't make a new conversation?")
    return
  }
  const meta = Constants.inboxUIItemToConversationMeta(state, result.uiConv)
  if (!meta) {
    logger.warn('messageReplyPrivately: unable to make meta')
    return
  }

  if (message.type !== 'text') {
    return
  }
  const text = new Container.HiddenString(Constants.formatTextForQuoting(message.text.stringValue()))

  Constants.getConvoState(conversationIDKey).dispatch.setUnsentText(text.stringValue())
  return [
    Chat2Gen.createMetasReceived({metas: [meta]}),
    Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'createdMessagePrivately'}),
  ]
}

const toggleMessageReaction = async (
  state: Container.TypedState,
  action: Chat2Gen.ToggleMessageReactionPayload
) => {
  // The service translates this to a delete if an identical reaction already exists
  // so we only need to call this RPC to toggle it on & off
  const {conversationIDKey, emoji, ordinal} = action.payload
  if (!emoji) {
    return
  }
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
  if (!message) {
    logger.warn(`toggleMessageReaction: no message found`)
    return
  }
  const {type, exploded, id} = message
  if ((type === 'text' || type === 'attachment') && exploded) {
    logger.warn(`toggleMessageReaction: message is exploded`)
    return
  }
  const messageID = id
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)
  const meta = Constants.getMeta(state, conversationIDKey)
  const outboxID = Constants.generateOutboxID()
  logger.info(`toggleMessageReaction: posting reaction`)
  try {
    await RPCChatTypes.localPostReactionNonblockRpcPromise({
      body: emoji,
      clientPrev,
      conversationID: Types.keyToConversationID(conversationIDKey),
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      outboxID,
      supersedes: messageID,
      tlfName: meta.tlfname,
      tlfPublic: false,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info(`toggleMessageReaction: failed to post` + error.message)
    }
  }
}

const setMinWriterRole = async (_: unknown, action: Chat2Gen.SetMinWriterRolePayload) => {
  const {conversationIDKey, role} = action.payload
  logger.info(`Setting minWriterRole to ${role} for convID ${conversationIDKey}`)
  await RPCChatTypes.localSetConvMinWriterRoleLocalRpcPromise({
    convID: Types.keyToConversationID(conversationIDKey),
    role: RPCTypes.TeamRole[role],
  })
}

const unfurlRemove = async (state: Container.TypedState, action: Chat2Gen.UnfurlRemovePayload) => {
  const {conversationIDKey, messageID} = action.payload
  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (!meta) {
    logger.debug('unfurl remove no meta found, aborting!')
    return
  }
  await RPCChatTypes.localPostDeleteNonblockRpcPromise(
    {
      clientPrev: 0,
      conversationID: Types.keyToConversationID(conversationIDKey),
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      outboxID: null,
      supersedes: messageID,
      tlfName: meta.tlfname,
      tlfPublic: false,
    },
    Constants.waitingKeyDeletePost
  )
}

const unfurlDismissPrompt = (_: unknown, action: Chat2Gen.UnfurlResolvePromptPayload) => {
  const {conversationIDKey, messageID, domain} = action.payload
  Constants.getConvoState(conversationIDKey).dispatch.unfurlTogglePrompt(messageID, domain, false)
}

const unfurlResolvePrompt = async (_: unknown, action: Chat2Gen.UnfurlResolvePromptPayload) => {
  const {conversationIDKey, messageID, result} = action.payload
  await RPCChatTypes.localResolveUnfurlPromptRpcPromise({
    convID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    msgID: Types.messageIDToNumber(messageID),
    result,
  })
}

const unsentTextChanged = async (state: Container.TypedState, action: Chat2Gen.UnsentTextChangedPayload) => {
  const {conversationIDKey, text} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  await RPCChatTypes.localUpdateUnsentTextRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    text: text.stringValue(),
    tlfName: meta.tlfname,
  })
}

const onGiphyResults = (_: unknown, action: EngineGen.Chat1ChatUiChatGiphySearchResultsPayload) => {
  const {convID, results} = action.payload.params
  Constants.getConvoState(Types.stringToConversationIDKey(convID)).dispatch.giphyGotSearchResult(results)
}

const onGiphyToggleWindow = (_: unknown, action: EngineGen.Chat1ChatUiChatGiphyToggleResultWindowPayload) => {
  const {convID, show, clearInput} = action.payload.params
  const conversationIDKey = Types.stringToConversationIDKey(convID)
  if (clearInput) {
    Constants.getConvoState(conversationIDKey).dispatch.setUnsentText('')
  }

  Constants.getConvoState(Types.stringToConversationIDKey(convID)).dispatch.giphyToggleWindow(show)
}

const resolveMaybeMention = async (_: unknown, action: Chat2Gen.ResolveMaybeMentionPayload) => {
  await RPCChatTypes.localResolveMaybeMentionRpcPromise({
    mention: {channel: action.payload.channel, name: action.payload.name},
  })
}

const pinMessage = async (_: unknown, action: Chat2Gen.PinMessagePayload) => {
  try {
    await RPCChatTypes.localPinMessageRpcPromise({
      convID: Types.keyToConversationID(action.payload.conversationIDKey),
      msgID: action.payload.messageID,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`pinMessage: ${error.message}`)
    }
  }
}

const unpinMessage = async (_: unknown, action: Chat2Gen.UnpinMessagePayload) => {
  try {
    await RPCChatTypes.localUnpinMessageRpcPromise(
      {convID: Types.keyToConversationID(action.payload.conversationIDKey)},
      Constants.waitingKeyUnpin(action.payload.conversationIDKey)
    )
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`unpinMessage: ${error.message}`)
    }
  }
}

const ignorePinnedMessage = async (_: unknown, action: Chat2Gen.IgnorePinnedMessagePayload) => {
  await RPCChatTypes.localIgnorePinnedMessageRpcPromise({
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
  })
}

const openChatFromWidget = (
  _: unknown,
  {payload: {conversationIDKey}}: Chat2Gen.OpenChatFromWidgetPayload
) => {
  ConfigConstants.useConfigState.getState().dispatch.showMain()
  return [
    Chat2Gen.createNavigateToThread({
      conversationIDKey: conversationIDKey ?? Constants.noConversationIDKey,
      reason: 'inboxSmall',
    }),
  ]
}

const addUsersToChannel = async (_: unknown, action: Chat2Gen.AddUsersToChannelPayload) => {
  const {conversationIDKey, usernames} = action.payload

  try {
    await RPCChatTypes.localBulkAddToConvRpcPromise(
      {convID: Types.keyToConversationID(conversationIDKey), usernames},
      Constants.waitingKeyAddUsersToChannel
    )
    RouterConstants.useState.getState().dispatch.clearModals()
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`addUsersToChannel: ${error.message}`) // surfaced in UI via waiting key
    }
  }
}

const addUserToChannel = async (_: unknown, action: Chat2Gen.AddUserToChannelPayload) => {
  const {conversationIDKey, username} = action.payload
  try {
    await RPCChatTypes.localBulkAddToConvRpcPromise(
      {convID: Types.keyToConversationID(conversationIDKey), usernames: [username]},
      Constants.waitingKeyAddUserToChannel(username, conversationIDKey)
    )
    return Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'addedToChannel'})
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`addUserToChannel: ${error.message}`) // surfaced in UI via waiting key
    }
    return false
  }
}

const dismissBlockButtons = async (_: unknown, action: Chat2Gen.DismissBlockButtonsPayload) => {
  try {
    await RPCTypes.userDismissBlockButtonsRpcPromise({tlfID: action.payload.teamID})
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`Couldn't dismiss block buttons: ${error.message}`)
    }
  }
}

const maybeChangeChatSelection = (
  prev: RouterConstants.State['navState'],
  next: RouterConstants.State['navState']
) => {
  const wasModal = prev && RouterConstants.getModalStack(prev).length > 0
  const isModal = next && RouterConstants.getModalStack(next).length > 0

  // ignore if changes involve a modal
  if (wasModal || isModal) {
    return
  }

  const p = RouterConstants.getVisibleScreen(prev)
  const n = RouterConstants.getVisibleScreen(next)

  const wasChat = p?.name === Constants.threadRouteName
  const isChat = n?.name === Constants.threadRouteName

  // nothing to do with chat
  if (!wasChat && !isChat) {
    return
  }

  // @ts-ignore TODO better param typing
  const wasID: Types.ConversationIDKey | undefined = p?.params?.conversationIDKey
  // @ts-ignore TODO better param typing
  const isID: Types.ConversationIDKey | undefined = n?.params?.conversationIDKey

  logger.info('maybeChangeChatSelection ', {isChat, isID, wasChat, wasID})

  // same? ignore
  if (wasChat && isChat && wasID === isID) {
    // if we've never loaded anything, keep going so we load it
    if (!isID || Constants.getConvoState(isID).containsLatestMessage !== undefined) {
      return
    }
  }

  // deselect if there was one
  const deselectAction =
    wasChat && wasID && Constants.isValidConversationIDKey(wasID)
      ? [Chat2Gen.createDeselectedConversation({conversationIDKey: wasID})]
      : []

  const reduxDispatch = Z.getReduxDispatch()
  // still chatting? just select new one
  if (wasChat && isChat && isID && Constants.isValidConversationIDKey(isID)) {
    ;[...deselectAction, Chat2Gen.createSelectedConversation({conversationIDKey: isID})].forEach(a =>
      reduxDispatch(a)
    )
    return
  }

  // leaving a chat
  if (wasChat && !isChat) {
    ;[
      ...deselectAction,
      Chat2Gen.createSelectedConversation({conversationIDKey: Constants.noConversationIDKey}),
    ].forEach(a => reduxDispatch(a))
    return
  }

  // going into a chat
  if (isChat && isID && Constants.isValidConversationIDKey(isID)) {
    ;[...deselectAction, Chat2Gen.createSelectedConversation({conversationIDKey: isID})].forEach(a =>
      reduxDispatch(a)
    )
    return
  }
}

const maybeChatTabSelected = (
  prev: RouterConstants.State['navState'],
  next: RouterConstants.State['navState']
) => {
  const reduxDispatch = Z.getReduxDispatch()
  if (RouterConstants.getTab(prev) !== Tabs.chatTab && RouterConstants.getTab(next) === Tabs.chatTab) {
    reduxDispatch(Chat2Gen.createTabSelected())
  }
}

const updateDraftState = (_: unknown, action: Chat2Gen.DeselectedConversationPayload) =>
  Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys: [action.payload.conversationIDKey],
    force: true,
    reason: 'refreshPreviousSelected',
  })

const initChat = () => {
  // Platform specific actions
  if (Container.isMobile) {
    Container.listenAction(Chat2Gen.messageAttachmentNativeShare, mobileMessageAttachmentShare)
    Container.listenAction(Chat2Gen.messageAttachmentNativeSave, mobileMessageAttachmentSave)
  } else {
    Container.listenAction(Chat2Gen.desktopNotification, desktopNotify)
  }

  // Refresh the inbox
  Container.listenAction(EngineGen.chat1NotifyChatChatInboxStale, () => {
    Constants.useState.getState().dispatch.inboxRefresh('inboxStale')
  })
  Container.listenAction([Chat2Gen.selectedConversation, Chat2Gen.metasReceived], ensureSelectedTeamLoaded)
  // We've scrolled some new inbox rows into view, queue them up
  Container.listenAction(Chat2Gen.metaNeedsUpdating, queueMetaToRequest)
  // We have some items in the queue to process
  Container.listenAction(Chat2Gen.metaHandleQueue, requestMeta)

  // Actually try and unbox conversations
  Container.listenAction([Chat2Gen.metaRequestTrusted, Chat2Gen.selectedConversation], unboxRows)
  Container.listenAction(EngineGen.chat1ChatUiChatInboxConversation, onGetInboxConvsUnboxed)
  Container.listenAction(EngineGen.chat1ChatUiChatInboxUnverified, onGetInboxUnverifiedConvs)
  Container.listenAction(EngineGen.chat1ChatUiChatInboxFailed, onGetInboxConvFailed)
  Container.listenAction(EngineGen.chat1ChatUiChatInboxLayout, maybeChangeSelectedConv)
  Container.listenAction(EngineGen.chat1ChatUiChatInboxLayout, ensureWidgetMetas)
  // TODO move to engine constants
  Container.listenAction(EngineGen.chat1ChatUiChatInboxLayout, (_, action) => {
    Constants.useState.getState().dispatch.updateInboxLayout(action.payload.params.layout)
  })

  // Load the selected thread
  Container.listenAction(
    [
      Chat2Gen.navigateToThread,
      Chat2Gen.jumpToRecent,
      Chat2Gen.loadOlderMessagesDueToScroll,
      Chat2Gen.loadNewerMessagesDueToScroll,
      Chat2Gen.loadMessagesCentered,
      Chat2Gen.markConversationsStale,
      Chat2Gen.tabSelected,
    ],
    (_, a) => loadMoreMessages(a)
  )

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.appFocused === old.appFocused) return
    loadMoreMessages()
    markThreadAsRead()
  })

  // get the unread (orange) line
  Container.listenAction(Chat2Gen.selectedConversation, (_, a) => {
    const {conversationIDKey} = a.payload
    Constants.getConvoState(conversationIDKey).dispatch.loadOrangeLine()
  })

  Container.listenAction(Chat2Gen.messageRetry, messageRetry)
  Container.listenAction(Chat2Gen.messageSend, messageSend)
  Container.listenAction(Chat2Gen.messageSend, (_, a) => {
    const {conversationIDKey} = a.payload
    const {dispatch} = Constants.getConvoState(conversationIDKey)
    dispatch.setReplyTo(0)
    dispatch.setCommandMarkdown()
  })
  Container.listenAction(Chat2Gen.messageSendByUsernames, messageSendByUsernames)
  Container.listenAction(Chat2Gen.messageEdit, messageEdit)
  Container.listenAction(Chat2Gen.messageEdit, (_, action) => {
    Constants.getConvoState(action.payload.conversationIDKey).dispatch.setEditing(false)
  })
  Container.listenAction(Chat2Gen.messageDelete, messageDelete)
  Container.listenAction(Chat2Gen.messageDeleteHistory, deleteMessageHistory)
  Container.listenAction(Chat2Gen.dismissJourneycard, dismissJourneycard)
  Container.listenAction(Chat2Gen.confirmScreenResponse, confirmScreenResponse)

  // Giphy
  Container.listenAction(Chat2Gen.unsentTextChanged, unsentTextChanged)

  Container.listenAction(Chat2Gen.unfurlResolvePrompt, unfurlResolvePrompt)
  Container.listenAction(Chat2Gen.unfurlResolvePrompt, unfurlDismissPrompt)
  Container.listenAction(Chat2Gen.unfurlRemove, unfurlRemove)

  Container.listenAction(Chat2Gen.previewConversation, previewConversationTeam)
  Container.listenAction(Chat2Gen.previewConversation, previewConversationPersonMakesAConversation)
  Container.listenAction(Chat2Gen.openFolder, openFolder)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.loadOnStartPhase === old.loadOnStartPhase) return
    switch (s.loadOnStartPhase) {
      case 'startupOrReloginButNotInARush': {
        // On login lets load the untrusted inbox. This helps make some flows easier
        if (ConfigConstants.useCurrentUserState.getState().username) {
          const {inboxRefresh} = Constants.useState.getState().dispatch
          inboxRefresh('bootstrap')
        }
        const f = async () => {
          const rows = await RPCTypes.configGuiGetValueRpcPromise({path: 'ui.inboxSmallRows'})
          const ri = rows?.i ?? -1
          if (ri > 0) {
            Constants.useState.getState().dispatch.setInboxNumSmallRows(ri, true)
          }
        }
        Z.ignorePromise(f())
        break
      }
      default:
    }
  })

  // Search handling
  Container.listenAction(Chat2Gen.attachmentPreviewSelect, attachmentPreviewSelect)
  Container.listenAction(Chat2Gen.attachmentDownload, attachmentDownload)
  Container.listenAction(Chat2Gen.attachmentsUpload, attachmentsUpload)
  Container.listenAction(Chat2Gen.attachFromDragAndDrop, attachFromDragAndDrop)
  Container.listenAction(Chat2Gen.attachmentPasted, attachmentPasted)
  Container.listenAction(Chat2Gen.attachmentUploadCanceled, attachmentUploadCanceled)

  Container.listenAction(Chat2Gen.sendTyping, sendTyping)
  Container.listenAction(Chat2Gen.resetChatWithoutThem, resetChatWithoutThem)
  Container.listenAction(Chat2Gen.resetLetThemIn, resetLetThemIn)

  Container.listenAction(
    [
      Chat2Gen.messagesAdd,
      Chat2Gen.updateUnreadline,
      Chat2Gen.markInitiallyLoadedThreadAsRead,
      Chat2Gen.updateReactions,
      Chat2Gen.tabSelected,
    ],
    (_, a) => markThreadAsRead(a)
  )
  Container.listenAction(Chat2Gen.markTeamAsRead, markTeamAsRead)
  Container.listenAction(Chat2Gen.leaveConversation, () => {
    RouterConstants.useState.getState().dispatch.clearModals()
  })
  Container.listenAction([Chat2Gen.navigateToInbox, Chat2Gen.leaveConversation], navigateToInbox)
  Container.listenAction(Chat2Gen.navigateToThread, navigateToThread)
  Container.listenAction(Chat2Gen.navigateToThread, (_, action) => {
    const {conversationIDKey} = action.payload
    Constants.getConvoState(conversationIDKey).dispatch.hideSearch()
  })

  Container.listenAction(Chat2Gen.joinConversation, joinConversation)
  Container.listenAction(Chat2Gen.leaveConversation, leaveConversation)

  Container.listenAction(Chat2Gen.updateNotificationSettings, updateNotificationSettings)
  Container.listenAction(Chat2Gen.blockConversation, blockConversation)
  Container.listenAction(Chat2Gen.hideConversation, hideConversation)
  Container.listenAction(Chat2Gen.unhideConversation, unhideConversation)

  Container.listenAction(Chat2Gen.setConvRetentionPolicy, setConvRetentionPolicy)
  Container.listenAction(Chat2Gen.toggleMessageCollapse, toggleMessageCollapse)
  Container.listenAction(Chat2Gen.createConversation, createConversation)
  Container.listenAction(Chat2Gen.messageReplyPrivately, messageReplyPrivately)
  Container.listenAction(Chat2Gen.openChatFromWidget, openChatFromWidget)

  Container.listenAction(Chat2Gen.toggleMessageReaction, toggleMessageReaction)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.badgeState === old.badgeState) return
    if (!s.badgeState) return
    s.badgeState.conversations?.forEach(c => {
      const id = Types.conversationIDToKey(c.convID)
      Constants.getConvoState(id).dispatch.badgesUpdated(c.badgeCount)
      Constants.getConvoState(id).dispatch.unreadUpdated(c.unreadMessages)
    })
    Constants.useState
      .getState()
      .dispatch.badgesUpdated(s.badgeState.bigTeamBadgeCount, s.badgeState.smallTeamBadgeCount)
  })

  Container.listenAction(Chat2Gen.setMinWriterRole, setMinWriterRole)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.gregorPushState === old.gregorPushState) return
    Constants.useState.getState().dispatch.updatedGregor(s.gregorPushState)
  })

  Container.listenAction(Chat2Gen.channelSuggestionsTriggered, (state, action) => {
    const {conversationIDKey} = action.payload
    const meta = Constants.getMeta(state, conversationIDKey)
    // If this is an impteam, try to refresh mutual team info
    if (!meta.teamname) {
      Constants.getConvoState(conversationIDKey).dispatch.refreshMutualTeamsInConv()
    }
  })

  Container.listenAction(Chat2Gen.fetchUserEmoji, fetchUserEmoji)

  Container.listenAction(Chat2Gen.addUsersToChannel, addUsersToChannel)
  Container.listenAction(Chat2Gen.addUserToChannel, addUserToChannel)

  Container.listenAction(EngineGen.chat1NotifyChatChatPromptUnfurl, onChatPromptUnfurl)
  Container.listenAction(
    EngineGen.chat1NotifyChatChatAttachmentUploadProgress,
    onChatAttachmentUploadProgress
  )
  Container.listenAction(EngineGen.chat1NotifyChatChatAttachmentUploadStart, onChatAttachmentUploadStart)
  Container.listenAction(EngineGen.chat1NotifyChatChatIdentifyUpdate, onChatIdentifyUpdate)
  Container.listenAction(EngineGen.chat1NotifyChatChatInboxSyncStarted, onChatInboxSyncStarted)
  Container.listenAction(EngineGen.chat1NotifyChatChatInboxSynced, onChatInboxSynced)
  Container.listenAction(EngineGen.chat1NotifyChatChatPaymentInfo, onChatPaymentInfo)
  Container.listenAction(EngineGen.chat1NotifyChatChatRequestInfo, onChatRequestInfo)
  Container.listenAction(EngineGen.chat1NotifyChatChatSetConvRetention, onChatSetConvRetention)
  Container.listenAction(EngineGen.chat1NotifyChatChatSetConvSettings, onChatSetConvSettings)
  Container.listenAction(EngineGen.chat1NotifyChatChatSetTeamRetention, onChatSetTeamRetention)
  Container.listenAction(EngineGen.chat1NotifyChatChatSubteamRename, onChatSubteamRename)
  Container.listenAction(EngineGen.chat1NotifyChatChatTLFFinalize, onChatChatTLFFinalizePayload)
  Container.listenAction(EngineGen.chat1NotifyChatChatThreadsStale, onChatThreadStale)
  Container.listenAction(EngineGen.chat1NotifyChatNewChatActivity, onNewChatActivity)
  Container.listenAction(EngineGen.chat1ChatUiChatGiphySearchResults, onGiphyResults)
  Container.listenAction(EngineGen.chat1ChatUiChatGiphyToggleResultWindow, onGiphyToggleWindow)
  Container.listenAction(EngineGen.chat1ChatUiChatShowManageChannels, (_, action) => {
    const {teamname} = action.payload.params
    const teamID = TeamsConstants.useState.getState().teamNameToID.get(teamname) ?? TeamsTypes.noTeamID
    TeamsConstants.useState.getState().dispatch.manageChatChannels(teamID)
  })
  Container.listenAction(EngineGen.chat1ChatUiChatCoinFlipStatus, (_, action) => {
    const {statuses} = action.payload.params
    Constants.useState.getState().dispatch.updateCoinFlipStatus(statuses || [])
  })
  Container.listenAction(EngineGen.chat1ChatUiChatCommandMarkdown, (_, action) => {
    const {convID, md} = action.payload.params
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    Constants.getConvoState(conversationIDKey).dispatch.setCommandMarkdown(md || undefined)
  })
  Container.listenAction(EngineGen.chat1ChatUiChatCommandStatus, (_, action) => {
    const {convID, displayText, typ, actions} = action.payload.params
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    Constants.getConvoState(conversationIDKey).dispatch.setCommandStatusInfo({
      actions: actions || [],
      displayText,
      displayType: typ,
    })
  })
  Container.listenAction(EngineGen.chat1ChatUiChatMaybeMentionUpdate, (_, action) => {
    const {teamName, channel, info} = action.payload.params
    Constants.useState
      .getState()
      .dispatch.setMaybeMentionInfo(Constants.getTeamMentionName(teamName, channel), info)
  })

  Container.listenAction(Chat2Gen.replyJump, onReplyJump)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    if (s.mobileAppState === 'background' && Constants.useState.getState().inboxSearch) {
      Constants.useState.getState().dispatch.toggleInboxSearch(false)
    }
  })

  Container.listenAction(Chat2Gen.resolveMaybeMention, resolveMaybeMention)

  Container.listenAction(Chat2Gen.pinMessage, pinMessage)
  Container.listenAction(Chat2Gen.unpinMessage, unpinMessage)
  Container.listenAction(Chat2Gen.ignorePinnedMessage, ignorePinnedMessage)

  Container.listenAction(Chat2Gen.selectedConversation, ensureSelectedMeta)

  Container.listenAction(Chat2Gen.selectedConversation, fetchConversationBio)

  Container.listenAction(Chat2Gen.sendAudioRecording, sendAudioRecording)

  Container.listenAction(Chat2Gen.dismissBlockButtons, dismissBlockButtons)

  Container.listenAction(EngineGen.chat1NotifyChatChatConvUpdate, onChatConvUpdate)

  Container.listenAction(EngineGen.chat1ChatUiChatBotCommandsUpdateStatus, (_, a) => {
    const {convID, status} = a.payload.params
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    Constants.getConvoState(conversationIDKey).dispatch.botCommandsUpdateStatus(status)
  })

  RouterConstants.useState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    maybeChangeChatSelection(prev, next)
    maybeChatTabSelected(prev, next)
  })

  Container.listenAction(Chat2Gen.deselectedConversation, updateDraftState)

  ConfigConstants.useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion === old.handshakeVersion) return
    Constants.useState.getState().dispatch.loadStaticConfig()
  })

  // TEMP bridging, todo move to constants
  Container.listenAction(Chat2Gen.metasReceived, (_, a) => {
    const {metas} = a.payload
    metas.forEach((m: Types.ConversationMeta) => {
      const cs = Constants.getConvoState(m.conversationIDKey)
      cs.dispatch.setDraft(m.draft)
      cs.dispatch.setMuted(m.isMuted)
    })
  })
  Container.listenAction(Chat2Gen.toggleGiphyPrefill, (_, a) => {
    const {conversationIDKey} = a.payload
    const giphyWindow = Constants.getConvoState(conversationIDKey).giphyWindow
    // if the window is up, just blow it away
    Constants.getConvoState(conversationIDKey).dispatch.setUnsentText(giphyWindow ? '' : '/giphy ')
  })

  Container.listenAction(EngineGen.chat1NotifyChatChatParticipantsInfo, (_, a) => {
    const {participants: participantMap} = a.payload.params
    Object.keys(participantMap).forEach(convIDStr => {
      const participants = participantMap[convIDStr]
      const conversationIDKey = Types.stringToConversationIDKey(convIDStr)
      if (participants) {
        Constants.getConvoState(conversationIDKey).dispatch.setParticipants(
          Constants.uiParticipantsToParticipantInfo(participants)
        )
      }
    })
  })

  Container.listenAction(EngineGen.chat1NotifyChatChatAttachmentDownloadProgress, (_, a) => {
    const {convID, msgID, bytesComplete, bytesTotal} = a.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const ratio = bytesComplete / bytesTotal
    Constants.getConvoState(conversationIDKey).dispatch.updateAttachmentViewTransfer(msgID, ratio)
  })

  Container.listenAction(Chat2Gen.attachmentDownloaded, (_, a) => {
    const {message, path} = a.payload
    const {conversationIDKey} = message
    Constants.getConvoState(conversationIDKey).dispatch.updateAttachmentViewTransfered(message.id, path ?? '')
  })

  Container.listenAction(
    [Chat2Gen.replyJump, Chat2Gen.jumpToRecent, Chat2Gen.selectedConversation],
    (_, a) => {
      const {conversationIDKey} = a.payload
      Constants.getConvoState(conversationIDKey).dispatch.setMessageCenterOrdinal()
    }
  )

  Container.listenAction(Chat2Gen.messagesAdd, (_, a) => {
    a.payload.centeredMessageIDs?.forEach(cm => {
      const ordinal = Types.numberToOrdinal(Types.messageIDToNumber(cm.messageID))
      Constants.getConvoState(cm.conversationIDKey).dispatch.setMessageCenterOrdinal({
        highlightMode: cm.highlightMode,
        ordinal,
      })
    })
  })

  Container.listenAction(Chat2Gen.selectedConversation, (state, a) => {
    const {conversationIDKey} = a.payload
    Constants.getConvoState(conversationIDKey).dispatch.setContainsLatestMessage(true)
    const {readMsgID, maxVisibleMsgID} =
      state.chat2.metaMap.get(conversationIDKey) ?? Constants.makeConversationMeta()
    logger.info(
      `rootReducer: selectConversation: setting orange line: convID: ${conversationIDKey} maxVisible: ${maxVisibleMsgID} read: ${readMsgID}`
    )
    if (maxVisibleMsgID > readMsgID) {
      // Store the message ID that will display the orange line above it,
      // which is the first message after the last read message. We can't
      // just increment `readMsgID` since that msgID might be a
      // non-visible (edit, delete, reaction...) message so we scan the
      // ordinals for the appropriate value.
      const messageMap = state.chat2.messageMap.get(conversationIDKey)
      const ordinals = state.chat2.messageOrdinals.get(conversationIDKey) ?? []
      const ord =
        messageMap &&
        ordinals.find(o => {
          const message = messageMap.get(o)
          return !!(message && message.id >= readMsgID + 1)
        })
      const message = ord ? messageMap?.get(ord) : null
      if (message?.id) {
        Constants.getConvoState(conversationIDKey).dispatch.setOrangeLine(message.id)
      } else {
        Constants.getConvoState(conversationIDKey).dispatch.setOrangeLine(0)
      }
    } else {
      // If there aren't any new messages, we don't want to display an
      // orange line so remove its entry from orangeLineMap
      Constants.getConvoState(conversationIDKey).dispatch.setOrangeLine(0)
    }
  })
}

export default initChat
