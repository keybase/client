import * as BotsGen from '../bots-gen'
import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/chat2'
import * as Container from '../../util/container'
import * as DeeplinksGen from '../deeplinks-gen'
import * as EngineGen from '../engine-gen-gen'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as GregorConstants from '../../constants/gregor'
import * as GregorGen from '../gregor-gen'
import * as NotificationsGen from '../notifications-gen'
import * as Platform from '../../constants/platform'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as Router2Constants from '../../constants/router2'
import * as Tabs from '../../constants/tabs'
import * as TeamBuildingGen from '../team-building-gen'
import * as TeamsConstants from '../../constants/teams'
import * as TeamsGen from '../teams-gen'
import * as TeamsTypes from '../../constants/types/teams'
import * as Types from '../../constants/types/chat2'
import * as UsersGen from '../users-gen'
import * as WaitingGen from '../waiting-gen'
import * as WalletTypes from '../../constants/types/wallets'
import * as WalletsGen from '../wallets-gen'
import {findLast} from '../../util/arrays'
import KB2 from '../../util/electron'
import NotifyPopup from '../../util/notify-popup'
import logger from '../../logger'
import {RPCError} from '../../util/errors'
import {commonListenActions, filterForNs} from '../team-building'
import {isIOS} from '../../constants/platform'
import {privateFolderWithUsers, teamFolder} from '../../constants/config'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '../platform-specific'

const {darwinCopyToChatTempUploadFile} = KB2.functions

const onConnect = async () => {
  try {
    await RPCTypes.delegateUiCtlRegisterChatUIRpcPromise()
    await RPCTypes.delegateUiCtlRegisterLogUIRpcPromise()
    console.log('Registered Chat UI')
  } catch (error) {
    console.warn('Error in registering Chat UI:', error)
  }
}

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
  // Check if some of our existing stored metas might no longer be valid
  return Chat2Gen.createMetasReceived({fromInboxRefresh: true, initialTrustedLoad: true, metas})
}

// Ask the service to refresh the inbox
const inboxRefresh = (
  state: Container.TypedState,
  action: Chat2Gen.InboxRefreshPayload | EngineGen.Chat1NotifyChatChatInboxStalePayload
) => {
  const {username, loggedIn} = state.config
  if (!loggedIn || !username) {
    return false
  }
  const actions: Array<Container.TypedActions> = []
  let reason: string = ''
  let clearExistingMetas = false
  let clearExistingMessages = false

  switch (action.type) {
    case Chat2Gen.inboxRefresh:
      reason = action.payload.reason
      clearExistingMetas = reason === 'inboxSyncedClear'
      clearExistingMessages = reason === 'inboxSyncedClear'
      break
    case EngineGen.chat1NotifyChatChatInboxStale:
      reason = 'inboxStale'
      break
    default:
  }

  logger.info(`Inbox refresh due to ${reason}`)
  if (clearExistingMetas) {
    actions.push(Chat2Gen.createClearMetas())
  }
  if (clearExistingMessages) {
    actions.push(Chat2Gen.createClearMessages())
  }
  const reselectMode =
    state.chat2.inboxHasLoaded || Container.isPhone
      ? RPCChatTypes.InboxLayoutReselectMode.default
      : RPCChatTypes.InboxLayoutReselectMode.force
  RPCChatTypes.localRequestInboxLayoutRpcPromise({reselectMode})
    .then(() => {})
    .catch(() => {})
  return actions
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
  const {infoMap} = state.users
  const actions: Array<Container.TypedActions> = []
  const {convs} = action.payload.params
  const inboxUIItems = JSON.parse(convs) as Array<RPCChatTypes.InboxUIItem>
  const metas: Array<Types.ConversationMeta> = []
  let added = false
  const usernameToFullname: {[username: string]: string} = {}
  const participants: Array<{
    conversationIDKey: Types.ConversationIDKey
    participants: Types.ParticipantInfo
  }> = []
  inboxUIItems.forEach(inboxUIItem => {
    const meta = Constants.inboxUIItemToConversationMeta(state, inboxUIItem)
    if (meta) {
      metas.push(meta)
    }
    const participantInfo: Types.ParticipantInfo = Constants.uiParticipantsToParticipantInfo(
      inboxUIItem.participants ?? []
    )
    if (participantInfo.all.length > 0) {
      participants.push({
        conversationIDKey: Types.stringToConversationIDKey(inboxUIItem.convID),
        participants: participantInfo,
      })
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
    actions.push(UsersGen.createUpdateFullnames({usernameToFullname}))
  }
  if (metas.length > 0) {
    actions.push(Chat2Gen.createMetasReceived({metas}))
  }
  if (participants.length > 0) {
    actions.push(Chat2Gen.createSetParticipants({participants}))
  }
  return actions
}

const onGetInboxConvFailed = (
  state: Container.TypedState,
  action: EngineGen.Chat1ChatUiChatInboxFailedPayload
) => {
  const {username} = state.config
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

const maybeChangeSelectedConv = (
  state: Container.TypedState,
  _: EngineGen.Chat1ChatUiChatInboxLayoutPayload
) => {
  const selectedConversation = Constants.getSelectedConversation()
  const {inboxLayout} = state.chat2
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
  if (!state.config.loggedIn) {
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
          username: state.config.username,
        })
      )
      return actions
    }

    const {containsLatestMessageMap} = state.chat2
    const shouldAddMessage = containsLatestMessageMap.get(conversationIDKey) || false

    const {username, getLastOrdinal, devicename} = Constants.getMessageStateExtras(state, conversationIDKey)
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
): Array<Container.TypedActions> => {
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
  return meta
    ? [Chat2Gen.createMetasReceived({metas: [meta]}), UsersGen.createUpdateFullnames({usernameToFullname})]
    : []
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
        arr.push(UsersGen.createUpdateBrokenState({newlyBroken: [tempForceRedBox], newlyFixed: []}))
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
  const newlyBroken: Array<string> = []
  const newlyFixed: Array<string> = []

  usernames.forEach(name => {
    if (broken.includes(name)) {
      newlyBroken.push(name)
    } else {
      newlyFixed.push(name)
    }
  })

  return UsersGen.createUpdateBrokenState({newlyBroken, newlyFixed})
}

// Get actions to update messagemap / metamap when retention policy expunge happens
const expungeToActions = (state: Container.TypedState, expunge: RPCChatTypes.ExpungeInfo) => {
  const actions: Array<Container.TypedActions> = []
  const conversationIDKey = Types.conversationIDToKey(expunge.convID)
  actions.push(
    Chat2Gen.createMessagesWereDeleted({
      conversationIDKey,
      deletableMessageTypes: Constants.getDeletableByDeleteHistory(state),
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
const reactionUpdateToActions = (info: RPCChatTypes.ReactionUpdateNotif): Array<Container.TypedActions> => {
  const conversationIDKey = Types.conversationIDToKey(info.convID)
  if (!info.reactionUpdates || info.reactionUpdates.length === 0) {
    logger.warn(`Got ReactionUpdateNotif with no reactionUpdates for convID=${conversationIDKey}`)
    return []
  }
  const updates = info.reactionUpdates.map(ru => ({
    reactions: Constants.reactionMapToReactions(ru.reactions),
    targetMsgID: ru.targetMsgID,
  }))
  logger.info(`Got ${updates.length} reaction updates for convID=${conversationIDKey}`)
  return [
    Chat2Gen.createUpdateReactions({conversationIDKey, updates}),
    Chat2Gen.createUpdateUserReacjis({userReacjis: info.userReacjis}),
  ]
}

const onChatPromptUnfurl = (_: unknown, action: EngineGen.Chat1NotifyChatChatPromptUnfurlPayload) => {
  const {convID, domain, msgID} = action.payload.params
  return Chat2Gen.createUnfurlTogglePrompt({
    conversationIDKey: Types.conversationIDToKey(convID),
    domain,
    messageID: Types.numberToMessageID(msgID),
    show: true,
  })
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

const onChatInboxSyncStarted = () =>
  WaitingGen.createIncrementWaiting({key: Constants.waitingKeyInboxSyncStarted})

// Service tells us it's done syncing
const onChatInboxSynced = (
  _state: Container.TypedState,
  action: EngineGen.Chat1NotifyChatChatInboxSyncedPayload
) => {
  const {syncRes} = action.payload.params
  const actions: Array<Container.TypedActions> = [
    WaitingGen.createClearWaiting({key: Constants.waitingKeyInboxSyncStarted}),
  ]

  switch (syncRes.syncType) {
    // Just clear it all
    case RPCChatTypes.SyncInboxResType.clear:
      actions.push(Chat2Gen.createInboxRefresh({reason: 'inboxSyncedClear'}))
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
      const removals = (
        (syncRes.incremental === null || syncRes.incremental === undefined
          ? undefined
          : syncRes.incremental.removals) || []
      ).map(Types.stringToConversationIDKey)
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
      actions.push(Chat2Gen.createInboxRefresh({reason: 'inboxSyncedUnknown'}))
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
  return Chat2Gen.createPaymentInfoReceived({conversationIDKey, messageID: msgID, paymentInfo})
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
  return Chat2Gen.createRequestInfoReceived({conversationIDKey, messageID: msgID, requestInfo})
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
    null
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

const onChatShowManageChannels = (
  state: Container.TypedState,
  action: EngineGen.Chat1ChatUiChatShowManageChannelsPayload
) => {
  const {teamname} = action.payload.params
  const teamID = state.teams.teamNameToID.get(teamname) ?? TeamsTypes.noTeamID
  return TeamsGen.createManageChatChannels({teamID})
}

const onNewChatActivity = (
  state: Container.TypedState,
  action: EngineGen.Chat1NotifyChatNewChatActivityPayload
) => {
  const {activity} = action.payload.params
  logger.info(`Got new chat activity of type: ${activity.activityType}`)
  let actions: Array<Container.TypedActions> = []
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
      actions = expungeToActions(state, activity.expunge)
      break
    }
    case RPCChatTypes.ChatActivityType.ephemeralPurge:
      actions = ephemeralPurgeToActions(activity.ephemeralPurge)
      break
    case RPCChatTypes.ChatActivityType.reactionUpdate:
      actions = reactionUpdateToActions(activity.reactionUpdate)
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

const loadThreadMessageTypes = Object.keys(RPCChatTypes.MessageType).reduce<Array<RPCChatTypes.MessageType>>(
  (arr, key) => {
    switch (key) {
      case 'none':
      case 'edit': // daemon filters this out for us so we can ignore
      case 'delete':
      case 'attachmentuploaded':
      case 'reaction':
      case 'unfurl':
      case 'tlfname':
        break
      default:
        {
          const val = RPCChatTypes.MessageType[key]
          if (typeof val === 'number') {
            arr.push(val)
          }
        }
        break
    }

    return arr
  },
  []
)

const reasonToRPCReason = (reason: string): RPCChatTypes.GetThreadReason => {
  switch (reason) {
    case 'extension':
    case 'push':
      return RPCChatTypes.GetThreadReason.push
    case 'foregrounding':
      return RPCChatTypes.GetThreadReason.foreground
    default:
      return RPCChatTypes.GetThreadReason.general
  }
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
const loadMoreMessages = async (
  state: Container.TypedState,
  action:
    | Chat2Gen.NavigateToThreadPayload
    | Chat2Gen.JumpToRecentPayload
    | Chat2Gen.LoadOlderMessagesDueToScrollPayload
    | Chat2Gen.LoadNewerMessagesDueToScrollPayload
    | Chat2Gen.LoadMessagesCenteredPayload
    | Chat2Gen.MarkConversationsStalePayload
    | ConfigGen.ChangedFocusPayload
    | Chat2Gen.TabSelectedPayload,
  listenerApi: Container.ListenerApi
) => {
  // Get the conversationIDKey
  let key: Types.ConversationIDKey | null = null
  let reason: string = ''
  let sd: ScrollDirection = 'none'
  let messageIDControl: RPCChatTypes.MessageIDControl | null = null
  let forceClear = false
  let forceContainsLatestCalc = false
  const knownRemotes: Array<string> = []
  const centeredMessageIDs: Array<{
    conversationIDKey: Types.ConversationIDKey
    messageID: Types.MessageID
    highlightMode: Types.CenterOrdinalHighlightMode
  }> = []

  switch (action.type) {
    case ConfigGen.changedFocus:
      if (!Container.isMobile || !action.payload.appFocused) {
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

  const meta = Constants.getMeta(state, conversationIDKey)

  if (meta.membershipType === 'youAreReset' || meta.rekeyers.size > 0) {
    logger.info('bail: we are reset')
    return
  }

  if (action.type === Chat2Gen.loadOlderMessagesDueToScroll) {
    if (!state.chat2.moreToLoadMap.get(conversationIDKey)) {
      logger.info('bail: scrolling back and at the end')
      return
    }
    sd = 'back'
    numberOfMessagesToLoad = Constants.numMessagesOnScrollback
  } else if (action.type === Chat2Gen.loadNewerMessagesDueToScroll) {
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

    const state = listenerApi.getState()
    const {username, getLastOrdinal, devicename} = Constants.getMessageStateExtras(state, conversationIDKey)
    const uiMessages: RPCChatTypes.UIMessages = JSON.parse(thread)
    let shouldClearOthers = false
    if ((forceClear || sd === 'none') && !calledClear) {
      shouldClearOthers = true
      calledClear = true
    }
    const messages = (uiMessages.messages ?? []).reduce<Array<Types.Message>>((arr, m) => {
      const message = conversationIDKey
        ? Constants.uiMessageToMessage(conversationIDKey, m, username, getLastOrdinal, devicename)
        : null
      if (message) {
        arr.push(message)
      }
      return arr
    }, [])

    // logger.info(`thread load ordinals ${messages.map(m => m.ordinal)}`)

    const moreToLoad = uiMessages.pagination ? !uiMessages.pagination.last : true
    listenerApi.dispatch(Chat2Gen.createUpdateMoreToLoad({conversationIDKey, moreToLoad}))

    if (messages.length) {
      listenerApi.dispatch(
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
    const results = await RPCChatTypes.localGetThreadNonblockRpcListener(
      {
        incomingCallMap: {
          'chat.1.chatUi.chatThreadCached': p => p && onGotThread(p.thread || ''),
          'chat.1.chatUi.chatThreadFull': p => p && onGotThread(p.thread || ''),
          'chat.1.chatUi.chatThreadStatus': p =>
            !!p && Chat2Gen.createSetThreadLoadStatus({conversationIDKey, status: p.status}),
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
            messageTypes: loadThreadMessageTypes,
          },
          reason: reasonToRPCReason(reason),
        },
        waitingKey: loadingKey,
      },
      listenerApi
    )
    listenerApi.dispatch(
      Chat2Gen.createSetConversationOffline({conversationIDKey, offline: results && results.offline})
    )
  } catch (error) {
    if (error instanceof RPCError) {
      logger.warn(error.desc)
      // no longer in team
      if (error.code === RPCTypes.StatusCode.scchatnotinteam) {
        return [
          Chat2Gen.createInboxRefresh({reason: 'maybeKickedFromTeam'}),
          Chat2Gen.createNavigateToInbox(),
        ]
      }
      if (error.code !== RPCTypes.StatusCode.scteamreaderror) {
        // scteamreaderror = user is not in team. they'll see the rekey screen so don't throw for that
        throw error
      }
    }
  }
  return
}

const getUnreadline = async (
  state: Container.TypedState,
  action: Chat2Gen.SelectedConversationPayload,
  listenerApi: Container.ListenerApi
) => {
  // Get the conversationIDKey
  let key: Types.ConversationIDKey | null = null
  switch (action.type) {
    case Chat2Gen.selectedConversation:
      key = action.payload.conversationIDKey
      break
    default:
      key = action.payload.conversationIDKey
  }

  if (!key || !Constants.isValidConversationIDKey(key)) {
    logger.info('Load unreadline bail: no conversationIDKey')
    return
  }

  const conversationIDKey = key
  const convID = Types.keyToConversationID(conversationIDKey)
  if (!convID) {
    logger.info('Load unreadline bail: invalid conversationIDKey')
    return
  }

  const {readMsgID} = state.chat2.metaMap.get(conversationIDKey) ?? Constants.makeConversationMeta()
  try {
    const unreadlineRes = await RPCChatTypes.localGetUnreadlineRpcPromise({
      convID,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      readMsgID: readMsgID < 0 ? 0 : readMsgID,
    })
    const unreadlineID = unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0
    logger.info(`marking unreadline ${conversationIDKey} ${unreadlineID}`)
    listenerApi.dispatch(
      Chat2Gen.createUpdateUnreadline({
        conversationIDKey,
        messageID: Types.numberToMessageID(unreadlineID),
      })
    )
    if (state.chat2.markedAsUnreadMap.get(conversationIDKey)) {
      listenerApi.dispatch(
        // Remove the force unread bit for the next time we view the thread.
        Chat2Gen.createClearMarkAsUnread({
          conversationIDKey,
        })
      )
    }
  } catch (error) {
    if (error instanceof RPCError) {
      if (error.code === RPCTypes.StatusCode.scchatnotinteam) {
        listenerApi.dispatch(Chat2Gen.createInboxRefresh({reason: 'maybeKickedFromTeam'}))
        listenerApi.dispatch(Chat2Gen.createNavigateToInbox())
      }
    }
    // ignore this error in general
  }
}

// Show a desktop notification
const desktopNotify = async (state: Container.TypedState, action: Chat2Gen.DesktopNotificationPayload) => {
  const {conversationIDKey, author, body} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)

  if (
    Constants.isUserActivelyLookingAtThisThread(state, conversationIDKey) ||
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
      resolve([
        Chat2Gen.createNavigateToInbox(),
        Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'desktopNotification'}),
        ConfigGen.createShowMain(),
      ])
    }
    const onClose = () => {
      resolve([])
    }
    logger.info('invoking NotifyPopup for chat notification')
    NotifyPopup(title, {body, sound: state.config.notifySound}, -1, author, onClick, onClose)
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

const clearMessageSetEditing = (_: unknown, action: Chat2Gen.MessageEditPayload) =>
  Chat2Gen.createMessageSetEditing({
    conversationIDKey: action.payload.conversationIDKey,
    ordinal: null,
  })

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
      listenerApi.dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null}))
      return
    } else if (message.type === 'attachment' && message.title === text.stringValue()) {
      listenerApi.dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null}))
      return
    }
    const meta = Constants.getMeta(state, conversationIDKey)
    const tlfName = meta.tlfname
    const clientPrev = Constants.getClientPrev(state, conversationIDKey)
    const outboxID = Constants.generateOutboxID()
    const target = {
      messageID: message.id,
      outboxID: message.outboxID ? Types.outboxIDToRpcOutboxID(message.outboxID) : null,
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

const loadAttachmentView = async (
  _: Container.TypedState,
  action: Chat2Gen.LoadAttachmentViewPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, viewType, fromMsgID} = action.payload
  try {
    const res = await RPCChatTypes.localLoadGalleryRpcListener(
      {
        incomingCallMap: {
          'chat.1.chatUi.chatLoadGalleryHit': (
            hit: RPCChatTypes.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam']
          ) => {
            const state = listenerApi.getState()
            const {username, getLastOrdinal, devicename} = Constants.getMessageStateExtras(
              state,
              conversationIDKey
            )
            const message = Constants.uiMessageToMessage(
              conversationIDKey,
              hit.message,
              username,
              getLastOrdinal,
              devicename
            )

            if (message) {
              return Chat2Gen.createAddAttachmentViewMessage({conversationIDKey, message, viewType})
            }
            return false
          },
        },
        params: {
          convID: Types.keyToConversationID(conversationIDKey),
          fromMsgID,
          num: 50,
          typ: viewType,
        },
      },
      listenerApi
    )

    listenerApi.dispatch(
      Chat2Gen.createSetAttachmentViewStatus({conversationIDKey, last: res.last, status: 'success', viewType})
    )
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error('failed to load attachment view: ' + error.message)
      listenerApi.dispatch(
        Chat2Gen.createSetAttachmentViewStatus({conversationIDKey, status: 'error', viewType})
      )
    }
  }
}

const onToggleThreadSearch = async (
  state: Container.TypedState,
  action: Chat2Gen.ToggleThreadSearchPayload
) => {
  const visible = Constants.getThreadSearchInfo(state, action.payload.conversationIDKey).visible
  if (!visible) {
    await RPCChatTypes.localCancelActiveSearchRpcPromise()
  }
}

const threadSearch = async (
  state: Container.TypedState,
  action: Chat2Gen.ThreadSearchPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, query} = action.payload
  const {username, getLastOrdinal, devicename} = Constants.getMessageStateExtras(state, conversationIDKey)
  const onDone = () => Chat2Gen.createSetThreadSearchStatus({conversationIDKey, status: 'done'})
  try {
    await RPCChatTypes.localSearchInboxRpcListener(
      {
        incomingCallMap: {
          'chat.1.chatUi.chatSearchDone': onDone,
          'chat.1.chatUi.chatSearchHit': hit => {
            const message = Constants.uiMessageToMessage(
              conversationIDKey,
              hit.searchHit.hitMessage,
              username,
              getLastOrdinal,
              devicename
            )
            return message
              ? Chat2Gen.createThreadSearchResults({clear: false, conversationIDKey, messages: [message]})
              : false
          },
          'chat.1.chatUi.chatSearchInboxDone': onDone,
          'chat.1.chatUi.chatSearchInboxHit': resp => {
            const messages = (resp.searchHit.hits || []).reduce<Array<Types.Message>>((l, h) => {
              const uiMsg = Constants.uiMessageToMessage(
                conversationIDKey,
                h.hitMessage,
                username,
                getLastOrdinal,
                devicename
              )
              if (uiMsg) {
                l.push(uiMsg)
              }
              return l
            }, [])
            return messages.length > 0
              ? Chat2Gen.createThreadSearchResults({clear: true, conversationIDKey, messages})
              : false
          },
          'chat.1.chatUi.chatSearchInboxStart': () =>
            Chat2Gen.createSetThreadSearchStatus({conversationIDKey, status: 'inprogress'}),
        },
        params: {
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          namesOnly: false,
          opts: {
            afterContext: 0,
            beforeContext: 0,
            convID: Types.keyToConversationID(conversationIDKey),
            isRegex: false,
            matchMentions: false,
            maxBots: 0,
            maxConvsHit: 0,
            maxConvsSearched: 0,
            maxHits: 1000,
            maxMessages: -1,
            maxNameConvs: 0,
            maxTeams: 0,
            reindexMode: RPCChatTypes.ReIndexingMode.postsearchSync,
            sentAfter: 0,
            sentBefore: 0,
            sentBy: '',
            sentTo: '',
            skipBotCache: false,
          },
          query: query.stringValue(),
        },
      },
      listenerApi
    )
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error('search failed: ' + error.message)
      listenerApi.dispatch(Chat2Gen.createSetThreadSearchStatus({conversationIDKey, status: 'done'}))
    }
  }
}

const onInboxSearchSelect = (state: Container.TypedState, action: Chat2Gen.InboxSearchSelectPayload) => {
  const {inboxSearch} = state.chat2
  if (!inboxSearch) {
    return
  }
  const selected = Constants.getInboxSearchSelected(inboxSearch)
  let {conversationIDKey, query} = action.payload
  if (!conversationIDKey) {
    conversationIDKey = selected?.conversationIDKey
  }

  if (!conversationIDKey) {
    return
  }
  if (!query) {
    query = selected?.query
  }

  return [
    Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxSearch'}),
    ...(query
      ? [
          Chat2Gen.createSetThreadSearchQuery({conversationIDKey, query}),
          Chat2Gen.createToggleThreadSearch({conversationIDKey}),
          Chat2Gen.createThreadSearch({conversationIDKey, query}),
        ]
      : [Chat2Gen.createToggleInboxSearch({enabled: false})]),
  ]
}

const onToggleInboxSearch = async (state: Container.TypedState) => {
  const {inboxSearch} = state.chat2
  if (!inboxSearch) {
    await RPCChatTypes.localCancelActiveInboxSearchRpcPromise()
    return
  }
  return inboxSearch.nameStatus === 'initial'
    ? Chat2Gen.createInboxSearch({query: new Container.HiddenString('')})
    : false
}

const onInboxSearchTextResult = (
  state: Container.TypedState,
  action: Chat2Gen.InboxSearchTextResultPayload
) =>
  !state.chat2.metaMap.get(action.payload.result.conversationIDKey)
    ? Chat2Gen.createMetaRequestTrusted({
        conversationIDKeys: [action.payload.result.conversationIDKey],
        force: true,
        reason: 'inboxSearchResults',
      })
    : undefined

const onInboxSearchNameResults = (
  state: Container.TypedState,
  action: Chat2Gen.InboxSearchNameResultsPayload
) => {
  const missingMetas = action.payload.results.reduce<Array<Types.ConversationIDKey>>((arr, r) => {
    if (!state.chat2.metaMap.get(r.conversationIDKey)) {
      arr.push(r.conversationIDKey)
    }
    return arr
  }, [])
  if (missingMetas.length > 0) {
    return Chat2Gen.createMetaRequestTrusted({
      conversationIDKeys: missingMetas,
      force: true,
      reason: 'inboxSearchResults',
    })
  }
  return false
}

const maybeCancelInboxSearchOnFocusChanged = (
  state: Container.TypedState,
  action: ConfigGen.MobileAppStatePayload
) => {
  const {inboxSearch} = state.chat2
  if (action.payload.nextAppState === 'background' && inboxSearch) {
    return Chat2Gen.createToggleInboxSearch({enabled: false})
  }
  return false
}

const inboxSearch = async (
  _: Container.TypedState,
  action: Chat2Gen.InboxSearchPayload,
  listenerApi: Container.ListenerApi
) => {
  const {query} = action.payload
  const teamType = (t: RPCChatTypes.TeamType) => (t === RPCChatTypes.TeamType.complex ? 'big' : 'small')

  const onConvHits = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam']) =>
    Chat2Gen.createInboxSearchNameResults({
      results: (resp.hits.hits || []).reduce<Array<Types.InboxSearchConvHit>>((arr, h) => {
        arr.push({
          conversationIDKey: Types.stringToConversationIDKey(h.convID),
          name: h.name,
          teamType: teamType(h.teamType),
        })
        return arr
      }, []),
      unread: resp.hits.unreadMatches,
    })

  const onOpenTeamHits = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['inParam']) =>
    Chat2Gen.createInboxSearchOpenTeamsResults({
      results: (resp.hits.hits || []).reduce<Array<Types.InboxSearchOpenTeamHit>>((arr, h) => {
        const {description, name, memberCount, inTeam} = h
        arr.push({
          description: description ?? '',
          inTeam,
          memberCount,
          name,
          publicAdmins: [],
        })
        return arr
      }, []),
      suggested: resp.hits.suggestedMatches,
    })

  const onBotsHits = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchBotHits']['inParam']) =>
    Chat2Gen.createInboxSearchBotsResults({
      results: resp.hits.hits || [],
      suggested: resp.hits.suggestedMatches,
    })

  const onTextHit = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']) => {
    const {convID, convName, hits, query, teamType: tt, time} = resp.searchHit
    return Chat2Gen.createInboxSearchTextResult({
      result: {
        conversationIDKey: Types.conversationIDToKey(convID),
        name: convName,
        numHits: hits?.length ?? 0,
        query,
        teamType: teamType(tt),
        time,
      },
    })
  }
  const onStart = () => Chat2Gen.createInboxSearchStarted()
  const onDone = () => Chat2Gen.createInboxSearchSetTextStatus({status: 'success'})

  const onIndexStatus = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam']) =>
    Chat2Gen.createInboxSearchSetIndexPercent({percent: resp.status.percentIndexed})

  try {
    await RPCChatTypes.localSearchInboxRpcListener(
      {
        incomingCallMap: {
          'chat.1.chatUi.chatSearchBotHits': onBotsHits,
          'chat.1.chatUi.chatSearchConvHits': onConvHits,
          'chat.1.chatUi.chatSearchInboxDone': onDone,
          'chat.1.chatUi.chatSearchInboxHit': onTextHit,
          'chat.1.chatUi.chatSearchInboxStart': onStart,
          'chat.1.chatUi.chatSearchIndexStatus': onIndexStatus,
          'chat.1.chatUi.chatSearchTeamHits': onOpenTeamHits,
        },
        params: {
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          namesOnly: false,
          opts: {
            afterContext: 0,
            beforeContext: 0,
            isRegex: false,
            matchMentions: false,
            maxBots: 10,
            maxConvsHit: Constants.inboxSearchMaxTextResults,
            maxConvsSearched: 0,
            maxHits: Constants.inboxSearchMaxTextMessages,
            maxMessages: -1,
            maxNameConvs:
              query.stringValue().length > 0
                ? Constants.inboxSearchMaxNameResults
                : Constants.inboxSearchMaxUnreadNameResults,
            maxTeams: 10,
            reindexMode: RPCChatTypes.ReIndexingMode.postsearchSync,
            sentAfter: 0,
            sentBefore: 0,
            sentBy: '',
            sentTo: '',
            skipBotCache: false,
          },
          query: query.stringValue(),
        },
      },
      listenerApi
    )
  } catch (error) {
    if (error instanceof RPCError) {
      if (!(error.code === RPCTypes.StatusCode.sccanceled)) {
        logger.error('search failed: ' + error.message)
        listenerApi.dispatch(Chat2Gen.createInboxSearchSetTextStatus({status: 'error'}))
      }
    }
  }
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
  const ephemeralLifetime = Constants.getConversationExplodingMode(state, conversationIDKey)
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
  const confirmRouteName = 'chatPaymentsConfirm'
  try {
    await RPCChatTypes.localPostTextNonblockRpcListener(
      {
        customResponseIncomingCallMap: {
          'chat.1.chatUi.chatStellarDataConfirm': ({summary}, response) => {
            storeStellarConfirmWindowResponse(false, response)
            return Chat2Gen.createSetPaymentConfirmInfo({summary})
          },
          'chat.1.chatUi.chatStellarDataError': ({error}, response) => {
            storeStellarConfirmWindowResponse(false, response)
            return Chat2Gen.createSetPaymentConfirmInfo({error})
          },
        },
        incomingCallMap: {
          'chat.1.chatUi.chatStellarDone': ({canceled}) => {
            const visibleScreen = Router2Constants.getVisibleScreen()
            if (visibleScreen && visibleScreen.name === confirmRouteName) {
              return RouteTreeGen.createClearModals()
            }
            if (canceled) {
              return Chat2Gen.createSetUnsentText({conversationIDKey, text})
            }
            return false
          },
          'chat.1.chatUi.chatStellarShowConfirm': () => [
            Chat2Gen.createClearPaymentConfirmInfo(),
            RouteTreeGen.createNavigateAppend({
              path: [confirmRouteName],
            }),
          ],
        },
        params: {
          ...ephemeralData,
          body: text.stringValue(),
          clientPrev,
          conversationID: Types.keyToConversationID(conversationIDKey),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          outboxID: null,
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
  if (state.chat2.blockButtonsMap.has(meta.teamID)) {
    listenerApi.dispatch(Chat2Gen.createDismissBlockButtons({teamID: meta.teamID}))
  }

  // Do some logging to track down the root cause of a bug causing
  // messages to not send. Do this after creating the objects above to
  // narrow down the places where the action can possibly stop.
  logger.info('non-empty text?', text.stringValue().length > 0)
}

const messageSendByUsernames = async (
  state: Container.TypedState,
  action: Chat2Gen.MessageSendByUsernamesPayload
) => {
  const tlfName = `${state.config.username},${action.payload.usernames}`
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
let _stellarConfirmWindowResponse: StellarConfirmWindowResponse | null = null

function storeStellarConfirmWindowResponse(accept: boolean, response: StellarConfirmWindowResponse | null) {
  _stellarConfirmWindowResponse?.result(accept)
  _stellarConfirmWindowResponse = response
}

const confirmScreenResponse = (_: unknown, action: Chat2Gen.ConfirmScreenResponsePayload) => {
  storeStellarConfirmWindowResponse(action.payload.accept, null)
}

// We always make adhoc convos and never preview it
const previewConversationPersonMakesAConversation = (
  state: Container.TypedState,
  action: Chat2Gen.PreviewConversationPayload
) => {
  const {participants, teamname, reason, highlightMessageID} = action.payload
  if (teamname) return false
  if (!participants) return false

  // if stellar just search first, could do others maybe
  if ((reason === 'requestedPayment' || reason === 'sentPayment') && participants.length === 1) {
    const username = state.config.username
    const toFind = participants[0]
    for (const [cid, p] of state.chat2.participantMap.entries()) {
      if (p.name.length === 2) {
        const other = p.name.filter(n => n !== username)
        if (other[0] === toFind) {
          return Chat2Gen.createNavigateToThread({
            conversationIDKey: cid,
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

const findGeneralConvIDFromTeamID = async (
  state: Container.TypedState,
  action: Chat2Gen.FindGeneralConvIDFromTeamIDPayload
) => {
  let conv: RPCChatTypes.InboxUIItem | undefined
  try {
    conv = await RPCChatTypes.localFindGeneralConvFromTeamIDRpcPromise({
      teamID: action.payload.teamID,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info(`findGeneralConvIDFromTeamID: failed to get general conv: ${error.message}`)
    }
    return
  }
  const meta = Constants.inboxUIItemToConversationMeta(state, conv)
  if (!meta) {
    logger.info(`findGeneralConvIDFromTeamID: failed to convert to meta`)
    return
  }
  return [
    Chat2Gen.createMetasReceived({metas: [meta]}),
    Chat2Gen.createSetGeneralConvFromTeamID({
      conversationIDKey: Types.stringToConversationIDKey(conv.convID),
      teamID: action.payload.teamID,
    }),
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
        return [
          DeeplinksGen.createSetKeybaseLinkError({
            error:
              "We couldn't find this team chat channel. Please check that you're a member of the team and the channel exists.",
          }),
          RouteTreeGen.createNavigateAppend({
            path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
          }),
        ]
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
      return [
        DeeplinksGen.createSetKeybaseLinkError({
          error:
            "We couldn't find this team. Please check that you're a member of the team and the channel exists.",
        }),
        RouteTreeGen.createNavigateAppend({
          path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
        }),
      ]
    } else {
      throw error
    }
  }
}

const startupInboxLoad = (state: Container.TypedState) =>
  !!state.config.username && Chat2Gen.createInboxRefresh({reason: 'bootstrap'})

const startupUserReacjisLoad = (_: unknown, action: ConfigGen.BootstrapStatusLoadedPayload) =>
  Chat2Gen.createUpdateUserReacjis({userReacjis: action.payload.userReacjis})

const openFolder = (state: Container.TypedState, action: Chat2Gen.OpenFolderPayload) => {
  const meta = Constants.getMeta(state, action.payload.conversationIDKey)
  const participantInfo = Constants.getParticipantInfo(state, action.payload.conversationIDKey)
  const path = FsTypes.stringToPath(
    meta.teamType !== 'adhoc' ? teamFolder(meta.teamname) : privateFolderWithUsers(participantInfo.name)
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

const attachmentPreviewSelect = (_: unknown, action: Chat2Gen.AttachmentPreviewSelectPayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [
      {
        props: {
          conversationIDKey: action.payload.conversationIDKey,
          ordinal: action.payload.ordinal,
        },
        selected: 'chatAttachmentFullscreen',
      },
    ],
  })

// Handle an image pasted into a conversation
const attachmentPasted = async (_: unknown, action: Chat2Gen.AttachmentPastedPayload) => {
  const {conversationIDKey, data} = action.payload
  const outboxID = Constants.generateOutboxID()
  const path = await RPCChatTypes.localMakeUploadTempFileRpcPromise({data, filename: 'paste.png', outboxID})

  const pathAndOutboxIDs = [{outboxID, path}]
  return RouteTreeGen.createNavigateAppend({
    path: [
      {props: {conversationIDKey, noDragDrop: true, pathAndOutboxIDs}, selected: 'chatAttachmentGetTitles'},
    ],
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
  const ephemeralLifetime = Constants.getConversationExplodingMode(state, conversationIDKey)
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
  const ephemeralLifetime = Constants.getConversationExplodingMode(state, conversationIDKey)
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
          filename: p.path,
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          metadata: Buffer.from([]),
          outboxID: outboxIDs[i],
          title: titles[i],
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
  const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
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

const markThreadAsRead = async (
  state: Container.TypedState,
  action:
    | Chat2Gen.MessagesAddPayload
    | Chat2Gen.UpdateUnreadlinePayload
    | Chat2Gen.MarkInitiallyLoadedThreadAsReadPayload
    | Chat2Gen.UpdateReactionsPayload
    | ConfigGen.ChangedFocusPayload
    | ConfigGen.ChangedActivePayload
    | Chat2Gen.TabSelectedPayload
) => {
  if (!state.config.loggedIn) {
    logger.info('bail on not logged in')
    return
  }
  const conversationIDKey = Constants.getSelectedConversation()

  if (!Constants.isValidConversationIDKey(conversationIDKey)) {
    logger.info('bail on no selected conversation')
    return
  }

  const meta = state.chat2.metaMap.get(conversationIDKey)

  if (action.type === Chat2Gen.markInitiallyLoadedThreadAsRead) {
    if (action.payload.conversationIDKey !== conversationIDKey) {
      logger.info('bail on not looking at this thread anymore?')
      return
    }
  }

  if (!Constants.isUserActivelyLookingAtThisThread(state, conversationIDKey)) {
    logger.info('bail on not looking at this thread')
    return
  }

  // Check to see if we do not have the latest message, and don't mark anything as read in that case
  // If we have no information at all, then just mark as read
  if (
    !state.chat2.containsLatestMessageMap.has(conversationIDKey) ||
    !state.chat2.containsLatestMessageMap.get(conversationIDKey)
  ) {
    logger.info('bail on not containing latest message')
    return
  }

  let message: Types.Message | undefined
  const mmap = state.chat2.messageMap.get(conversationIDKey)
  if (mmap) {
    const ordinals = Constants.getMessageOrdinals(state, conversationIDKey)
    const ordinal = findLast([...ordinals], (o: Types.Ordinal) => {
      const m = mmap.get(o)
      return m ? !!m.id : false
    })
    message = ordinal ? mmap.get(ordinal) : undefined
  }

  let readMsgID: number | null = null
  if (meta) {
    readMsgID = message ? (message.id > meta.maxMsgID ? message.id : meta.maxMsgID) : meta.maxMsgID
  }
  if (action.type === Chat2Gen.updateUnreadline && readMsgID && readMsgID >= action.payload.messageID) {
    // If we are marking as unread, don't send the local RPC.
    return
  }

  logger.info(`marking read messages ${conversationIDKey} ${readMsgID} for ${action.type}`)
  await RPCChatTypes.localMarkAsReadLocalRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    forceUnread: false,
    msgID: readMsgID,
  })
}

const markAsUnread = async (
  state: Container.TypedState,
  action: Chat2Gen.MarkAsUnreadPayload,
  listenerApi: Container.ListenerApi
) => {
  if (!state.config.loggedIn) {
    logger.info('bail on not logged in')
    return
  }
  const {conversationIDKey, readMsgID} = action.payload
  const meta = state.chat2.metaMap.get(conversationIDKey)
  const unreadLineID = readMsgID ? readMsgID : meta ? meta.maxVisibleMsgID : 0
  let msgID = unreadLineID

  // Find first visible message prior to what we have marked as unread. The
  // server will use this value to calculate our badge state.
  const messageMap = state.chat2.messageMap.get(conversationIDKey)

  if (messageMap) {
    const ordinals = state.chat2.messageOrdinals.get(conversationIDKey) ?? []
    const ord =
      messageMap &&
      findLast([...ordinals], (o: Types.Ordinal) => {
        const message = messageMap.get(o)
        return !!(message && message.id < unreadLineID)
      })
    const message = ord ? messageMap?.get(ord) : null
    if (message) {
      msgID = message.id
    }
  } else {
    const pagination = {
      last: false,
      next: '',
      num: 2, // we need 2 items
      previous: '',
    }
    try {
      await new Promise<void>(resolve => {
        const onGotThread = (p: any) => {
          try {
            const d = JSON.parse(p)
            msgID = d?.messages[1]?.valid?.messageID
            resolve()
          } catch {}
        }
        RPCChatTypes.localGetThreadNonblockRpcListener(
          {
            incomingCallMap: {
              'chat.1.chatUi.chatThreadCached': p => p && onGotThread(p.thread || ''),
              'chat.1.chatUi.chatThreadFull': p => p && onGotThread(p.thread || ''),
            },
            params: {
              cbMode: RPCChatTypes.GetThreadNonblockCbMode.incremental,
              conversationID: Types.keyToConversationID(conversationIDKey),
              identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
              knownRemotes: [],
              pagination,
              pgmode: RPCChatTypes.GetThreadNonblockPgMode.server,
              query: {
                disablePostProcessThread: false,
                disableResolveSupersedes: false,
                enableDeletePlaceholders: true,
                markAsRead: false,
                messageIDControl: null,
                messageTypes: loadThreadMessageTypes,
              },
              reason: reasonToRPCReason(''),
            },
          },
          listenerApi
        )
          .then(() => {})
          .catch(() => {
            resolve()
          })
      })
    } catch {}
  }

  if (!msgID) {
    logger.info(`marking unread messages ${conversationIDKey} failed due to no id`)
    return
  }

  logger.info(`marking unread messages ${conversationIDKey} ${msgID}`)
  RPCChatTypes.localMarkAsReadLocalRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    forceUnread: true,
    msgID,
  })
    .then(() => {})
    .catch(() => {})
  return Chat2Gen.createUpdateUnreadline({
    conversationIDKey,
    messageID: unreadLineID,
  })
}

const markTeamAsRead = async (state: Container.TypedState, action: Chat2Gen.MarkTeamAsReadPayload) => {
  if (!state.config.loggedIn) {
    logger.info('bail on not logged in')
    return
  }
  const tlfID = Buffer.from(TeamsTypes.teamIDToString(action.payload.teamID), 'hex')
  await RPCChatTypes.localMarkTLFAsReadLocalRpcPromise({
    tlfID,
  })
}

const messagesAdd = (state: Container.TypedState, _action: Chat2Gen.MessagesAddPayload) => {
  if (!state.config.loggedIn) {
    logger.info('bail on not logged in')
    return
  }
  const actions = Array.from(state.chat2.shouldDeleteZzzJourneycard.entries()).map(([cid, jc]) =>
    Chat2Gen.createMessagesWereDeleted({
      conversationIDKey: cid,
      ordinals: [jc.ordinal],
    })
  )
  return actions
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

// Get the list of mutual teams if we need to.
const loadSuggestionData = (
  state: Container.TypedState,
  action: Chat2Gen.ChannelSuggestionsTriggeredPayload
) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  // If this is an impteam, try to refresh mutual team info
  if (!meta.teamname) {
    return Chat2Gen.createRefreshMutualTeamsInConv({conversationIDKey})
  }
  return false
}

const refreshMutualTeamsInConv = async (
  state: Container.TypedState,
  action: Chat2Gen.RefreshMutualTeamsInConvPayload
) => {
  const {conversationIDKey} = action.payload
  const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
  const otherParticipants = Constants.getRowParticipants(participantInfo, state.config.username || '')
  const results = await RPCChatTypes.localGetMutualTeamsLocalRpcPromise(
    {usernames: otherParticipants},
    Constants.waitingKeyMutualTeams(conversationIDKey)
  )
  return Chat2Gen.createLoadedMutualTeams({conversationIDKey, teamIDs: results.teamIDs ?? []})
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
  return Chat2Gen.createLoadedUserEmoji({results})
}

const clearModalsFromConvEvent = () => RouteTreeGen.createClearModals()

// Helpers to nav you to the right place
const navigateToInbox = (
  _: unknown,
  action:
    | Chat2Gen.NavigateToInboxPayload
    | Chat2Gen.LeaveConversationPayload
    | TeamsGen.LeftTeamPayload
    | TeamsGen.DeleteChannelConfirmedPayload
) => {
  if (action.type === Chat2Gen.leaveConversation && action.payload.dontNavigateToInbox) {
    return
  }
  if (action.type === TeamsGen.leftTeam && action.payload.context !== 'chat') {
    return
  }
  return [
    RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}),
    RouteTreeGen.createNavUpToScreen({name: 'chatRoot'}),
  ]
}

const navigateToThread = (_: unknown, action: Chat2Gen.NavigateToThreadPayload) => {
  const {conversationIDKey, reason} = action.payload
  // don't nav if its caused by a nav
  if (reason === 'navChanged') {
    return
  }
  const visible = Router2Constants.getVisibleScreen()
  // @ts-ignore TODO better types
  const visibleConvo: Types.ConversationIDKey | undefined = visible?.params?.conversationIDKey
  const visibleRouteName = visible?.name

  if (visibleRouteName !== Constants.threadRouteName && reason === 'findNewestConversation') {
    // service is telling us to change our selection but we're not looking, ignore
    return false
  }

  const modalPath = Router2Constants.getModalStack()
  const modalClearAction = modalPath.length > 0 ? [RouteTreeGen.createClearModals()] : []

  // we select the chat tab and change the params
  if (Constants.isSplit) {
    Router2Constants.navToThread(conversationIDKey)
    return false
  } else {
    // immediately switch stack to an inbox | thread stack
    if (reason === 'push' || reason === 'savedLastState') {
      Router2Constants.navToThread(conversationIDKey)
      return false
    } else {
      // replace if looking at the pending / waiting screen
      const replace =
        visibleRouteName === Constants.threadRouteName &&
        !Constants.isValidConversationIDKey(visibleConvo ?? '')
      // note: we don't switch tabs on non split
      return [
        ...modalClearAction,
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey}, selected: Constants.threadRouteName}],
          replace,
        }),
      ]
    }
  }
}

const maybeLoadTeamFromMeta = (meta: Types.ConversationMeta) => {
  const {teamID} = meta
  return meta.teamname ? TeamsGen.createGetMembers({teamID}) : false
}

const ensureSelectedTeamLoaded = (
  state: Container.TypedState,
  action: Chat2Gen.SelectedConversationPayload | Chat2Gen.MetasReceivedPayload
) => {
  const selectedConversation = Constants.getSelectedConversation()
  const meta = state.chat2.metaMap.get(selectedConversation)
  return meta
    ? action.type === Chat2Gen.selectedConversation || !state.teams.teamIDToMembers.get(meta.teamID)
      ? maybeLoadTeamFromMeta(meta)
      : false
    : false
}

const ensureSelectedMeta = (state: Container.TypedState, action: Chat2Gen.SelectedConversationPayload) => {
  const {conversationIDKey} = action.payload
  const {metaMap} = state.chat2
  const meta = metaMap.get(conversationIDKey)
  const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
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
  const {inboxLayout, metaMap} = state.chat2
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
    listenerApi.dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              message,
              // Prepend the 'file://' prefix here. Otherwise when webview
              // automatically does that, it triggers onNavigationStateChange
              // with the new address and we'd call stoploading().
              url: 'file://' + filePath,
            },
            selected: 'chatPDF',
          },
        ],
      })
    )
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

const fetchConversationBio = (state: Container.TypedState, action: Chat2Gen.SelectedConversationPayload) => {
  const {conversationIDKey} = action.payload
  const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
  const otherParticipants = Constants.getRowParticipants(participantInfo, state.config.username || '')
  if (otherParticipants.length === 1) {
    // we're in a one-on-one convo
    const username = otherParticipants[0] || ''

    // if this is an SBS/phone/email convo or we get a garbage username, don't do anything
    if (username === '' || username.includes('@')) {
      return
    }

    return UsersGen.createGetBio({username})
  }
  return false
}

const leaveConversation = async (_: unknown, action: Chat2Gen.LeaveConversationPayload) => {
  await RPCChatTypes.localLeaveConversationLocalRpcPromise(
    {
      convID: Types.keyToConversationID(action.payload.conversationIDKey),
    },
    Constants.waitingKeyLeaveConversation
  )
}

const muteConversation = async (_: unknown, action: Chat2Gen.MuteConversationPayload) => {
  const {muted, conversationIDKey} = action.payload
  await RPCChatTypes.localSetConversationStatusLocalRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    status: muted ? RPCChatTypes.ConversationStatus.muted : RPCChatTypes.ConversationStatus.unfiled,
  })
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
  listenerApi.dispatch(ConfigGen.createPersistRoute({}))
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
  listenerApi.dispatch(Chat2Gen.createShowInfoPanel({show: false}))
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
  let policy: RPCChatTypes.RetentionPolicy | null
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
  const {username} = state.config
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

      const participants: Array<{
        conversationIDKey: Types.ConversationIDKey
        participants: Types.ParticipantInfo
      }> = []

      const participantInfo: Types.ParticipantInfo = Constants.uiParticipantsToParticipantInfo(
        uiConv.participants ?? []
      )
      if (participantInfo.all.length > 0) {
        participants.push({
          conversationIDKey: Types.stringToConversationIDKey(uiConv.convID),
          participants: participantInfo,
        })
      }
      if (participants.length > 0) {
        listenerApi.dispatch(Chat2Gen.createSetParticipants({participants}))
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
        const {value} = errUsernames[0]
        disallowedUsers = value.split(',')
      }
      const allowedUsers = action.payload.participants.filter(x => !disallowedUsers?.includes(x))
      listenerApi.dispatch(
        Chat2Gen.createConversationErrored({
          allowedUsers,
          code: error.code,
          disallowedUsers,
          message: error.desc,
        })
      )
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

  const {username} = state.config
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

  return [
    Chat2Gen.createMetasReceived({metas: [meta]}),
    Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'createdMessagePrivately'}),
    Chat2Gen.createSetUnsentText({conversationIDKey, text}),
  ]
}

// don't bug the users with black bars for network errors. chat isn't going to work in general
const ignoreErrors = [
  RPCTypes.StatusCode.scgenericapierror,
  RPCTypes.StatusCode.scapinetworkerror,
  RPCTypes.StatusCode.sctimeout,
]
const setConvExplodingMode = async (
  state: Container.TypedState,
  action: Chat2Gen.SetConvExplodingModePayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, seconds} = action.payload
  logger.info(`Setting exploding mode for conversation ${conversationIDKey} to ${seconds}`)

  // unset a conversation exploding lock for this convo so we accept the new one
  listenerApi.dispatch(Chat2Gen.createSetExplodingModeLock({conversationIDKey, unset: true}))

  const category = Constants.explodingModeGregorKey(conversationIDKey)
  const meta = Constants.getMeta(state, conversationIDKey)
  const convRetention = Constants.getEffectiveRetentionPolicy(meta)
  if (seconds === 0 || seconds === convRetention.seconds) {
    // dismiss the category so we don't leave cruft in the push state
    await RPCTypes.gregorDismissCategoryRpcPromise({category})
  } else {
    // update the category with the exploding time
    try {
      await RPCTypes.gregorUpdateCategoryRpcPromise({
        body: seconds.toString(),
        category,
        dtime: {offset: 0, time: 0},
      })
      if (seconds !== 0) {
        logger.info(`Successfully set exploding mode for conversation ${conversationIDKey} to ${seconds}`)
      } else {
        logger.info(`Successfully unset exploding mode for conversation ${conversationIDKey}`)
      }
    } catch (error) {
      if (error instanceof RPCError) {
        if (seconds !== 0) {
          logger.error(
            `Failed to set exploding mode for conversation ${conversationIDKey} to ${seconds}. Service responded with: ${error.message}`
          )
        } else {
          logger.error(
            `Failed to unset exploding mode for conversation ${conversationIDKey}. Service responded with: ${error.message}`
          )
        }
        if (ignoreErrors.includes(error.code)) {
          return
        }
      }
      throw error
    }
  }
}

const loadStaticConfig = async (
  state: Container.TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  listenerApi: Container.ListenerApi
) => {
  if (state.chat2.staticConfig) {
    return
  }
  const {version} = action.payload
  listenerApi.dispatch(
    ConfigGen.createDaemonHandshakeWait({increment: true, name: 'chat.loadStatic', version})
  )
  const res = await RPCChatTypes.localGetStaticConfigRpcPromise()
  if (!res.deletableByDeleteHistory) {
    logger.error('chat.loadStaticConfig: got no deletableByDeleteHistory in static config')
    return
  }
  const deletableByDeleteHistory = res.deletableByDeleteHistory.reduce<Array<Types.MessageType>>(
    (res, type) => {
      const ourTypes = Constants.serviceMessageTypeToMessageTypes(type)
      if (ourTypes) {
        res.push(...ourTypes)
      }
      return res
    },
    []
  )
  listenerApi.dispatch(
    Chat2Gen.createStaticConfigLoaded({
      staticConfig: {
        builtinCommands: (res.builtinCommands || []).reduce<Types.StaticConfig['builtinCommands']>(
          (map, c) => {
            map[c.typ] = c.commands || []
            return map
          },
          {
            [RPCChatTypes.ConversationBuiltinCommandTyp.none]: [],
            [RPCChatTypes.ConversationBuiltinCommandTyp.adhoc]: [],
            [RPCChatTypes.ConversationBuiltinCommandTyp.smallteam]: [],
            [RPCChatTypes.ConversationBuiltinCommandTyp.bigteam]: [],
            [RPCChatTypes.ConversationBuiltinCommandTyp.bigteamgeneral]: [],
          }
        ),
        deletableByDeleteHistory: new Set(deletableByDeleteHistory),
      },
    })
  )

  listenerApi.dispatch(
    ConfigGen.createDaemonHandshakeWait({increment: false, name: 'chat.loadStatic', version})
  )
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

const receivedBadgeState = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  Chat2Gen.createBadgesUpdated({
    bigTeamBadgeCount: action.payload.badgeState.bigTeamBadgeCount,
    conversations: action.payload.badgeState.conversations || [],
    smallTeamBadgeCount: action.payload.badgeState.smallTeamBadgeCount,
  })

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
  return Chat2Gen.createUnfurlTogglePrompt({
    conversationIDKey,
    domain,
    messageID,
    show: false,
  })
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
  return Chat2Gen.createGiphyGotSearchResult({
    conversationIDKey: Types.stringToConversationIDKey(convID),
    results,
  })
}

const onGiphyToggleWindow = (_: unknown, action: EngineGen.Chat1ChatUiChatGiphyToggleResultWindowPayload) => {
  const {convID, show, clearInput} = action.payload.params
  return Chat2Gen.createGiphyToggleWindow({
    clearInput,
    conversationIDKey: Types.stringToConversationIDKey(convID),
    show,
  })
}

const giphySend = (state: Container.TypedState, action: Chat2Gen.GiphySendPayload) => {
  const {conversationIDKey, url} = action.payload
  const replyTo = Constants.getReplyToMessageID(state, conversationIDKey)
  return Chat2Gen.createMessageSend({conversationIDKey, replyTo: replyTo || undefined, text: url})
}

const onChatCoinFlipStatus = (_: unknown, action: EngineGen.Chat1ChatUiChatCoinFlipStatusPayload) => {
  const {statuses} = action.payload.params
  return Chat2Gen.createUpdateCoinFlipStatus({statuses: statuses || []})
}

const onChatCommandMarkdown = (_: unknown, action: EngineGen.Chat1ChatUiChatCommandMarkdownPayload) => {
  const {convID, md} = action.payload.params
  return Chat2Gen.createSetCommandMarkdown({
    conversationIDKey: Types.stringToConversationIDKey(convID),
    md: md || null,
  })
}

const onChatCommandStatus = (_: unknown, action: EngineGen.Chat1ChatUiChatCommandStatusPayload) => {
  const {convID, displayText, typ, actions} = action.payload.params
  return Chat2Gen.createSetCommandStatusInfo({
    conversationIDKey: Types.stringToConversationIDKey(convID),
    info: {
      actions: actions || [],
      displayText,
      displayType: typ,
    },
  })
}

const onChatMaybeMentionUpdate = (_: unknown, action: EngineGen.Chat1ChatUiChatMaybeMentionUpdatePayload) => {
  const {teamName, channel, info} = action.payload.params
  return Chat2Gen.createSetMaybeMentionInfo({
    info,
    name: Constants.getTeamMentionName(teamName, channel),
  })
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

const onUpdateLastCoord = async (_: unknown, action: Chat2Gen.UpdateLastCoordPayload) => {
  const {accuracy, lat, lon} = action.payload.coord
  await RPCChatTypes.localLocationUpdateRpcPromise({coord: {accuracy, lat, lon}})
}

const openChatFromWidget = (
  _: unknown,
  {payload: {conversationIDKey}}: Chat2Gen.OpenChatFromWidgetPayload
) => [
  ConfigGen.createShowMain(),
  Chat2Gen.createNavigateToThread({
    conversationIDKey: conversationIDKey ?? Constants.noConversationIDKey,
    reason: 'inboxSmall',
  }),
]

const gregorPushState = (state: Container.TypedState, action: GregorGen.PushStatePayload) => {
  const actions: Array<Container.TypedActions> = []
  const items = action.payload.state

  const explodingItems = items.filter(i => i.item.category.startsWith(Constants.explodingModeGregorKeyPrefix))
  if (!explodingItems.length) {
    // No conversations have exploding modes, clear out what is set
    actions.push(Chat2Gen.createUpdateConvExplodingModes({modes: []}))
  } else {
    logger.info('Got push state with some exploding modes')
    const modes = explodingItems.reduce<Array<{conversationIDKey: Types.ConversationIDKey; seconds: number}>>(
      (current, i) => {
        try {
          const {category, body} = i.item
          const secondsString = Buffer.from(body).toString()
          const seconds = parseInt(secondsString, 10)
          if (isNaN(seconds)) {
            logger.warn(`Got dirty exploding mode ${secondsString} for category ${category}`)
            return current
          }
          const _conversationIDKey = category.substring(Constants.explodingModeGregorKeyPrefix.length)
          const conversationIDKey = Types.stringToConversationIDKey(_conversationIDKey)
          current.push({conversationIDKey, seconds})
        } catch (e) {
          logger.info('Error parsing exploding' + e)
        }
        return current
      },
      []
    )
    actions.push(Chat2Gen.createUpdateConvExplodingModes({modes}))
  }

  const blockButtons = items.some(i => i.item.category.startsWith(Constants.blockButtonsGregorPrefix))
  if (blockButtons || state.chat2.blockButtonsMap.size > 0) {
    const shouldKeepExistingBlockButtons = new Map<string, boolean>()
    state.chat2.blockButtonsMap.forEach((_, teamID: string) =>
      shouldKeepExistingBlockButtons.set(teamID, false)
    )
    items
      .filter(i => i.item.category.startsWith(Constants.blockButtonsGregorPrefix))
      .forEach(i => {
        try {
          const teamID = i.item.category.substring(Constants.blockButtonsGregorPrefix.length)
          if (!state.chat2.blockButtonsMap.get(teamID)) {
            const body = GregorConstants.bodyToJSON(i.item.body) as {adder: string}
            const adder = body.adder
            actions.push(Chat2Gen.createUpdateBlockButtons({adder, show: true, teamID}))
          } else {
            shouldKeepExistingBlockButtons.set(teamID, true)
          }
        } catch (e) {
          logger.info('block buttons parse fail', e)
        }
      })
    shouldKeepExistingBlockButtons.forEach((keep, teamID) => {
      if (!keep) {
        actions.push(Chat2Gen.createUpdateBlockButtons({show: false, teamID}))
      }
    })
  }
  return actions
}

const prepareFulfillRequestForm = (
  state: Container.TypedState,
  action: Chat2Gen.PrepareFulfillRequestFormPayload
) => {
  const {conversationIDKey, ordinal} = action.payload
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
  if (!message) {
    logger.error(
      `prepareFulfillRequestForm: couldn't find message. convID=${conversationIDKey} ordinal=${Types.ordinalToNumber(
        ordinal
      )}`
    )
    return
  }
  if (message.type !== 'requestPayment') {
    logger.error(
      `prepareFulfillRequestForm: got message with incorrect type '${
        message.type
      }', expected 'requestPayment'. convID=${conversationIDKey} ordinal=${Types.ordinalToNumber(ordinal)}`
    )
    return
  }
  const requestInfo = Constants.getRequestMessageInfo(state, message)
  if (!requestInfo) {
    // This message shouldn't even be rendered; we shouldn't be here, throw error
    throw new Error(
      `Couldn't find request info for message in convID=${conversationIDKey} ordinal=${Types.ordinalToNumber(
        ordinal
      )}`
    )
  }
  return WalletsGen.createOpenSendRequestForm({
    amount: requestInfo.amount,
    currency: requestInfo.currencyCode || 'XLM',
    from: WalletTypes.noAccountID,
    recipientType: 'keybaseUser',
    secretNote: message.note,
    to: message.author,
  })
}

const addUsersToChannel = async (_: unknown, action: Chat2Gen.AddUsersToChannelPayload) => {
  const {conversationIDKey, usernames} = action.payload

  try {
    await RPCChatTypes.localBulkAddToConvRpcPromise(
      {convID: Types.keyToConversationID(conversationIDKey), usernames},
      Constants.waitingKeyAddUsersToChannel
    )
    return [RouteTreeGen.createClearModals()]
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`addUsersToChannel: ${error.message}`) // surfaced in UI via waiting key
    }
    return false
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

const createConversationFromTeamBuilder = async (
  state: Container.TypedState,
  {payload: {namespace}}: TeamBuildingGen.FinishedTeamBuildingPayload
) => {
  // need to let the mdoal hide first else its thrashy
  await Container.timeoutPromise(500)
  return [
    Chat2Gen.createNavigateToThread({
      conversationIDKey: Constants.pendingWaitingConversationIDKey,
      reason: 'justCreated',
    }),
    Chat2Gen.createCreateConversation({
      participants: [...state[namespace].teamBuilding.finishedTeam].map(u => u.id),
    }),
  ]
}

const setInboxNumSmallRows = async (
  state: Container.TypedState,
  action: Chat2Gen.SetInboxNumSmallRowsPayload
): Promise<boolean> => {
  const {ignoreWrite} = action.payload
  if (ignoreWrite) {
    return false
  }
  const {inboxNumSmallRows} = state.chat2
  if (inboxNumSmallRows === undefined || inboxNumSmallRows <= 0) {
    return false
  }
  try {
    await RPCTypes.configGuiSetValueRpcPromise({
      path: 'ui.inboxSmallRows',
      value: {i: inboxNumSmallRows, isNull: false},
    })
  } catch (_) {}
  return false
}

const getInboxNumSmallRows = async () => {
  try {
    const rows = await RPCTypes.configGuiGetValueRpcPromise({path: 'ui.inboxSmallRows'})
    const ri = rows?.i ?? -1
    if (ri > 0) {
      return Chat2Gen.createSetInboxNumSmallRows({ignoreWrite: true, rows: ri})
    }
  } catch (_) {}
  return false
}

const loadNextBotPage = (state: Container.TypedState, action: Chat2Gen.LoadNextBotPagePayload) =>
  BotsGen.createGetFeaturedBots({
    limit: action.payload.pageSize,
    page: state.chat2.featuredBotsPage + 1,
  })

const refreshBotRoleInConv = async (_: unknown, action: Chat2Gen.RefreshBotRoleInConvPayload) => {
  let role: RPCTypes.TeamRole | undefined
  const {conversationIDKey, username} = action.payload
  try {
    role = await RPCChatTypes.localGetTeamRoleInConversationRpcPromise({
      convID: Types.keyToConversationID(conversationIDKey),
      username,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info(`refreshBotRoleInConv: failed to refresh bot team role: ${error.message}`)
    }
    return
  }
  const trole = TeamsConstants.teamRoleByEnum[role]
  return Chat2Gen.createSetBotRoleInConv({
    conversationIDKey,
    role: !trole || trole === 'none' ? null : trole,
    username,
  })
}

const refreshBotPublicCommands = async (_: unknown, action: Chat2Gen.RefreshBotPublicCommandsPayload) => {
  let res: RPCChatTypes.ListBotCommandsLocalRes | undefined
  const {username} = action.payload
  try {
    res = await RPCChatTypes.localListPublicBotCommandsLocalRpcPromise({
      username,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info('refreshBotPublicCommands: failed to get public commands: ' + error.message)
      return Chat2Gen.createSetBotPublicCommands({
        commands: {commands: [], loadError: true},
        username,
      })
    }
  }
  const commands = (res?.commands ?? []).reduce<Array<string>>((l, c) => {
    l.push(c.name)
    return l
  }, [])
  return Chat2Gen.createSetBotPublicCommands({
    commands: {commands, loadError: false},
    username,
  })
}

const closeBotModal = (state: Container.TypedState, conversationIDKey: Types.ConversationIDKey) => {
  const actions: Array<Container.TypedActions> = [RouteTreeGen.createClearModals()]
  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (meta?.teamname) {
    actions.push(TeamsGen.createGetMembers({teamID: meta.teamID}))
  }
  return actions
}

const addBotMember = async (state: Container.TypedState, action: Chat2Gen.AddBotMemberPayload) => {
  const {allowCommands, allowMentions, conversationIDKey, convs, username} = action.payload
  try {
    await RPCChatTypes.localAddBotMemberRpcPromise(
      {
        botSettings: action.payload.restricted ? {cmds: allowCommands, convs, mentions: allowMentions} : null,
        convID: Types.keyToConversationID(conversationIDKey),
        role: action.payload.restricted ? RPCTypes.TeamRole.restrictedbot : RPCTypes.TeamRole.bot,
        username,
      },
      Constants.waitingKeyBotAdd
    )
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info('addBotMember: failed to add bot member: ' + error.message)
    }
    return false
  }
  return closeBotModal(state, conversationIDKey)
}

const editBotSettings = async (state: Container.TypedState, action: Chat2Gen.EditBotSettingsPayload) => {
  const {allowCommands, allowMentions, conversationIDKey, convs, username} = action.payload
  try {
    await RPCChatTypes.localSetBotMemberSettingsRpcPromise(
      {
        botSettings: {cmds: allowCommands, convs, mentions: allowMentions},
        convID: Types.keyToConversationID(conversationIDKey),
        username,
      },
      Constants.waitingKeyBotAdd
    )
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info('addBotMember: failed to edit bot settings: ' + error.message)
    }
    return false
  }
  return closeBotModal(state, conversationIDKey)
}

const removeBotMember = async (state: Container.TypedState, action: Chat2Gen.RemoveBotMemberPayload) => {
  const {conversationIDKey, username} = action.payload
  try {
    await RPCChatTypes.localRemoveBotMemberRpcPromise(
      {
        convID: Types.keyToConversationID(conversationIDKey),
        username,
      },
      Constants.waitingKeyBotRemove
    )
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info('removeBotMember: failed to remove bot member: ' + error.message)
    }
    return false
  }
  return closeBotModal(state, conversationIDKey)
}

const refreshBotSettings = async (_: unknown, action: Chat2Gen.RefreshBotSettingsPayload) => {
  let settings: RPCTypes.TeamBotSettings | undefined
  const {conversationIDKey, username} = action.payload
  try {
    settings = await RPCChatTypes.localGetBotMemberSettingsRpcPromise({
      convID: Types.keyToConversationID(conversationIDKey),
      username,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info(`refreshBotSettings: failed to refresh settings for ${username}: ${error.message}`)
    }
    return
  }
  return Chat2Gen.createSetBotSettings({conversationIDKey, settings, username})
}

const onShowInfoPanel = (_: unknown, action: Chat2Gen.ShowInfoPanelPayload) => {
  const {conversationIDKey, show, tab} = action.payload
  if (Container.isPhone) {
    const visibleScreen = Router2Constants.getVisibleScreen()
    if ((visibleScreen?.name === 'chatInfoPanel') !== show) {
      return show
        ? RouteTreeGen.createNavigateAppend({
            path: [{props: {conversationIDKey, tab}, selected: 'chatInfoPanel'}],
          })
        : [
            ...(conversationIDKey ? [Chat2Gen.createClearAttachmentView({conversationIDKey})] : []),
            RouteTreeGen.createNavigateUp(),
          ]
    }
    return false
  } else {
    return false
  }
}

const maybeChangeChatSelection = (state: Container.TypedState, action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  const wasModal = prev && Router2Constants.getModalStack(prev).length > 0
  const isModal = next && Router2Constants.getModalStack(next).length > 0

  // ignore if changes involve a modal
  if (wasModal || isModal) {
    return
  }

  const p = Router2Constants.getVisibleScreen(prev)
  const n = Router2Constants.getVisibleScreen(next)

  const wasChat = p?.name === Constants.threadRouteName
  const isChat = n?.name === Constants.threadRouteName

  // nothing to do with chat
  if (!wasChat && !isChat) {
    return false
  }

  // @ts-ignore TODO better param typing
  const wasID: Types.ConversationIDKey | undefined = p?.params?.conversationIDKey
  // @ts-ignore TODO better param typing
  const isID: Types.ConversationIDKey | undefined = n?.params?.conversationIDKey

  logger.info('maybeChangeChatSelection ', {isChat, isID, wasChat, wasID})

  // same? ignore
  if (wasChat && isChat && wasID === isID) {
    // if we've never loaded anything, keep going so we load it
    if (!isID || state.chat2.containsLatestMessageMap.get(isID) !== undefined) {
      return false
    }
  }

  // deselect if there was one
  const deselectAction =
    wasChat && wasID && Constants.isValidConversationIDKey(wasID)
      ? [Chat2Gen.createDeselectedConversation({conversationIDKey: wasID})]
      : []

  // still chatting? just select new one
  if (wasChat && isChat && isID && Constants.isValidConversationIDKey(isID)) {
    return [...deselectAction, Chat2Gen.createSelectedConversation({conversationIDKey: isID})]
  }

  // leaving a chat
  if (wasChat && !isChat) {
    return [
      ...deselectAction,
      Chat2Gen.createSelectedConversation({conversationIDKey: Constants.noConversationIDKey}),
    ]
  }

  // going into a chat
  if (isChat && isID && Constants.isValidConversationIDKey(isID)) {
    return [...deselectAction, Chat2Gen.createSelectedConversation({conversationIDKey: isID})]
  }
  return false
}

const maybeChatTabSelected = (_: unknown, action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  if (Router2Constants.getTab(prev) !== Tabs.chatTab && Router2Constants.getTab(next) === Tabs.chatTab) {
    return Chat2Gen.createTabSelected()
  }
  return false
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
  Container.listenAction([Chat2Gen.inboxRefresh, EngineGen.chat1NotifyChatChatInboxStale], inboxRefresh)
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

  // Load the selected thread
  Container.listenAction(
    [
      Chat2Gen.navigateToThread,
      Chat2Gen.jumpToRecent,
      Chat2Gen.loadOlderMessagesDueToScroll,
      Chat2Gen.loadNewerMessagesDueToScroll,
      Chat2Gen.loadMessagesCentered,
      Chat2Gen.markConversationsStale,
      ConfigGen.changedFocus,
      Chat2Gen.tabSelected,
    ],
    loadMoreMessages
  )

  // get the unread (orange) line
  Container.listenAction(Chat2Gen.selectedConversation, getUnreadline)

  Container.listenAction(Chat2Gen.messageRetry, messageRetry)
  Container.listenAction(Chat2Gen.messageSend, messageSend)
  Container.listenAction(Chat2Gen.messageSendByUsernames, messageSendByUsernames)
  Container.listenAction(Chat2Gen.messageEdit, messageEdit)
  Container.listenAction(Chat2Gen.messageEdit, clearMessageSetEditing)
  Container.listenAction(Chat2Gen.messageDelete, messageDelete)
  Container.listenAction(Chat2Gen.messageDeleteHistory, deleteMessageHistory)
  Container.listenAction(Chat2Gen.dismissJourneycard, dismissJourneycard)
  Container.listenAction(Chat2Gen.confirmScreenResponse, confirmScreenResponse)

  // Giphy
  Container.listenAction(Chat2Gen.unsentTextChanged, unsentTextChanged)
  Container.listenAction(Chat2Gen.giphySend, giphySend)

  Container.listenAction(Chat2Gen.unfurlResolvePrompt, unfurlResolvePrompt)
  Container.listenAction(Chat2Gen.unfurlResolvePrompt, unfurlDismissPrompt)
  Container.listenAction(Chat2Gen.unfurlRemove, unfurlRemove)

  Container.listenAction(Chat2Gen.previewConversation, previewConversationTeam)
  Container.listenAction(Chat2Gen.previewConversation, previewConversationPersonMakesAConversation)
  Container.listenAction(Chat2Gen.openFolder, openFolder)

  // bots
  Container.listenAction(Chat2Gen.loadNextBotPage, loadNextBotPage)
  Container.listenAction(Chat2Gen.refreshBotPublicCommands, refreshBotPublicCommands)
  Container.listenAction(Chat2Gen.addBotMember, addBotMember)
  Container.listenAction(Chat2Gen.editBotSettings, editBotSettings)
  Container.listenAction(Chat2Gen.removeBotMember, removeBotMember)
  Container.listenAction(Chat2Gen.refreshBotSettings, refreshBotSettings)
  Container.listenAction(Chat2Gen.findGeneralConvIDFromTeamID, findGeneralConvIDFromTeamID)
  Container.listenAction(Chat2Gen.refreshBotRoleInConv, refreshBotRoleInConv)

  // On login lets load the untrusted inbox. This helps make some flows easier
  Container.listenAction(ConfigGen.bootstrapStatusLoaded, startupInboxLoad)

  Container.listenAction(ConfigGen.bootstrapStatusLoaded, startupUserReacjisLoad)

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
      ConfigGen.changedFocus,
      ConfigGen.changedActive,
      Chat2Gen.tabSelected,
    ],
    markThreadAsRead
  )
  Container.listenAction(Chat2Gen.markTeamAsRead, markTeamAsRead)
  Container.listenAction(Chat2Gen.markAsUnread, markAsUnread)
  Container.listenAction(Chat2Gen.messagesAdd, messagesAdd)
  Container.listenAction(
    [
      Chat2Gen.leaveConversation,
      TeamsGen.leftTeam,
      TeamsGen.deleteChannelConfirmed,
      TeamsGen.deleteMultiChannelsConfirmed,
    ],
    clearModalsFromConvEvent
  )
  Container.listenAction(
    [Chat2Gen.navigateToInbox, Chat2Gen.leaveConversation, TeamsGen.leftTeam],
    navigateToInbox
  )
  Container.listenAction(Chat2Gen.navigateToThread, navigateToThread)

  Container.listenAction(Chat2Gen.joinConversation, joinConversation)
  Container.listenAction(Chat2Gen.leaveConversation, leaveConversation)

  Container.listenAction(Chat2Gen.muteConversation, muteConversation)
  Container.listenAction(Chat2Gen.updateNotificationSettings, updateNotificationSettings)
  Container.listenAction(Chat2Gen.blockConversation, blockConversation)
  Container.listenAction(Chat2Gen.hideConversation, hideConversation)
  Container.listenAction(Chat2Gen.unhideConversation, unhideConversation)

  Container.listenAction(Chat2Gen.setConvRetentionPolicy, setConvRetentionPolicy)
  Container.listenAction(Chat2Gen.toggleMessageCollapse, toggleMessageCollapse)
  Container.listenAction(Chat2Gen.createConversation, createConversation)
  Container.listenAction(Chat2Gen.messageReplyPrivately, messageReplyPrivately)
  Container.listenAction(Chat2Gen.openChatFromWidget, openChatFromWidget)

  // Exploding things
  Container.listenAction(Chat2Gen.setConvExplodingMode, setConvExplodingMode)
  Container.listenAction(Chat2Gen.toggleMessageReaction, toggleMessageReaction)
  Container.listenAction(ConfigGen.daemonHandshake, loadStaticConfig)
  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  Container.listenAction(Chat2Gen.setMinWriterRole, setMinWriterRole)
  Container.listenAction(GregorGen.pushState, gregorPushState)
  Container.listenAction(Chat2Gen.prepareFulfillRequestForm, prepareFulfillRequestForm)

  Container.listenAction(Chat2Gen.channelSuggestionsTriggered, loadSuggestionData)

  Container.listenAction(Chat2Gen.refreshMutualTeamsInConv, refreshMutualTeamsInConv)

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
  Container.listenAction(EngineGen.chat1ChatUiChatShowManageChannels, onChatShowManageChannels)
  Container.listenAction(EngineGen.chat1ChatUiChatCoinFlipStatus, onChatCoinFlipStatus)
  Container.listenAction(EngineGen.chat1ChatUiChatCommandMarkdown, onChatCommandMarkdown)
  Container.listenAction(EngineGen.chat1ChatUiChatCommandStatus, onChatCommandStatus)
  Container.listenAction(EngineGen.chat1ChatUiChatMaybeMentionUpdate, onChatMaybeMentionUpdate)

  Container.listenAction(Chat2Gen.replyJump, onReplyJump)

  Container.listenAction(Chat2Gen.inboxSearch, inboxSearch)
  Container.listenAction(Chat2Gen.toggleInboxSearch, onToggleInboxSearch)
  Container.listenAction(Chat2Gen.inboxSearchSelect, onInboxSearchSelect)
  Container.listenAction(Chat2Gen.inboxSearchNameResults, onInboxSearchNameResults)
  Container.listenAction(Chat2Gen.inboxSearchTextResult, onInboxSearchTextResult)
  Container.listenAction(ConfigGen.mobileAppState, maybeCancelInboxSearchOnFocusChanged)

  Container.listenAction(Chat2Gen.threadSearch, threadSearch)
  Container.listenAction(Chat2Gen.toggleThreadSearch, onToggleThreadSearch)

  Container.listenAction(Chat2Gen.resolveMaybeMention, resolveMaybeMention)

  Container.listenAction(Chat2Gen.pinMessage, pinMessage)
  Container.listenAction(Chat2Gen.unpinMessage, unpinMessage)
  Container.listenAction(Chat2Gen.ignorePinnedMessage, ignorePinnedMessage)

  Container.listenAction(Chat2Gen.updateLastCoord, onUpdateLastCoord)

  Container.listenAction(Chat2Gen.loadAttachmentView, loadAttachmentView)

  Container.listenAction(Chat2Gen.selectedConversation, ensureSelectedMeta)

  Container.listenAction(Chat2Gen.showInfoPanel, onShowInfoPanel)

  Container.listenAction(Chat2Gen.selectedConversation, fetchConversationBio)

  Container.listenAction(Chat2Gen.sendAudioRecording, sendAudioRecording)

  Container.listenAction(EngineGen.connected, onConnect)
  Container.listenAction(Chat2Gen.setInboxNumSmallRows, setInboxNumSmallRows)
  Container.listenAction(ConfigGen.bootstrapStatusLoaded, getInboxNumSmallRows)

  Container.listenAction(Chat2Gen.dismissBlockButtons, dismissBlockButtons)

  commonListenActions('chat2')
  Container.listenAction(
    TeamBuildingGen.finishedTeamBuilding,
    filterForNs('chat2', createConversationFromTeamBuilder)
  )

  Container.listenAction(EngineGen.chat1NotifyChatChatConvUpdate, onChatConvUpdate)

  Container.listenAction(RouteTreeGen.onNavChanged, maybeChangeChatSelection)
  Container.listenAction(RouteTreeGen.onNavChanged, maybeChatTabSelected)
  Container.listenAction(Chat2Gen.deselectedConversation, updateDraftState)
}

export default initChat
