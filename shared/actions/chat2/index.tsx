import * as BotsGen from '../bots-gen'
import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as DeeplinksGen from '../deeplinks-gen'
import * as EngineGen from '../engine-gen-gen'
import * as TeamBuildingGen from '../team-building-gen'
import * as Constants from '../../constants/chat2'
import * as GregorGen from '../gregor-gen'
import * as FsConstants from '../../constants/fs'
import * as Flow from '../../util/flow'
import * as NotificationsGen from '../notifications-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as WalletsGen from '../wallets-gen'
import * as Saga from '../../util/saga'
import * as TeamsGen from '../teams-gen'
import * as Types from '../../constants/types/chat2'
import * as FsTypes from '../../constants/types/fs'
import * as TeamsTypes from '../../constants/types/teams'
import * as WalletTypes from '../../constants/types/wallets'
import * as Tabs from '../../constants/tabs'
import * as UsersGen from '../users-gen'
import * as WaitingGen from '../waiting-gen'
import * as Router2Constants from '../../constants/router2'
import * as Platform from '../../constants/platform'
import commonTeamBuildingSaga, {filterForNs} from '../team-building'
import * as TeamsConstants from '../../constants/teams'
import {NotifyPopup} from '../../native/notifications'
import {saveAttachmentToCameraRoll, showShareActionSheet} from '../platform-specific'
import {privateFolderWithUsers, teamFolder} from '../../constants/config'
import {RPCError} from '../../util/errors'
import * as Container from '../../util/container'
import {isIOS} from '../../constants/platform'

const onConnect = async () => {
  try {
    await RPCTypes.delegateUiCtlRegisterChatUIRpcPromise()
    await RPCTypes.delegateUiCtlRegisterLogUIRpcPromise()
    console.log('Registered Chat UI')
  } catch (error) {
    console.warn('Error in registering Chat UI:', error)
  }
}

const onGetInboxUnverifiedConvs = (action: EngineGen.Chat1ChatUiChatInboxUnverifiedPayload) => {
  const {inbox} = action.payload.params
  const result: RPCChatTypes.UnverifiedInboxUIItems = JSON.parse(inbox)
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
  action: Chat2Gen.InboxRefreshPayload | EngineGen.Chat1NotifyChatChatInboxStalePayload,
  logger: Saga.SagaLogger
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
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
  }

  logger.info(`Inbox refresh due to ${reason ?? '???'}`)
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
  return actions
}

// Only get the untrusted conversations out
const untrustedConversationIDKeys = (state: Container.TypedState, ids: Array<Types.ConversationIDKey>) =>
  ids.filter(id => (state.chat2.metaMap.get(id) ?? {trustedState: 'untrusted'}).trustedState === 'untrusted')

// We keep a set of conversations to unbox
let metaQueue = new Set<Types.ConversationIDKey>()
const queueMetaToRequest = (
  state: Container.TypedState,
  action: Chat2Gen.MetaNeedsUpdatingPayload,
  logger: Saga.SagaLogger
) => {
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
function* requestMeta(state: Container.TypedState, _: Chat2Gen.MetaHandleQueuePayload) {
  const maxToUnboxAtATime = 10
  const ar = [...metaQueue]
  const maybeUnbox = ar.slice(0, maxToUnboxAtATime)
  metaQueue = new Set(ar.slice(maxToUnboxAtATime))

  const conversationIDKeys = untrustedConversationIDKeys(state, maybeUnbox)
  const toUnboxActions = conversationIDKeys.length
    ? [Saga.put(Chat2Gen.createMetaRequestTrusted({conversationIDKeys, reason: 'scroll'}))]
    : []
  const unboxSomeMoreActions = metaQueue.size ? [Saga.put(Chat2Gen.createMetaHandleQueue())] : []
  const delayBeforeUnboxingMoreActions =
    toUnboxActions.length && unboxSomeMoreActions.length ? [Saga.delay(100)] : []

  const nextActions = [...toUnboxActions, ...delayBeforeUnboxingMoreActions, ...unboxSomeMoreActions]

  if (nextActions.length) {
    yield Saga.sequentially(nextActions)
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
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
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
  const inboxUIItems: Array<RPCChatTypes.InboxUIItem> = JSON.parse(convs)
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
  action: EngineGen.Chat1ChatUiChatInboxFailedPayload,
  logger: Saga.SagaLogger
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
  _: EngineGen.Chat1ChatUiChatInboxLayoutPayload,
  logger: Saga.SagaLogger
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
  action: Chat2Gen.MetaRequestTrustedPayload | Chat2Gen.SelectedConversationPayload,
  logger: Saga.SagaLogger
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
  return Chat2Gen.createMetaRequestingTrusted({conversationIDKeys})
}

// We get an incoming message streamed to us
const onIncomingMessage = (
  state: Container.TypedState,
  incoming: RPCChatTypes.IncomingMessage,
  logger: Saga.SagaLogger
) => {
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
          if (d && d.messageIDs) {
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
  const conv = payload ? payload.conv : null
  if (!conv) {
    return []
  }
  const meta = Constants.inboxUIItemToConversationMeta(state, conv)
  const usernameToFullname = (conv?.participants ?? []).reduce<{[key: string]: string}>((map, part) => {
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

      if (error) {
        // This is temp until fixed by CORE-7112. We get this error but not the call to let us show the red banner
        const reason = Constants.rpcErrorToString(error)
        let tempForceRedBox: string | null = null
        if (error.typ === RPCChatTypes.OutboxErrorType.identify) {
          // Find out the user who failed identify
          const match = error.message.match(/"(.*)"/)
          tempForceRedBox = match && match[1]
        }
        arr.push(Chat2Gen.createMessageErrored({conversationIDKey, errorTyp: error.typ, outboxID, reason}))
        if (tempForceRedBox) {
          arr.push(UsersGen.createUpdateBrokenState({newlyBroken: [tempForceRedBox], newlyFixed: []}))
        }
      }
    }
    return arr
  }, [])

  return actions
}

// Some participants are broken/fixed now
const onChatIdentifyUpdate = (action: EngineGen.Chat1NotifyChatChatIdentifyUpdatePayload) => {
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
const reactionUpdateToActions = (info: RPCChatTypes.ReactionUpdateNotif, logger: Saga.SagaLogger) => {
  const conversationIDKey = Types.conversationIDToKey(info.convID)
  if (!info.reactionUpdates || info.reactionUpdates.length === 0) {
    logger.warn(`Got ReactionUpdateNotif with no reactionUpdates for convID=${conversationIDKey}`)
    return null
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

const onChatPromptUnfurl = (action: EngineGen.Chat1NotifyChatChatPromptUnfurlPayload) => {
  const {convID, domain, msgID} = action.payload.params
  return Chat2Gen.createUnfurlTogglePrompt({
    conversationIDKey: Types.conversationIDToKey(convID),
    domain,
    messageID: Types.numberToMessageID(msgID),
    show: true,
  })
}

const onChatAttachmentUploadProgress = (
  action: EngineGen.Chat1NotifyChatChatAttachmentUploadProgressPayload
) => {
  const {convID, outboxID, bytesComplete, bytesTotal} = action.payload.params
  return Chat2Gen.createAttachmentUploading({
    conversationIDKey: Types.conversationIDToKey(convID),
    outboxID: Types.rpcOutboxIDToOutboxID(outboxID),
    ratio: bytesComplete / bytesTotal,
  })
}

const onChatAttachmentUploadStart = (action: EngineGen.Chat1NotifyChatChatAttachmentUploadStartPayload) => {
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
      const items = (syncRes.incremental && syncRes.incremental.items) || []
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

const onChatPaymentInfo = (
  action: EngineGen.Chat1NotifyChatChatPaymentInfoPayload,
  logger: Saga.SagaLogger
) => {
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

const onChatRequestInfo = (
  action: EngineGen.Chat1NotifyChatChatRequestInfoPayload,
  logger: Saga.SagaLogger
) => {
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
  action: EngineGen.Chat1NotifyChatChatSetConvRetentionPayload,
  logger: Saga.SagaLogger
) => {
  const {conv, convID} = action.payload.params
  if (!conv) {
    logger.warn('onChatSetConvRetention: no conv given')
    return false
  }
  const meta = Constants.inboxUIItemToConversationMeta(state, conv)
  if (!meta) {
    logger.warn(`onChatSetConvRetention: no meta found for ${convID}`)
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

const onChatSetConvSettings = (
  action: EngineGen.Chat1NotifyChatChatSetConvSettingsPayload,
  logger: Saga.SagaLogger
) => {
  const {conv, convID} = action.payload.params
  const conversationIDKey = Types.conversationIDToKey(convID)
  const newRole =
    (conv?.convSettings && conv.convSettings.minWriterRoleInfo && conv.convSettings.minWriterRoleInfo.role) ||
    null
  const role = newRole && TeamsConstants.teamRoleByEnum[newRole]
  const cannotWrite = conv?.convSettings?.minWriterRoleInfo?.cannotWrite || false
  logger.info(
    `got new minWriterRole ${role || ''} for convID ${conversationIDKey}, cannotWrite ${cannotWrite}`
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
  action: EngineGen.Chat1NotifyChatChatSetTeamRetentionPayload,
  logger: Saga.SagaLogger
) => {
  const {convs} = action.payload.params
  const metas = (convs ?? []).reduce<Array<Types.ConversationMeta>>((l, c) => {
    const meta = Constants.inboxUIItemToConversationMeta(state, c)
    if (meta) {
      l.push(meta)
    }
    return l
  }, [])
  if (metas) {
    return Chat2Gen.createUpdateTeamRetentionPolicy({metas})
  }
  // this is a more serious problem, but we don't need to bug the user about it
  logger.error(
    'got NotifyChat.ChatSetTeamRetention with no attached InboxUIItems. The local version may be out of date'
  )
  return false
}

const onChatSubteamRename = (action: EngineGen.Chat1NotifyChatChatSubteamRenamePayload) => {
  const {convs} = action.payload.params
  const conversationIDKeys = (convs ?? []).map(c => Types.stringToConversationIDKey(c.convID))
  return Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys,
    force: true,
    reason: 'subTeamRename',
  })
}

const onChatChatTLFFinalizePayload = (action: EngineGen.Chat1NotifyChatChatTLFFinalizePayload) => {
  const {convID} = action.payload.params
  return Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys: [Types.conversationIDToKey(convID)],
    reason: 'tlfFinalize',
  })
}

const onChatThreadStale = (
  action: EngineGen.Chat1NotifyChatChatThreadsStalePayload,
  logger: Saga.SagaLogger
) => {
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
  action: EngineGen.Chat1NotifyChatNewChatActivityPayload,
  logger: Saga.SagaLogger
) => {
  const {activity} = action.payload.params
  logger.info(`Got new chat activity of type: ${activity.activityType}`)
  let actions: Array<Container.TypedActions> | null = null
  switch (activity.activityType) {
    case RPCChatTypes.ChatActivityType.incomingMessage: {
      const {incomingMessage} = activity
      actions = [
        ...(onIncomingMessage(state, incomingMessage, logger) as any),
        ...(chatActivityToMetasAction(state, incomingMessage) as any),
      ]
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
        actions = [
          ...(onErrorMessage(outboxRecords) as any),
          ...(chatActivityToMetasAction(state, failedMessage) as any),
        ]
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
      actions = reactionUpdateToActions(activity.reactionUpdate, logger)
      break
    case RPCChatTypes.ChatActivityType.messagesUpdated: {
      actions = messagesUpdatedToActions(state, activity.messagesUpdated)
      break
    }
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
          const val = RPCChatTypes.MessageType[key as any]
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
function* loadMoreMessages(
  state: Container.TypedState,
  action:
    | Chat2Gen.NavigateToThreadPayload
    | Chat2Gen.JumpToRecentPayload
    | Chat2Gen.LoadOlderMessagesDueToScrollPayload
    | Chat2Gen.LoadNewerMessagesDueToScrollPayload
    | Chat2Gen.LoadMessagesCenteredPayload
    | Chat2Gen.MarkConversationsStalePayload
    | ConfigGen.ChangedFocusPayload,
  logger: Saga.SagaLogger
) {
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
      if (action.payload.conversationIDKeys.indexOf(key) === -1) {
        return
      }
      reason = 'got stale'
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
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
  }

  if (!key || !Constants.isValidConversationIDKey(key)) {
    logger.info('bail: no conversationIDKey')
    return
  }

  const conversationIDKey = key

  const conversationID = Types.keyToConversationID(conversationIDKey)
  if (!conversationID) {
    logger.info('bail: invalid conversationIDKey')
    return
  }

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
  const onGotThread = (thread: string) =>
    Saga.callUntyped(function*() {
      if (!thread) {
        return
      }

      const state = yield* Saga.selectState()
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

      const moreToLoad = uiMessages.pagination ? !uiMessages.pagination.last : true
      yield Saga.put(Chat2Gen.createUpdateMoreToLoad({conversationIDKey, moreToLoad}))

      if (messages.length) {
        yield Saga.put(
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
    })

  const onGotThreadLoadStatus = (status: RPCChatTypes.UIChatThreadStatus) => [
    Saga.put(Chat2Gen.createSetThreadLoadStatus({conversationIDKey, status})),
  ]

  const pagination = messageIDControl ? null : scrollDirectionToPagination(sd, numberOfMessagesToLoad)
  try {
    const results: RPCChatTypes.NonblockFetchRes = yield RPCChatTypes.localGetThreadNonblockRpcSaga({
      incomingCallMap: {
        'chat.1.chatUi.chatThreadCached': p => p && onGotThread(p.thread || ''),
        'chat.1.chatUi.chatThreadFull': p => p && onGotThread(p.thread || ''),
        'chat.1.chatUi.chatThreadStatus': s => onGotThreadLoadStatus(s.status),
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
    })
    yield Saga.put(
      Chat2Gen.createSetConversationOffline({conversationIDKey, offline: results && results.offline})
    )
  } catch (e) {
    logger.warn(e.message)
    // no longer in team
    if (e.code === RPCTypes.StatusCode.scchatnotinteam) {
      yield* maybeKickedFromTeam()
      return
    }
    if (e.code !== RPCTypes.StatusCode.scteamreaderror) {
      // scteamreaderror = user is not in team. they'll see the rekey screen so don't throw for that
      throw e
    }
  }
}

function* maybeKickedFromTeam() {
  yield Saga.put(Chat2Gen.createInboxRefresh({reason: 'maybeKickedFromTeam'}))
  yield Saga.put(Chat2Gen.createNavigateToInbox())
}

function* getUnreadline(
  state: Container.TypedState,
  action: Chat2Gen.SelectedConversationPayload,
  logger: Saga.SagaLogger
) {
  // Get the conversationIDKey
  let key: Types.ConversationIDKey | null = null
  switch (action.type) {
    case Chat2Gen.selectedConversation:
      key = action.payload.conversationIDKey
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action.type)
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
    const unreadlineRes = yield RPCChatTypes.localGetUnreadlineRpcPromise({
      convID,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      readMsgID: readMsgID < 0 ? 0 : readMsgID,
    })
    const unreadlineID = unreadlineRes.unreadlineID ? unreadlineRes.unreadlineID : 0
    yield Saga.put(
      Chat2Gen.createUpdateUnreadline({
        conversationIDKey,
        messageID: Types.numberToMessageID(unreadlineID),
      })
    )
  } catch (e) {
    if (e.code === RPCTypes.StatusCode.scchatnotinteam) {
      yield* maybeKickedFromTeam()
    }
    // ignore this error in general
  }
}

// Show a desktop notification
function* desktopNotify(
  state: Container.TypedState,
  action: Chat2Gen.DesktopNotificationPayload,
  logger: Saga.SagaLogger
) {
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

  const actions = yield Saga.callUntyped(
    () =>
      new Promise(resolve => {
        const onClick = () => {
          resolve(
            Saga.sequentially([
              Saga.put(Chat2Gen.createNavigateToInbox()),
              Saga.put(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'desktopNotification'})),
              Saga.put(ConfigGen.createShowMain()),
            ])
          )
        }
        const onClose = () => {
          resolve()
        }
        logger.info('invoking NotifyPopup for chat notification')
        NotifyPopup(title, {body, sound: state.config.notifySound}, -1, author, onClick, onClose)
      })
  )
  if (actions) {
    yield actions
  }
}

// Delete a message. We cancel pending messages
const messageDelete = async (
  state: Container.TypedState,
  action: Chat2Gen.MessageDeletePayload,
  logger: Saga.SagaLogger
) => {
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

const clearMessageSetEditing = (action: Chat2Gen.MessageEditPayload) =>
  Chat2Gen.createMessageSetEditing({
    conversationIDKey: action.payload.conversationIDKey,
    ordinal: null,
  })

function* messageEdit(
  state: Container.TypedState,
  action: Chat2Gen.MessageEditPayload,
  logger: Saga.SagaLogger
) {
  const {conversationIDKey, text, ordinal} = action.payload
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
  if (!message) {
    logger.warn("Can't find message to edit", ordinal)
    return
  }

  if (message.type === 'text') {
    // Skip if the content is the same
    if (message.text.stringValue() === text.stringValue()) {
      yield Saga.put(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null}))
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
    let actions: Array<Saga.Effect<any>> = [
      Saga.callUntyped(
        RPCChatTypes.localPostEditNonblockRpcPromise,
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
      ),
    ]
    if (!message.id) {
      actions = actions.concat(
        Saga.put(Chat2Gen.createPendingMessageWasEdited({conversationIDKey, ordinal, text}))
      )
    }
    yield Saga.sequentially(actions)
  } else {
    logger.warn('Editing non-text message')
  }
}

const messageRetry = (action: Chat2Gen.MessageRetryPayload) => {
  const {outboxID} = action.payload
  return RPCChatTypes.localRetryPostRpcPromise(
    {outboxID: Types.outboxIDToRpcOutboxID(outboxID)},
    Constants.waitingKeyRetryPost
  )
}

function* loadAttachmentView(
  _: Container.TypedState,
  action: Chat2Gen.LoadAttachmentViewPayload,
  logger: Saga.SagaLogger
) {
  const {conversationIDKey, viewType, fromMsgID} = action.payload

  const onHit = (hit: RPCChatTypes.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam']) =>
    Saga.callUntyped(function*() {
      const state = yield* Saga.selectState()
      const {username, getLastOrdinal, devicename} = Constants.getMessageStateExtras(state, conversationIDKey)

      const message = Constants.uiMessageToMessage(
        conversationIDKey,
        hit.message,
        username,
        getLastOrdinal,
        devicename
      )
      if (message) {
        yield Saga.put(Chat2Gen.createAddAttachmentViewMessage({conversationIDKey, message, viewType}))
      }
    })

  try {
    const res = yield RPCChatTypes.localLoadGalleryRpcSaga({
      incomingCallMap: {'chat.1.chatUi.chatLoadGalleryHit': onHit},
      params: {
        convID: Types.keyToConversationID(conversationIDKey),
        fromMsgID,
        num: 50,
        typ: viewType,
      },
    })
    yield Saga.put(
      Chat2Gen.createSetAttachmentViewStatus({conversationIDKey, last: res.last, status: 'success', viewType})
    )
  } catch (e) {
    logger.error('failed to load attachment view: ' + e.message)
    yield Saga.put(Chat2Gen.createSetAttachmentViewStatus({conversationIDKey, status: 'error', viewType}))
  }
}

const onToggleThreadSearch = (state: Container.TypedState, action: Chat2Gen.ToggleThreadSearchPayload) => {
  const visible = Constants.getThreadSearchInfo(state, action.payload.conversationIDKey).visible
  return visible ? false : RPCChatTypes.localCancelActiveSearchRpcPromise()
}

function* threadSearch(
  state: Container.TypedState,
  action: Chat2Gen.ThreadSearchPayload,
  logger: Saga.SagaLogger
) {
  const {conversationIDKey, query} = action.payload

  const {username, getLastOrdinal, devicename} = Constants.getMessageStateExtras(state, conversationIDKey)
  const onHit = (hit: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchHit']['inParam']) => {
    const message = Constants.uiMessageToMessage(
      conversationIDKey,
      hit.searchHit.hitMessage,
      username,
      getLastOrdinal,
      devicename
    )
    return message
      ? Saga.put(Chat2Gen.createThreadSearchResults({clear: false, conversationIDKey, messages: [message]}))
      : false
  }
  const onInboxHit = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']) => {
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
      ? Saga.put(Chat2Gen.createThreadSearchResults({clear: true, conversationIDKey, messages}))
      : []
  }
  const onDone = () => Saga.put(Chat2Gen.createSetThreadSearchStatus({conversationIDKey, status: 'done'}))
  const onStart = () =>
    Saga.put(Chat2Gen.createSetThreadSearchStatus({conversationIDKey, status: 'inprogress'}))

  try {
    yield RPCChatTypes.localSearchInboxRpcSaga({
      incomingCallMap: {
        'chat.1.chatUi.chatSearchDone': onDone,
        'chat.1.chatUi.chatSearchHit': onHit,
        'chat.1.chatUi.chatSearchInboxDone': onDone,
        'chat.1.chatUi.chatSearchInboxHit': onInboxHit,
        'chat.1.chatUi.chatSearchInboxStart': onStart,
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
    })
  } catch (e) {
    logger.error('search failed: ' + e.message)
    yield Saga.put(Chat2Gen.createSetThreadSearchStatus({conversationIDKey, status: 'done'}))
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

const onToggleInboxSearch = (state: Container.TypedState) => {
  const {inboxSearch} = state.chat2
  if (!inboxSearch) {
    return RPCChatTypes.localCancelActiveInboxSearchRpcPromise()
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

function* inboxSearch(_: Container.TypedState, action: Chat2Gen.InboxSearchPayload, logger: Saga.SagaLogger) {
  const {query} = action.payload
  const teamType = (t: RPCChatTypes.TeamType) => (t === RPCChatTypes.TeamType.complex ? 'big' : 'small')

  const onConvHits = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam']) =>
    Saga.put(
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
    )

  const onOpenTeamHits = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['inParam']) =>
    Saga.put(
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
    )

  const onBotsHits = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchBotHits']['inParam']) =>
    Saga.put(
      Chat2Gen.createInboxSearchBotsResults({
        results: resp.hits.hits || [],
        suggested: resp.hits.suggestedMatches,
      })
    )

  const onTextHit = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']) => {
    const {convID, convName, hits, query, teamType: tt, time} = resp.searchHit
    return Saga.put(
      Chat2Gen.createInboxSearchTextResult({
        result: {
          conversationIDKey: Types.conversationIDToKey(convID),
          name: convName,
          numHits: hits?.length ?? 0,
          query,
          teamType: teamType(tt),
          time,
        },
      })
    )
  }
  const onStart = () => Saga.put(Chat2Gen.createInboxSearchStarted())
  const onDone = () => Saga.put(Chat2Gen.createInboxSearchSetTextStatus({status: 'success'}))

  const onIndexStatus = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam']) =>
    Saga.put(Chat2Gen.createInboxSearchSetIndexPercent({percent: resp.status.percentIndexed}))

  try {
    yield RPCChatTypes.localSearchInboxRpcSaga({
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
    })
  } catch (e) {
    if (!(e instanceof RPCError && e.code === RPCTypes.StatusCode.sccanceled)) {
      logger.error('search failed: ' + e.message)
      yield Saga.put(Chat2Gen.createInboxSearchSetTextStatus({status: 'error'}))
    }
  }
}

const onReplyJump = (action: Chat2Gen.ReplyJumpPayload) =>
  Chat2Gen.createLoadMessagesCentered({
    conversationIDKey: action.payload.conversationIDKey,
    highlightMode: 'flash',
    messageID: action.payload.messageID,
  })

function* messageSend(
  state: Container.TypedState,
  action: Chat2Gen.MessageSendPayload,
  logger: Saga.SagaLogger
) {
  const {conversationIDKey, text, replyTo} = action.payload

  const meta = Constants.getMeta(state, conversationIDKey)
  const tlfName = meta.tlfname
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)

  // disable sending exploding messages if flag is false
  const ephemeralLifetime = Constants.getConversationExplodingMode(state, conversationIDKey)
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
  const confirmRouteName = 'chatPaymentsConfirm'
  const onShowConfirm = () => [
    Saga.put(Chat2Gen.createClearPaymentConfirmInfo()),
    Saga.put(
      RouteTreeGen.createNavigateAppend({
        path: [confirmRouteName],
      })
    ),
  ]
  const onHideConfirm = ({canceled}: RPCChatTypes.MessageTypes['chat.1.chatUi.chatStellarDone']['inParam']) =>
    Saga.callUntyped(function*() {
      const visibleScreen = Router2Constants.getVisibleScreen()
      if (visibleScreen && visibleScreen.routeName === confirmRouteName) {
        yield Saga.put(RouteTreeGen.createClearModals())
      }
      if (canceled) {
        yield Saga.put(Chat2Gen.createSetUnsentText({conversationIDKey, text}))
      }
    })
  const onDataConfirm = (
    {summary}: RPCChatTypes.MessageTypes['chat.1.chatUi.chatStellarDataConfirm']['inParam'],
    response: StellarConfirmWindowResponse
  ) => {
    storeStellarConfirmWindowResponse(false, response)
    return Saga.put(Chat2Gen.createSetPaymentConfirmInfo({summary}))
  }
  const onDataError = (
    {error}: RPCChatTypes.MessageTypes['chat.1.chatUi.chatStellarDataError']['inParam'],
    response: StellarConfirmWindowResponse
  ) => {
    storeStellarConfirmWindowResponse(false, response)
    return Saga.put(Chat2Gen.createSetPaymentConfirmInfo({error}))
  }

  try {
    yield RPCChatTypes.localPostTextNonblockRpcSaga({
      customResponseIncomingCallMap: {
        'chat.1.chatUi.chatStellarDataConfirm': onDataConfirm,
        'chat.1.chatUi.chatStellarDataError': onDataError,
      },
      incomingCallMap: {
        'chat.1.chatUi.chatStellarDone': onHideConfirm,
        'chat.1.chatUi.chatStellarShowConfirm': onShowConfirm,
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
    })
    logger.info('success')
  } catch (e) {
    logger.info('error')
  }

  // If there are block buttons on this conversation, clear them.
  if (state.chat2.blockButtonsMap.has(meta.teamID)) {
    yield Saga.put(Chat2Gen.createDismissBlockButtons({teamID: meta.teamID}))
  }

  // Do some logging to track down the root cause of a bug causing
  // messages to not send. Do this after creating the objects above to
  // narrow down the places where the action can possibly stop.
  logger.info('non-empty text?', text.stringValue().length > 0)
}

const messageSendByUsernames = async (
  state: Container.TypedState,
  action: Chat2Gen.MessageSendByUsernamesPayload,
  logger: Saga.SagaLogger
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
  } catch (e) {
    logger.warn('Could not send in messageSendByUsernames', e)
  }
  return []
}

type StellarConfirmWindowResponse = {result: (b: boolean) => void}
let _stellarConfirmWindowResponse: StellarConfirmWindowResponse | null = null

function storeStellarConfirmWindowResponse(accept: boolean, response: StellarConfirmWindowResponse | null) {
  _stellarConfirmWindowResponse && _stellarConfirmWindowResponse.result(accept)
  _stellarConfirmWindowResponse = response
}

const confirmScreenResponse = (action: Chat2Gen.ConfirmScreenResponsePayload) => {
  storeStellarConfirmWindowResponse(action.payload.accept, null)
}

// We always make adhoc convos and never preview it
const previewConversationPersonMakesAConversation = (action: Chat2Gen.PreviewConversationPayload) => {
  const {participants, teamname} = action.payload
  return (
    !teamname &&
    participants && [
      Chat2Gen.createNavigateToThread({
        conversationIDKey: Constants.pendingWaitingConversationIDKey,
        reason: 'justCreated',
      }),
      Chat2Gen.createCreateConversation({
        highlightMessageID: action.payload.highlightMessageID,
        participants,
      }),
    ]
  )
}

const findGeneralConvIDFromTeamID = async (
  state: Container.TypedState,
  action: Chat2Gen.FindGeneralConvIDFromTeamIDPayload,
  logger: Saga.SagaLogger
) => {
  let conv: RPCChatTypes.InboxUIItem | undefined
  try {
    conv = await RPCChatTypes.localFindGeneralConvFromTeamIDRpcPromise({
      teamID: action.payload.teamID,
    })
  } catch (err) {
    logger.info(`findGeneralConvIDFromTeamID: failed to get general conv: ${err.message}`)
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
  } catch (err) {
    if (err.code === RPCTypes.StatusCode.scteamnotfound && reason === 'appLink') {
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
      throw err
    }
  }
}

const startupInboxLoad = (state: Container.TypedState) =>
  !!state.config.username && Chat2Gen.createInboxRefresh({reason: 'bootstrap'})

const startupUserReacjisLoad = (action: ConfigGen.BootstrapStatusLoadedPayload) =>
  Chat2Gen.createUpdateUserReacjis({userReacjis: action.payload.userReacjis})

// onUpdateUserReacjis hooks `userReacjis`, frequently used reactions
// recorded by the service, into the emoji-mart library. Handler spec is
// documented at
// https://github.com/missive/emoji-mart/tree/7c2e2a840bdd48c3c9935dac4208115cbcf6006d#storage
const onUpdateUserReacjis = (state: Container.TypedState) => {
  if (Container.isMobile) {
    return
  }
  const {userReacjis} = state.chat2
  // emoji-mart expects a frequency map so we convert the sorted list from the
  // service into a frequency map that will appease the lib.
  let i = 0
  const reacjis: {[key: string]: number} = {}
  userReacjis.topReacjis.forEach(el => {
    i++
    reacjis[el.name] = userReacjis.topReacjis.length - i
  })

  const {store} = require('emoji-mart')
  store.setHandlers({
    getter: (key: 'frequently' | 'last' | 'skin') => {
      switch (key) {
        case 'frequently':
          return reacjis
        case 'last':
          return reacjis[0]
        case 'skin':
          return userReacjis.skinTone
      }
    },
  })
}

const openFolder = (state: Container.TypedState, action: Chat2Gen.OpenFolderPayload) => {
  const meta = Constants.getMeta(state, action.payload.conversationIDKey)
  const participantInfo = Constants.getParticipantInfo(state, action.payload.conversationIDKey)
  const path = FsTypes.stringToPath(
    meta.teamType !== 'adhoc' ? teamFolder(meta.teamname) : privateFolderWithUsers(participantInfo.name)
  )
  return FsConstants.makeActionForOpenPathInFilesTab(path)
}

function* downloadAttachment(downloadToCache: boolean, message: Types.Message, logger: Saga.SagaLogger) {
  try {
    const {conversationIDKey} = message
    const rpcRes: RPCChatTypes.DownloadFileAttachmentLocalRes = yield RPCChatTypes.localDownloadFileAttachmentLocalRpcSaga(
      {
        incomingCallMap: {},
        params: {
          conversationID: Types.keyToConversationID(conversationIDKey),
          downloadToCache,
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          messageID: message.id,
          preview: false,
        },
      }
    )
    yield Saga.put(Chat2Gen.createAttachmentDownloaded({message, path: rpcRes.filePath}))
    return rpcRes.filePath
  } catch (e) {
    logger.info(`downloadAttachment error: ${e.message}`, logger)
    yield Saga.put(
      Chat2Gen.createAttachmentDownloaded({error: e.message || 'Error downloading attachment', message})
    )
    return false
  }
}

// Download an attachment to your device
function* attachmentDownload(
  _: Container.TypedState,
  action: Chat2Gen.AttachmentDownloadPayload,
  logger: Saga.SagaLogger
) {
  const {message} = action.payload

  if (message.type !== 'attachment') {
    throw new Error('Trying to download missing / incorrect message?')
  }

  // already downloaded?
  if (message.downloadPath) {
    logger.warn('Attachment already downloaded')
    return
  }

  yield Saga.callUntyped(downloadAttachment, false, message, logger)
}

const attachmentPreviewSelect = (action: Chat2Gen.AttachmentPreviewSelectPayload) => [
  Chat2Gen.createAddToMessageMap({message: action.payload.message}),
  RouteTreeGen.createNavigateAppend({
    path: [
      {
        props: {
          conversationIDKey: action.payload.message.conversationIDKey,
          ordinal: action.payload.message.ordinal,
        },
        selected: 'chatAttachmentFullscreen',
      },
    ],
  }),
]

// Handle an image pasted into a conversation
const attachmentPasted = async (action: Chat2Gen.AttachmentPastedPayload) => {
  const {conversationIDKey, data} = action.payload
  const outboxID = Constants.generateOutboxID()
  const path = await RPCChatTypes.localMakeUploadTempFileRpcPromise({data, filename: 'paste.png', outboxID})

  const pathAndOutboxIDs = [{outboxID, path}]
  return RouteTreeGen.createNavigateAppend({
    path: [{props: {conversationIDKey, pathAndOutboxIDs}, selected: 'chatAttachmentGetTitles'}],
  })
}

const sendAudioRecording = async (
  state: Container.TypedState,
  action: Chat2Gen.SendAudioRecordingPayload,
  logger: Saga.SagaLogger
) => {
  // sit here for 400ms for animations
  if (!action.payload.fromStaged) {
    await Container.timeoutPromise(400)
  }
  const {conversationIDKey, info} = action.payload
  const audioRecording = info
  const {amps, path, outboxID} = audioRecording
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)
  const ephemeralLifetime = Constants.getConversationExplodingMode(state, conversationIDKey)
  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (!meta) {
    logger.warn('sendAudioRecording: no meta for send')
    return
  }

  let callerPreview: RPCChatTypes.MakePreviewRes | undefined
  if (amps) {
    const duration = Constants.audioRecordingDuration(audioRecording)
    callerPreview = await RPCChatTypes.localMakeAudioPreviewRpcPromise({
      amps: amps.getBucketedAmps(duration),
      duration,
    })
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
  } catch (e) {
    logger.warn('sendAudioRecording: failed to send attachment: ' + JSON.stringify(e))
  }
}

// Upload an attachment
function* attachmentsUpload(
  state: Container.TypedState,
  action: Chat2Gen.AttachmentsUploadPayload,
  logger: Saga.SagaLogger
) {
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
  yield Saga.sequentially(
    paths.map((p, i) =>
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
  if (Platform.isDarwin) {
    const paths = await Promise.all(
      action.payload.paths.map(p => KB.kb.darwinCopyToChatTempUploadFile(p.path))
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
const sendTyping = (action: Chat2Gen.SendTypingPayload) => {
  const {conversationIDKey, typing} = action.payload
  return RPCChatTypes.localUpdateTypingRpcPromise({
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
const resetLetThemIn = (action: Chat2Gen.ResetLetThemInPayload) =>
  RPCChatTypes.localAddTeamMemberAfterResetRpcPromise({
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
    username: action.payload.username,
  })

const markThreadAsRead = async (
  state: Container.TypedState,
  action:
    | Chat2Gen.MessagesAddPayload
    | Chat2Gen.UpdateUnreadlinePayload
    | Chat2Gen.MarkInitiallyLoadedThreadAsReadPayload
    | Chat2Gen.UpdateReactionsPayload
    | ConfigGen.ChangedFocusPayload
    | ConfigGen.ChangedActivePayload
    | Chat2Gen.TabSelectedPayload,
  logger: Saga.SagaLogger
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
    const ordinal = [...ordinals].reverse().find(o => {
      const m = mmap.get(o)
      return m ? !!m.id : false
    })
    message = ordinal ? mmap.get(ordinal) : undefined
  }

  let readMsgID: number | null = null
  if (meta) {
    readMsgID = message ? (message.id > meta.maxMsgID ? message.id : meta.maxMsgID) : meta.maxMsgID
  }
  logger.info(`marking read messages ${conversationIDKey} ${readMsgID}`)
  await RPCChatTypes.localMarkAsReadLocalRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    msgID: readMsgID,
  })
}

const messagesAdd = (
  state: Container.TypedState,
  _action: Chat2Gen.MessagesAddPayload,
  logger: Saga.SagaLogger
) => {
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
  action: Chat2Gen.MessageDeleteHistoryPayload,
  logger: Saga.SagaLogger
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

const dismissJourneycard = (action: Chat2Gen.DismissJourneycardPayload, logger: Saga.SagaLogger) => {
  const {cardType, conversationIDKey, ordinal} = action.payload
  RPCChatTypes.localDismissJourneycardRpcPromise({
    cardType: cardType,
    convID: Types.keyToConversationID(conversationIDKey),
  }).catch(err => {
    logger.error(`Failed to dismiss journeycard: ${err.message}`)
  })
  return Chat2Gen.createMessagesWereDeleted({conversationIDKey, ordinals: [ordinal]})
}

// Get the list of mutual teams if we need to.
function* loadSuggestionData(
  state: Container.TypedState,
  action: Chat2Gen.ChannelSuggestionsTriggeredPayload
) {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  // If this is an impteam, try to refresh mutual team info
  if (!meta.teamname) {
    yield Saga.put(Chat2Gen.createRefreshMutualTeamsInConv({conversationIDKey}))
    return
  }
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

const fetchUserEmoji = async (action: Chat2Gen.FetchUserEmojiPayload) => {
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
    RouteTreeGen.createNavUpToScreen({routeName: 'chatRoot'}),
  ]
}

const navigateToThread = (action: Chat2Gen.NavigateToThreadPayload) => {
  const {conversationIDKey, reason} = action.payload
  const visible = Router2Constants.getVisibleScreen()
  const visibleConvo = visible?.params?.conversationIDKey
  const visibleRouteName = visible?.routeName

  if (visibleRouteName !== Constants.threadRouteName && reason === 'findNewestConversation') {
    // service is telling us to change our selection but we're not looking, ignore
    return false
  }

  const modalPath = Router2Constants.getModalStack()
  const mainPath = Router2Constants.getMainStack()

  const modalClearAction = modalPath.length > 0 ? [RouteTreeGen.createClearModals()] : []
  const tabSwitchAction =
    mainPath[1]?.routeName !== Tabs.chatTab ? [RouteTreeGen.createSwitchTab({tab: Tabs.chatTab})] : []

  // we select the chat tab and change the params
  if (Constants.isSplit) {
    return [
      ...tabSwitchAction,
      ...modalClearAction,
      RouteTreeGen.createSetParams({key: 'chatRoot', params: {conversationIDKey}}),
      RouteTreeGen.createNavUpToScreen({routeName: Constants.threadRouteName}),
    ]
  } else {
    // immediately switch stack to an inbox | thread stack
    if (reason === 'push' || reason === 'savedLastState') {
      return [
        ...modalClearAction,
        RouteTreeGen.createResetStack({
          actions: [
            RouteTreeGen.createNavigateAppend({
              path: [{props: {conversationIDKey}, selected: Constants.threadRouteName}],
            }),
          ],
          index: 1,
          tab: Tabs.chatTab,
        }),
        ...tabSwitchAction,
      ]
    } else {
      // replace if looking at the pending / waiting screen
      const replace =
        visibleRouteName === Constants.threadRouteName && !Constants.isValidConversationIDKey(visibleConvo)
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
function* mobileMessageAttachmentShare(
  _: Container.TypedState,
  action: Chat2Gen.MessageAttachmentNativeSharePayload,
  logger: Saga.SagaLogger
) {
  const {message} = action.payload
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  const filePath = yield* downloadAttachment(true, message, logger)
  if (!filePath) {
    logger.info('Downloading attachment failed')
    return
  }

  if (isIOS && message.fileName.endsWith('.pdf')) {
    yield Saga.put(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              title: message.title || message.fileName,
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
    yield showShareActionSheet({filePath, mimeType: message.fileType})
  } catch (e) {
    logger.error('Failed to share attachment: ' + JSON.stringify(e))
  }
}

// Native save to camera roll
function* mobileMessageAttachmentSave(
  _: Container.TypedState,
  action: Chat2Gen.MessageAttachmentNativeSavePayload,
  logger: Saga.SagaLogger
) {
  const {message} = action.payload
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  const {conversationIDKey, ordinal, fileType} = message
  const fileName = yield* downloadAttachment(true, message, logger)
  if (!fileName) {
    // failed to download
    logger.info('Downloading attachment failed')
    return
  }
  yield Saga.put(Chat2Gen.createAttachmentMobileSave({conversationIDKey, ordinal}))
  try {
    logger.info('Trying to save chat attachment to camera roll')
    yield saveAttachmentToCameraRoll(fileName, fileType)
  } catch (err) {
    logger.error('Failed to save attachment: ' + err)
    throw new Error('Failed to save attachment: ' + err)
  }
  yield Saga.put(Chat2Gen.createAttachmentMobileSaved({conversationIDKey, ordinal}))
}

const joinConversation = async (action: Chat2Gen.JoinConversationPayload) => {
  await RPCChatTypes.localJoinConversationByIDLocalRpcPromise(
    {convID: Types.keyToConversationID(action.payload.conversationIDKey)},
    Constants.waitingKeyJoinConversation
  )
}

const fetchConversationBio = async (
  state: Container.TypedState,
  action: Chat2Gen.SelectedConversationPayload
) => {
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

const leaveConversation = async (action: Chat2Gen.LeaveConversationPayload) => {
  await RPCChatTypes.localLeaveConversationLocalRpcPromise(
    {
      convID: Types.keyToConversationID(action.payload.conversationIDKey),
    },
    Constants.waitingKeyLeaveConversation
  )
}

const muteConversation = async (action: Chat2Gen.MuteConversationPayload) => {
  const {muted, conversationIDKey} = action.payload
  await RPCChatTypes.localSetConversationStatusLocalRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    status: muted ? RPCChatTypes.ConversationStatus.muted : RPCChatTypes.ConversationStatus.unfiled,
  })
}

const updateNotificationSettings = async (action: Chat2Gen.UpdateNotificationSettingsPayload) => {
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

function* blockConversation(_: Container.TypedState, action: Chat2Gen.BlockConversationPayload) {
  const {conversationIDKey, reportUser} = action.payload
  yield Saga.put(Chat2Gen.createNavigateToInbox())
  yield Saga.put(ConfigGen.createPersistRoute({}))
  yield Saga.callUntyped(RPCChatTypes.localSetConversationStatusLocalRpcPromise, {
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    status: reportUser ? RPCChatTypes.ConversationStatus.reported : RPCChatTypes.ConversationStatus.blocked,
  })
}

function* hideConversation(
  _: Container.TypedState,
  action: Chat2Gen.HideConversationPayload,
  logger: Saga.SagaLogger
) {
  const {conversationIDKey} = action.payload
  // Nav to inbox but don't use findNewConversation since changeSelectedConversation
  // does that with better information. It knows the conversation is hidden even before
  // that state bounces back.
  yield Saga.put(Chat2Gen.createNavigateToInbox())
  yield Saga.put(Chat2Gen.createShowInfoPanel({show: false}))
  try {
    yield RPCChatTypes.localSetConversationStatusLocalRpcPromise(
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

function* unhideConversation(
  _: Container.TypedState,
  action: Chat2Gen.HideConversationPayload,
  logger: Saga.SagaLogger
) {
  const {conversationIDKey} = action.payload
  try {
    yield RPCChatTypes.localSetConversationStatusLocalRpcPromise(
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

const setConvRetentionPolicy = (action: Chat2Gen.SetConvRetentionPolicyPayload, logger: Saga.SagaLogger) => {
  const {conversationIDKey} = action.payload
  const convID = Types.keyToConversationID(conversationIDKey)
  let policy: RPCChatTypes.RetentionPolicy | null
  try {
    policy = TeamsConstants.retentionPolicyToServiceRetentionPolicy(action.payload.policy)
    if (policy) {
      return RPCChatTypes.localSetConvRetentionLocalRpcPromise({convID, policy})
    }
  } catch (err) {
    // should never happen
    logger.error(`Unable to parse retention policy: ${err.message}`)
    throw err
  }
  return false
}

const toggleMessageCollapse = (action: Chat2Gen.ToggleMessageCollapsePayload) => {
  const {collapse, conversationIDKey, messageID} = action.payload
  return RPCChatTypes.localToggleMessageCollapseRpcPromise({
    collapse,
    convID: Types.keyToConversationID(conversationIDKey),
    msgID: messageID,
  })
}

// TODO This will break if you try to make 2 new conversations at the same time because there is
// only one pending conversation state.
// The fix involves being able to make multiple pending conversations
function* createConversation(
  state: Container.TypedState,
  action: Chat2Gen.CreateConversationPayload,
  logger: Saga.SagaLogger
) {
  const {username} = state.config
  if (!username) {
    logger.error('Making a convo while logged out?')
    return
  }
  try {
    const result: Saga.RPCPromiseType<typeof RPCChatTypes.localNewConversationLocalRpcPromise> = yield RPCChatTypes.localNewConversationLocalRpcPromise(
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
        yield Saga.put(Chat2Gen.createMetasReceived({metas: [meta]}))
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
        yield Saga.put(Chat2Gen.createSetParticipants({participants}))
      }
      yield Saga.put(
        Chat2Gen.createNavigateToThread({
          conversationIDKey,
          highlightMessageID: action.payload.highlightMessageID,
          reason: 'justCreated',
        })
      )
    }
  } catch (_error) {
    const error = _error as RPCError
    let disallowedUsers = error.fields?.filter((elem: any) => elem.key === 'usernames')
    if (disallowedUsers?.length) {
      const {value} = disallowedUsers[0]
      disallowedUsers = value.split(',')
    }
    const allowedUsers = action.payload.participants.filter(x => !disallowedUsers?.includes(x))
    yield Saga.put(
      Chat2Gen.createConversationErrored({
        allowedUsers,
        code: error.code,
        disallowedUsers,
        message: error.desc,
      })
    )
    yield Saga.put(
      Chat2Gen.createNavigateToThread({
        conversationIDKey: Constants.pendingErrorConversationIDKey,
        highlightMessageID: action.payload.highlightMessageID,
        reason: 'justCreated',
      })
    )
  }
}

const messageReplyPrivately = async (
  state: Container.TypedState,
  action: Chat2Gen.MessageReplyPrivatelyPayload,
  logger: Saga.SagaLogger
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
  return [
    Chat2Gen.createMetasReceived({metas: [meta]}),
    Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'createdMessagePrivately'}),
    Chat2Gen.createMessageSetQuoting({
      ordinal: action.payload.ordinal,
      sourceConversationIDKey: action.payload.sourceConversationIDKey,
      targetConversationIDKey: conversationIDKey,
    }),
  ]
}

// don't bug the users with black bars for network errors. chat isn't going to work in general
const ignoreErrors = [
  RPCTypes.StatusCode.scgenericapierror,
  RPCTypes.StatusCode.scapinetworkerror,
  RPCTypes.StatusCode.sctimeout,
]
function* setConvExplodingMode(
  state: Container.TypedState,
  action: Chat2Gen.SetConvExplodingModePayload,
  logger: Saga.SagaLogger
) {
  const {conversationIDKey, seconds} = action.payload
  logger.info(`Setting exploding mode for conversation ${conversationIDKey} to ${seconds}`)

  // unset a conversation exploding lock for this convo so we accept the new one
  yield Saga.put(Chat2Gen.createSetExplodingModeLock({conversationIDKey, unset: true}))

  const category = Constants.explodingModeGregorKey(conversationIDKey)
  const meta = Constants.getMeta(state, conversationIDKey)
  const convRetention = Constants.getEffectiveRetentionPolicy(meta)
  if (seconds === 0 || seconds === convRetention.seconds) {
    // dismiss the category so we don't leave cruft in the push state
    yield Saga.callUntyped(RPCTypes.gregorDismissCategoryRpcPromise, {category})
  } else {
    // update the category with the exploding time
    try {
      yield Saga.callUntyped(RPCTypes.gregorUpdateCategoryRpcPromise, {
        body: seconds.toString(),
        category,
        dtime: {offset: 0, time: 0},
      })
      if (seconds !== 0) {
        logger.info(`Successfully set exploding mode for conversation ${conversationIDKey} to ${seconds}`)
      } else {
        logger.info(`Successfully unset exploding mode for conversation ${conversationIDKey}`)
      }
    } catch (_e) {
      const e: RPCError = _e
      if (seconds !== 0) {
        logger.error(
          `Failed to set exploding mode for conversation ${conversationIDKey} to ${seconds}. Service responded with: ${e.message}`
        )
      } else {
        logger.error(
          `Failed to unset exploding mode for conversation ${conversationIDKey}. Service responded with: ${e.message}`
        )
      }
      if (ignoreErrors.includes(e.code)) {
        return
      }
      throw e
    }
  }
}

function* loadStaticConfig(
  state: Container.TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  logger: Saga.SagaLogger
) {
  if (state.chat2.staticConfig) {
    return
  }
  const {version} = action.payload
  yield Saga.put(ConfigGen.createDaemonHandshakeWait({increment: true, name: 'chat.loadStatic', version}))
  const res: Saga.RPCPromiseType<typeof RPCChatTypes.localGetStaticConfigRpcPromise> = yield RPCChatTypes.localGetStaticConfigRpcPromise()
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
  yield Saga.put(
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

  yield Saga.put(ConfigGen.createDaemonHandshakeWait({increment: false, name: 'chat.loadStatic', version}))
}

const toggleMessageReaction = async (
  state: Container.TypedState,
  action: Chat2Gen.ToggleMessageReactionPayload,
  logger: Saga.SagaLogger
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
  } catch (e) {
    logger.info(`toggleMessageReaction: failed to post` + e.message)
  }
}

const receivedBadgeState = (action: NotificationsGen.ReceivedBadgeStatePayload) =>
  Chat2Gen.createBadgesUpdated({
    bigTeamBadgeCount: action.payload.badgeState.bigTeamBadgeCount,
    conversations: action.payload.badgeState.conversations || [],
    smallTeamBadgeCount: action.payload.badgeState.smallTeamBadgeCount,
  })

const setMinWriterRole = (action: Chat2Gen.SetMinWriterRolePayload, logger: Saga.SagaLogger) => {
  const {conversationIDKey, role} = action.payload
  logger.info(`Setting minWriterRole to ${role} for convID ${conversationIDKey}`)
  return RPCChatTypes.localSetConvMinWriterRoleLocalRpcPromise({
    convID: Types.keyToConversationID(conversationIDKey),
    role: RPCTypes.TeamRole[role],
  })
}

const unfurlRemove = async (
  state: Container.TypedState,
  action: Chat2Gen.UnfurlRemovePayload,
  logger: Saga.SagaLogger
) => {
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

const unfurlDismissPrompt = (action: Chat2Gen.UnfurlResolvePromptPayload) => {
  const {conversationIDKey, messageID, domain} = action.payload
  return Chat2Gen.createUnfurlTogglePrompt({
    conversationIDKey,
    domain,
    messageID,
    show: false,
  })
}

const unfurlResolvePrompt = (action: Chat2Gen.UnfurlResolvePromptPayload) => {
  const {conversationIDKey, messageID, result} = action.payload
  return RPCChatTypes.localResolveUnfurlPromptRpcPromise({
    convID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    msgID: Types.messageIDToNumber(messageID),
    result,
  })
}

const unsentTextChanged = (state: Container.TypedState, action: Chat2Gen.UnsentTextChangedPayload) => {
  const {conversationIDKey, text} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  return RPCChatTypes.localUpdateUnsentTextRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    text: text.stringValue(),
    tlfName: meta.tlfname,
  })
}

const onGiphyResults = (action: EngineGen.Chat1ChatUiChatGiphySearchResultsPayload) => {
  const {convID, results} = action.payload.params
  return Chat2Gen.createGiphyGotSearchResult({
    conversationIDKey: Types.stringToConversationIDKey(convID),
    results,
  })
}

const onGiphyToggleWindow = (action: EngineGen.Chat1ChatUiChatGiphyToggleResultWindowPayload) => {
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

const onChatCoinFlipStatus = (action: EngineGen.Chat1ChatUiChatCoinFlipStatusPayload) => {
  const {statuses} = action.payload.params
  return Chat2Gen.createUpdateCoinFlipStatus({statuses: statuses || []})
}

const onChatCommandMarkdown = (action: EngineGen.Chat1ChatUiChatCommandMarkdownPayload) => {
  const {convID, md} = action.payload.params
  return Chat2Gen.createSetCommandMarkdown({
    conversationIDKey: Types.stringToConversationIDKey(convID),
    md: md || null,
  })
}

const onChatCommandStatus = (action: EngineGen.Chat1ChatUiChatCommandStatusPayload) => {
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

const onChatMaybeMentionUpdate = (action: EngineGen.Chat1ChatUiChatMaybeMentionUpdatePayload) => {
  const {teamName, channel, info} = action.payload.params
  return Chat2Gen.createSetMaybeMentionInfo({
    info,
    name: Constants.getTeamMentionName(teamName, channel),
  })
}

const resolveMaybeMention = (action: Chat2Gen.ResolveMaybeMentionPayload) =>
  RPCChatTypes.localResolveMaybeMentionRpcPromise({
    mention: {channel: action.payload.channel, name: action.payload.name},
  })

const pinMessage = async (action: Chat2Gen.PinMessagePayload, logger: Saga.SagaLogger) => {
  try {
    await RPCChatTypes.localPinMessageRpcPromise({
      convID: Types.keyToConversationID(action.payload.conversationIDKey),
      msgID: action.payload.messageID,
    })
  } catch (err) {
    logger.error(`pinMessage: ${err.message}`)
  }
}

const unpinMessage = async (action: Chat2Gen.UnpinMessagePayload, logger: Saga.SagaLogger) => {
  try {
    await RPCChatTypes.localUnpinMessageRpcPromise(
      {convID: Types.keyToConversationID(action.payload.conversationIDKey)},
      Constants.waitingKeyUnpin(action.payload.conversationIDKey)
    )
  } catch (err) {
    logger.error(`unpinMessage: ${err.message}`)
  }
}

const ignorePinnedMessage = async (action: Chat2Gen.IgnorePinnedMessagePayload) => {
  await RPCChatTypes.localIgnorePinnedMessageRpcPromise({
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
  })
}

const onUpdateLastCoord = async (action: Chat2Gen.UpdateLastCoordPayload) => {
  const {accuracy, lat, lon} = action.payload.coord
  await RPCChatTypes.localLocationUpdateRpcPromise({coord: {accuracy, lat, lon}})
}

const openChatFromWidget = ({payload: {conversationIDKey}}: Chat2Gen.OpenChatFromWidgetPayload) => [
  ConfigGen.createShowMain(),
  RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}),
  ...(conversationIDKey ? [Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxSmall'})] : []),
]

const gregorPushState = (
  state: Container.TypedState,
  action: GregorGen.PushStatePayload,
  logger: Saga.SagaLogger
) => {
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
        const {category, body} = i.item
        const secondsString = body.toString()
        const seconds = parseInt(secondsString, 10)
        if (isNaN(seconds)) {
          logger.warn(`Got dirty exploding mode ${secondsString} for category ${category}`)
          return current
        }
        const _conversationIDKey = category.substring(Constants.explodingModeGregorKeyPrefix.length)
        const conversationIDKey = Types.stringToConversationIDKey(_conversationIDKey)
        current.push({conversationIDKey, seconds})
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
        const teamID = i.item.category.substr(Constants.blockButtonsGregorPrefix.length)
        if (!state.chat2.blockButtonsMap.get(teamID)) {
          const body: {adder: string} = JSON.parse(i.item.body.toString())
          const adder = body.adder
          actions.push(Chat2Gen.createUpdateBlockButtons({adder, show: true, teamID}))
        } else {
          shouldKeepExistingBlockButtons.set(teamID, true)
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
  action: Chat2Gen.PrepareFulfillRequestFormPayload,
  logger: Saga.SagaLogger
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

const addUsersToChannel = async (action: Chat2Gen.AddUsersToChannelPayload, logger: Saga.SagaLogger) => {
  const {conversationIDKey, usernames} = action.payload

  try {
    await RPCChatTypes.localBulkAddToConvRpcPromise(
      {convID: Types.keyToConversationID(conversationIDKey), usernames},
      Constants.waitingKeyAddUsersToChannel
    )
    return [RouteTreeGen.createClearModals()]
  } catch (err) {
    logger.error(`addUsersToChannel: ${err.message}`) // surfaced in UI via waiting key
    return false
  }
}

const addUserToChannel = async (action: Chat2Gen.AddUserToChannelPayload, logger: Saga.SagaLogger) => {
  const {conversationIDKey, username} = action.payload
  try {
    await RPCChatTypes.localBulkAddToConvRpcPromise(
      {convID: Types.keyToConversationID(conversationIDKey), usernames: [username]},
      Constants.waitingKeyAddUserToChannel(username, conversationIDKey)
    )
    return Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'addedToChannel'})
  } catch (err) {
    logger.error(`addUserToChannel: ${err.message}`) // surfaced in UI via waiting key
    return false
  }
}

const dismissBlockButtons = async (action: Chat2Gen.DismissBlockButtonsPayload, logger: Saga.SagaLogger) => {
  try {
    await RPCTypes.userDismissBlockButtonsRpcPromise({tlfID: action.payload.teamID})
  } catch (err) {
    logger.error(`Couldn't dismiss block buttons: ${err.message}`)
  }
}

const createConversationFromTeamBuilder = (
  state: Container.TypedState,
  {payload: {namespace}}: TeamBuildingGen.FinishedTeamBuildingPayload
) => [
  Chat2Gen.createNavigateToThread({
    conversationIDKey: Constants.pendingWaitingConversationIDKey,
    reason: 'justCreated',
  }),
  Chat2Gen.createCreateConversation({
    participants: [...state[namespace].teamBuilding.finishedTeam].map(u => u.id),
  }),
]

export function* chatTeamBuildingSaga() {
  yield* commonTeamBuildingSaga('chat2')
  yield* Saga.chainAction2(
    TeamBuildingGen.finishedTeamBuilding,
    filterForNs('chat2', createConversationFromTeamBuilder)
  )
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
    if (rows && rows.i && rows.i > 0) {
      return Chat2Gen.createSetInboxNumSmallRows({ignoreWrite: true, rows: rows.i})
    }
  } catch (_) {}
  return false
}

const loadNextBotPage = (state: Container.TypedState, action: Chat2Gen.LoadNextBotPagePayload) =>
  BotsGen.createGetFeaturedBots({
    limit: action.payload.pageSize,
    page: state.chat2.featuredBotsPage + 1,
  })

const refreshBotRoleInConv = async (
  action: Chat2Gen.RefreshBotRoleInConvPayload,
  logger: Saga.SagaLogger
) => {
  let role: RPCTypes.TeamRole | undefined
  const {conversationIDKey, username} = action.payload
  try {
    role = await RPCChatTypes.localGetTeamRoleInConversationRpcPromise({
      convID: Types.keyToConversationID(conversationIDKey),
      username,
    })
  } catch (err) {
    logger.info(`refreshBotRoleInConv: failed to refresh bot team role: ${err.message}`)
    return
  }
  const trole = TeamsConstants.teamRoleByEnum[role]
  return Chat2Gen.createSetBotRoleInConv({
    conversationIDKey,
    role: !trole || trole === 'none' ? null : trole,
    username,
  })
}

const refreshBotPublicCommands = async (
  action: Chat2Gen.RefreshBotPublicCommandsPayload,
  logger: Saga.SagaLogger
) => {
  let res: RPCChatTypes.ListBotCommandsLocalRes | undefined
  const {username} = action.payload
  try {
    res = await RPCChatTypes.localListPublicBotCommandsLocalRpcPromise({
      username,
    })
  } catch (e) {
    logger.info('refreshBotPublicCommands: failed to get public commands: ' + e.message)
    return Chat2Gen.createSetBotPublicCommands({
      commands: {commands: [], loadError: true},
      username,
    })
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
  if (meta && meta.teamname) {
    actions.push(TeamsGen.createGetMembers({teamID: meta.teamID}))
  }
  return actions
}

const addBotMember = async (
  state: Container.TypedState,
  action: Chat2Gen.AddBotMemberPayload,
  logger: Saga.SagaLogger
) => {
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
  } catch (err) {
    logger.info('addBotMember: failed to add bot member: ' + err.message)
    return false
  }
  return closeBotModal(state, conversationIDKey)
}

const editBotSettings = async (
  state: Container.TypedState,
  action: Chat2Gen.EditBotSettingsPayload,
  logger: Saga.SagaLogger
) => {
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
  } catch (err) {
    logger.info('addBotMember: failed to edit bot settings: ' + err.message)
    return false
  }
  return closeBotModal(state, conversationIDKey)
}

const removeBotMember = async (
  state: Container.TypedState,
  action: Chat2Gen.RemoveBotMemberPayload,
  logger: Saga.SagaLogger
) => {
  const {conversationIDKey, username} = action.payload
  try {
    await RPCChatTypes.localRemoveBotMemberRpcPromise(
      {
        convID: Types.keyToConversationID(conversationIDKey),
        username,
      },
      Constants.waitingKeyBotRemove
    )
  } catch (err) {
    logger.info('removeBotMember: failed to remove bot member: ' + err.message)
    return false
  }
  return closeBotModal(state, conversationIDKey)
}

const refreshBotSettings = async (action: Chat2Gen.RefreshBotSettingsPayload, logger: Saga.SagaLogger) => {
  let settings: RPCTypes.TeamBotSettings | undefined
  const {conversationIDKey, username} = action.payload
  try {
    settings = await RPCChatTypes.localGetBotMemberSettingsRpcPromise({
      convID: Types.keyToConversationID(conversationIDKey),
      username,
    })
  } catch (err) {
    logger.info(`refreshBotSettings: failed to refresh settings for ${username}: ${err.message}`)
    return
  }
  return Chat2Gen.createSetBotSettings({conversationIDKey, settings, username})
}

const onShowInfoPanel = (action: Chat2Gen.ShowInfoPanelPayload) => {
  const {conversationIDKey, show, tab} = action.payload
  if (Container.isPhone) {
    const visibleScreen = Router2Constants.getVisibleScreen()
    if ((visibleScreen?.routeName === 'chatInfoPanel') !== show) {
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

const maybeChangeChatSelection = (action: RouteTreeGen.OnNavChangedPayload, logger: Saga.SagaLogger) => {
  const {prev, next} = action.payload
  const p = prev[prev.length - 1]
  const n = next[next.length - 1]

  const wasModal = prev[1]?.routeName !== 'Main'
  const isModal = next[1]?.routeName !== 'Main'

  // ignore if changes involve a modal
  if (wasModal || isModal) {
    return
  }

  const wasChat = p?.routeName === Constants.threadRouteName
  const isChat = n?.routeName === Constants.threadRouteName

  // nothing to do with chat
  if (!wasChat && !isChat) {
    return false
  }

  const wasID = p?.params?.conversationIDKey
  const isID = n?.params?.conversationIDKey

  logger.info('maybeChangeChatSelection ', {isChat, isID, wasChat, wasID})

  // same? ignore
  if (wasChat && isChat && wasID === isID) {
    return false
  }

  // deselect if there was one
  const deselectAction =
    wasChat && Constants.isValidConversationIDKey(wasID)
      ? [Chat2Gen.createDeselectedConversation({conversationIDKey: wasID})]
      : []

  // still chatting? just select new one
  if (wasChat && isChat && Constants.isValidConversationIDKey(isID)) {
    return [...deselectAction, Chat2Gen.createSelectedConversation({conversationIDKey: isID})]
  }

  // leaving a chat
  if (wasChat && !isChat) {
    return [
      ...deselectAction,
      Chat2Gen.createSelectedConversation({conversationIDKey: Constants.noConversationIDKey}),
    ]
  }

  if (isChat && Constants.isValidConversationIDKey(isID)) {
    return [...deselectAction, Chat2Gen.createSelectedConversation({conversationIDKey: isID})]
  }

  return false
}

const maybeChatTabSelected = (action: RouteTreeGen.OnNavChangedPayload) => {
  const {prev, next} = action.payload
  if (prev[2]?.routeName !== Tabs.chatTab && next[2]?.routeName === Tabs.chatTab) {
    return Chat2Gen.createTabSelected()
  }
  return false
}

const updateDraftState = (action: Chat2Gen.DeselectedConversationPayload) =>
  Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys: [action.payload.conversationIDKey],
    force: true,
    reason: 'refreshPreviousSelected',
  })

function* chat2Saga() {
  // Platform specific actions
  if (Container.isMobile) {
    yield* Saga.chainGenerator<Chat2Gen.MessageAttachmentNativeSharePayload>(
      Chat2Gen.messageAttachmentNativeShare,
      mobileMessageAttachmentShare
    )
    yield* Saga.chainGenerator<Chat2Gen.MessageAttachmentNativeSavePayload>(
      Chat2Gen.messageAttachmentNativeSave,
      mobileMessageAttachmentSave
    )
  } else {
    yield* Saga.chainGenerator<Chat2Gen.DesktopNotificationPayload>(
      Chat2Gen.desktopNotification,
      desktopNotify
    )
  }

  // Refresh the inbox
  yield* Saga.chainAction2([Chat2Gen.inboxRefresh, EngineGen.chat1NotifyChatChatInboxStale], inboxRefresh)
  yield* Saga.chainAction2([Chat2Gen.selectedConversation, Chat2Gen.metasReceived], ensureSelectedTeamLoaded)
  // We've scrolled some new inbox rows into view, queue them up
  yield* Saga.chainAction2(Chat2Gen.metaNeedsUpdating, queueMetaToRequest)
  // We have some items in the queue to process
  yield* Saga.chainGenerator<Chat2Gen.MetaHandleQueuePayload>(Chat2Gen.metaHandleQueue, requestMeta)

  // Actually try and unbox conversations
  yield* Saga.chainAction2([Chat2Gen.metaRequestTrusted, Chat2Gen.selectedConversation], unboxRows)
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatInboxConversation, onGetInboxConvsUnboxed)
  yield* Saga.chainAction(EngineGen.chat1ChatUiChatInboxUnverified, onGetInboxUnverifiedConvs)
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatInboxFailed, onGetInboxConvFailed)
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatInboxLayout, maybeChangeSelectedConv)
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatInboxLayout, ensureWidgetMetas)

  // Load the selected thread
  yield* Saga.chainGenerator<
    | Chat2Gen.NavigateToThreadPayload
    | Chat2Gen.JumpToRecentPayload
    | Chat2Gen.LoadOlderMessagesDueToScrollPayload
    | Chat2Gen.LoadNewerMessagesDueToScrollPayload
    | Chat2Gen.LoadMessagesCenteredPayload
    | Chat2Gen.MarkConversationsStalePayload
    | ConfigGen.ChangedFocusPayload
  >(
    [
      Chat2Gen.navigateToThread,
      Chat2Gen.jumpToRecent,
      Chat2Gen.loadOlderMessagesDueToScroll,
      Chat2Gen.loadNewerMessagesDueToScroll,
      Chat2Gen.loadMessagesCentered,
      Chat2Gen.markConversationsStale,
      ConfigGen.changedFocus,
    ],
    loadMoreMessages
  )

  // get the unread (orange) line
  yield* Saga.chainGenerator<Chat2Gen.SelectedConversationPayload>(
    Chat2Gen.selectedConversation,
    getUnreadline
  )

  yield* Saga.chainAction(Chat2Gen.messageRetry, messageRetry)
  yield* Saga.chainGenerator<Chat2Gen.MessageSendPayload>(Chat2Gen.messageSend, messageSend)
  yield* Saga.chainAction2(Chat2Gen.messageSendByUsernames, messageSendByUsernames)
  yield* Saga.chainGenerator<Chat2Gen.MessageEditPayload>(Chat2Gen.messageEdit, messageEdit)
  yield* Saga.chainAction(Chat2Gen.messageEdit, clearMessageSetEditing)
  yield* Saga.chainAction2(Chat2Gen.messageDelete, messageDelete)
  yield* Saga.chainAction2(Chat2Gen.messageDeleteHistory, deleteMessageHistory)
  yield* Saga.chainAction(Chat2Gen.dismissJourneycard, dismissJourneycard)
  yield* Saga.chainAction(Chat2Gen.confirmScreenResponse, confirmScreenResponse)

  // Giphy
  yield* Saga.chainAction2(Chat2Gen.unsentTextChanged, unsentTextChanged)
  yield* Saga.chainAction2(Chat2Gen.giphySend, giphySend)

  yield* Saga.chainAction(Chat2Gen.unfurlResolvePrompt, unfurlResolvePrompt)
  yield* Saga.chainAction(Chat2Gen.unfurlResolvePrompt, unfurlDismissPrompt)
  yield* Saga.chainAction2(Chat2Gen.unfurlRemove, unfurlRemove)

  yield* Saga.chainAction2(Chat2Gen.previewConversation, previewConversationTeam)
  yield* Saga.chainAction(Chat2Gen.previewConversation, previewConversationPersonMakesAConversation)
  yield* Saga.chainAction2(Chat2Gen.openFolder, openFolder)

  // bots
  yield* Saga.chainAction2(Chat2Gen.loadNextBotPage, loadNextBotPage)
  yield* Saga.chainAction(Chat2Gen.refreshBotPublicCommands, refreshBotPublicCommands)
  yield* Saga.chainAction2(Chat2Gen.addBotMember, addBotMember)
  yield* Saga.chainAction2(Chat2Gen.editBotSettings, editBotSettings)
  yield* Saga.chainAction2(Chat2Gen.removeBotMember, removeBotMember)
  yield* Saga.chainAction(Chat2Gen.refreshBotSettings, refreshBotSettings)
  yield* Saga.chainAction2(Chat2Gen.findGeneralConvIDFromTeamID, findGeneralConvIDFromTeamID)
  yield* Saga.chainAction(Chat2Gen.refreshBotRoleInConv, refreshBotRoleInConv)

  // On login lets load the untrusted inbox. This helps make some flows easier
  yield* Saga.chainAction2(ConfigGen.bootstrapStatusLoaded, startupInboxLoad)

  yield* Saga.chainAction(ConfigGen.bootstrapStatusLoaded, startupUserReacjisLoad)

  yield* Saga.chainAction2(Chat2Gen.updateUserReacjis, onUpdateUserReacjis)

  // Search handling
  yield* Saga.chainAction(Chat2Gen.attachmentPreviewSelect, attachmentPreviewSelect)
  yield* Saga.chainGenerator<Chat2Gen.AttachmentDownloadPayload>(
    Chat2Gen.attachmentDownload,
    attachmentDownload
  )
  yield* Saga.chainGenerator<Chat2Gen.AttachmentsUploadPayload>(Chat2Gen.attachmentsUpload, attachmentsUpload)
  yield* Saga.chainAction2(Chat2Gen.attachFromDragAndDrop, attachFromDragAndDrop)
  yield* Saga.chainAction(Chat2Gen.attachmentPasted, attachmentPasted)

  yield* Saga.chainAction(Chat2Gen.sendTyping, sendTyping)
  yield* Saga.chainAction2(Chat2Gen.resetChatWithoutThem, resetChatWithoutThem)
  yield* Saga.chainAction(Chat2Gen.resetLetThemIn, resetLetThemIn)

  yield* Saga.chainAction2(
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
  yield* Saga.chainAction2(Chat2Gen.messagesAdd, messagesAdd)
  yield* Saga.chainAction2(
    [
      Chat2Gen.leaveConversation,
      TeamsGen.leftTeam,
      TeamsGen.deleteChannelConfirmed,
      TeamsGen.deleteMultiChannelsConfirmed,
    ],
    clearModalsFromConvEvent
  )
  yield* Saga.chainAction(
    [Chat2Gen.navigateToInbox, Chat2Gen.leaveConversation, TeamsGen.leftTeam],
    navigateToInbox
  )
  yield* Saga.chainAction(Chat2Gen.navigateToThread, navigateToThread)

  yield* Saga.chainAction(Chat2Gen.joinConversation, joinConversation)
  yield* Saga.chainAction(Chat2Gen.leaveConversation, leaveConversation)

  yield* Saga.chainAction(Chat2Gen.muteConversation, muteConversation)
  yield* Saga.chainAction(Chat2Gen.updateNotificationSettings, updateNotificationSettings)
  yield* Saga.chainGenerator<Chat2Gen.BlockConversationPayload>(Chat2Gen.blockConversation, blockConversation)
  yield* Saga.chainGenerator<Chat2Gen.HideConversationPayload>(Chat2Gen.hideConversation, hideConversation)
  yield* Saga.chainGenerator<Chat2Gen.HideConversationPayload>(
    Chat2Gen.unhideConversation,
    unhideConversation
  )

  yield* Saga.chainAction(Chat2Gen.setConvRetentionPolicy, setConvRetentionPolicy)
  yield* Saga.chainAction(Chat2Gen.toggleMessageCollapse, toggleMessageCollapse)
  yield* Saga.chainGenerator<Chat2Gen.CreateConversationPayload>(
    Chat2Gen.createConversation,
    createConversation
  )
  yield* Saga.chainAction2(Chat2Gen.messageReplyPrivately, messageReplyPrivately)
  yield* Saga.chainAction(Chat2Gen.openChatFromWidget, openChatFromWidget)

  // Exploding things
  yield* Saga.chainGenerator<Chat2Gen.SetConvExplodingModePayload>(
    Chat2Gen.setConvExplodingMode,
    setConvExplodingMode
  )
  yield* Saga.chainAction2(Chat2Gen.toggleMessageReaction, toggleMessageReaction)
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(ConfigGen.daemonHandshake, loadStaticConfig)
  yield* Saga.chainAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  yield* Saga.chainAction(Chat2Gen.setMinWriterRole, setMinWriterRole)
  yield* Saga.chainAction2(GregorGen.pushState, gregorPushState)
  yield* Saga.chainAction2(Chat2Gen.prepareFulfillRequestForm, prepareFulfillRequestForm)

  yield* Saga.chainGenerator<Chat2Gen.ChannelSuggestionsTriggeredPayload>(
    Chat2Gen.channelSuggestionsTriggered,
    loadSuggestionData
  )

  yield* Saga.chainAction2(Chat2Gen.refreshMutualTeamsInConv, refreshMutualTeamsInConv)

  yield* Saga.chainAction(Chat2Gen.fetchUserEmoji, fetchUserEmoji)

  yield* Saga.chainAction(Chat2Gen.addUsersToChannel, addUsersToChannel)
  yield* Saga.chainAction(Chat2Gen.addUserToChannel, addUserToChannel)

  yield* Saga.chainAction(EngineGen.chat1NotifyChatChatPromptUnfurl, onChatPromptUnfurl)
  yield* Saga.chainAction(
    EngineGen.chat1NotifyChatChatAttachmentUploadProgress,
    onChatAttachmentUploadProgress
  )
  yield* Saga.chainAction(EngineGen.chat1NotifyChatChatAttachmentUploadStart, onChatAttachmentUploadStart)
  yield* Saga.chainAction(EngineGen.chat1NotifyChatChatIdentifyUpdate, onChatIdentifyUpdate)
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatChatInboxSyncStarted, onChatInboxSyncStarted)
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatChatInboxSynced, onChatInboxSynced)
  yield* Saga.chainAction(EngineGen.chat1NotifyChatChatPaymentInfo, onChatPaymentInfo)
  yield* Saga.chainAction(EngineGen.chat1NotifyChatChatRequestInfo, onChatRequestInfo)
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatChatSetConvRetention, onChatSetConvRetention)
  yield* Saga.chainAction(EngineGen.chat1NotifyChatChatSetConvSettings, onChatSetConvSettings)
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatChatSetTeamRetention, onChatSetTeamRetention)
  yield* Saga.chainAction(EngineGen.chat1NotifyChatChatSubteamRename, onChatSubteamRename)
  yield* Saga.chainAction(EngineGen.chat1NotifyChatChatTLFFinalize, onChatChatTLFFinalizePayload)
  yield* Saga.chainAction(EngineGen.chat1NotifyChatChatThreadsStale, onChatThreadStale)
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatNewChatActivity, onNewChatActivity)
  yield* Saga.chainAction(EngineGen.chat1ChatUiChatGiphySearchResults, onGiphyResults)
  yield* Saga.chainAction(EngineGen.chat1ChatUiChatGiphyToggleResultWindow, onGiphyToggleWindow)
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatShowManageChannels, onChatShowManageChannels)
  yield* Saga.chainAction(EngineGen.chat1ChatUiChatCoinFlipStatus, onChatCoinFlipStatus)
  yield* Saga.chainAction(EngineGen.chat1ChatUiChatCommandMarkdown, onChatCommandMarkdown)
  yield* Saga.chainAction(EngineGen.chat1ChatUiChatCommandStatus, onChatCommandStatus)
  yield* Saga.chainAction(EngineGen.chat1ChatUiChatMaybeMentionUpdate, onChatMaybeMentionUpdate)

  yield* Saga.chainAction(Chat2Gen.replyJump, onReplyJump)

  yield* Saga.chainGenerator<Chat2Gen.InboxSearchPayload>(Chat2Gen.inboxSearch, inboxSearch)
  yield* Saga.chainAction2(Chat2Gen.toggleInboxSearch, onToggleInboxSearch)
  yield* Saga.chainAction2(Chat2Gen.inboxSearchSelect, onInboxSearchSelect)
  yield* Saga.chainAction2(Chat2Gen.inboxSearchNameResults, onInboxSearchNameResults)
  yield* Saga.chainAction2(Chat2Gen.inboxSearchTextResult, onInboxSearchTextResult)
  yield* Saga.chainAction2(ConfigGen.mobileAppState, maybeCancelInboxSearchOnFocusChanged)

  yield* Saga.chainGenerator<Chat2Gen.ThreadSearchPayload>(Chat2Gen.threadSearch, threadSearch)
  yield* Saga.chainAction2(Chat2Gen.toggleThreadSearch, onToggleThreadSearch)

  yield* Saga.chainAction(Chat2Gen.resolveMaybeMention, resolveMaybeMention)

  yield* Saga.chainAction(Chat2Gen.pinMessage, pinMessage)
  yield* Saga.chainAction(Chat2Gen.unpinMessage, unpinMessage)
  yield* Saga.chainAction(Chat2Gen.ignorePinnedMessage, ignorePinnedMessage)

  yield* Saga.chainAction(Chat2Gen.updateLastCoord, onUpdateLastCoord)

  yield* Saga.chainGenerator<Chat2Gen.LoadAttachmentViewPayload>(
    Chat2Gen.loadAttachmentView,
    loadAttachmentView
  )

  yield* Saga.chainAction2(Chat2Gen.selectedConversation, ensureSelectedMeta)

  yield* Saga.chainAction(Chat2Gen.showInfoPanel, onShowInfoPanel)

  yield* Saga.chainAction2(Chat2Gen.selectedConversation, fetchConversationBio)

  yield* Saga.chainAction2(Chat2Gen.sendAudioRecording, sendAudioRecording)

  yield* Saga.chainAction2(EngineGen.connected, onConnect)
  yield* Saga.chainAction2(Chat2Gen.setInboxNumSmallRows, setInboxNumSmallRows)
  yield* Saga.chainAction2(ConfigGen.bootstrapStatusLoaded, getInboxNumSmallRows)

  yield* Saga.chainAction(Chat2Gen.dismissBlockButtons, dismissBlockButtons)

  yield* chatTeamBuildingSaga()
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatChatConvUpdate, onChatConvUpdate)

  yield* Saga.chainAction(RouteTreeGen.onNavChanged, maybeChangeChatSelection)
  yield* Saga.chainAction(RouteTreeGen.onNavChanged, maybeChatTabSelected)
  yield* Saga.chainAction(Chat2Gen.deselectedConversation, updateDraftState)
}

export default chat2Saga
