import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as DeeplinksGen from '../deeplinks-gen'
import * as EngineGen from '../engine-gen-gen'
import * as TeamBuildingGen from '../team-building-gen'
import * as Constants from '../../constants/chat2'
import * as GregorGen from '../gregor-gen'
import * as I from 'immutable'
import * as FsConstants from '../../constants/fs'
import * as Flow from '../../util/flow'
import * as NotificationsGen from '../notifications-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as WalletsGen from '../wallets-gen'
import * as Saga from '../../util/saga'
import * as SearchGen from '../search-gen'
import * as TeamsGen from '../teams-gen'
import * as Types from '../../constants/types/chat2'
import * as FsTypes from '../../constants/types/fs'
import * as WalletTypes from '../../constants/types/wallets'
import * as Tabs from '../../constants/tabs'
import * as UsersGen from '../users-gen'
import * as WaitingGen from '../waiting-gen'
import * as Router2Constants from '../../constants/router2'
import commonTeamBuildingSaga, {filterForNs} from '../team-building'
import * as TeamsConstants from '../../constants/teams'
import logger from '../../logger'
import {isMobile, isIOS} from '../../constants/platform'
import {NotifyPopup} from '../../native/notifications'
import {
  requestLocationPermission,
  saveAttachmentToCameraRoll,
  showShareActionSheetFromFile,
} from '../platform-specific'
import {downloadFilePath} from '../../util/file'
import {privateFolderWithUsers, teamFolder} from '../../constants/config'
import {RPCError} from '../../util/errors'
import HiddenString from '../../util/hidden-string'
import {TypedActions, TypedState} from 'util/container'
import {getEngine} from '../../engine/require'
import {store} from 'emoji-mart'

const onConnect = () => {
  RPCTypes.delegateUiCtlRegisterChatUIRpcPromise()
    .then(() => console.log('Registered Chat UI'))
    .catch(error => console.warn('Error in registering Chat UI:', error))
}

// Ask the service to refresh the inbox
function* inboxRefresh(
  state: TypedState,
  action:
    | Chat2Gen.InboxRefreshPayload
    | EngineGen.Chat1NotifyChatChatInboxStalePayload
    | EngineGen.Chat1NotifyChatChatJoinedConversationPayload
    | EngineGen.Chat1NotifyChatChatLeftConversationPayload,
  logger: Saga.SagaLogger
) {
  if (!state.config.loggedIn) {
    return
  }

  const username = state.config.username
  if (!username) {
    return
  }

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
    case EngineGen.chat1NotifyChatChatJoinedConversation:
      reason = 'joinedAConversation'
      break
    case EngineGen.chat1NotifyChatChatLeftConversation:
      clearExistingMetas = true
      reason = 'leftAConversation'
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
  }

  logger.info(`Inbox refresh due to ${reason || '???'}`)

  const onUnverified = function({inbox}) {
    const result: RPCChatTypes.UnverifiedInboxUIItems = JSON.parse(inbox)
    const items: Array<RPCChatTypes.UnverifiedInboxUIItem> = result.items || []
    // We get a subset of meta information from the cache even in the untrusted payload
    const metas = items.reduce<Array<Types.ConversationMeta>>((arr, item) => {
      const m = Constants.unverifiedInboxUIItemToConversationMeta(item)
      m && arr.push(m)
      return arr
    }, [])
    // Check if some of our existing stored metas might no longer be valid
    return Saga.put(
      Chat2Gen.createMetasReceived({
        clearExistingMessages,
        clearExistingMetas,
        fromInboxRefresh: true,
        initialTrustedLoad: reason === 'initialTrustedLoad',
        metas,
      })
    )
  }

  yield* Saga.callRPCs(
    RPCChatTypes.localGetInboxNonblockLocalRpcSaga({
      incomingCallMap: {'chat.1.chatUi.chatInboxUnverified': onUnverified},
      params: {
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        maxUnbox: 0,
        query: Constants.makeInboxQuery([]),
        skipUnverified: false,
      },
      waitingKey: Constants.waitingKeyInboxRefresh,
    })
  )
}

// When we get info on a team we need to unbox immediately so we can get the channel names
const requestTeamsUnboxing = (_: TypedState, action: Chat2Gen.MetasReceivedPayload) => {
  const conversationIDKeys = action.payload.metas
    .filter(meta => meta.trustedState === 'untrusted' && meta.teamType === 'big' && !meta.channelname)
    .map(meta => meta.conversationIDKey)
  if (conversationIDKeys.length) {
    return Chat2Gen.createMetaRequestTrusted({
      conversationIDKeys,
    })
  }
  return undefined
}

// Only get the untrusted conversations out
const untrustedConversationIDKeys = (state: TypedState, ids: Array<Types.ConversationIDKey>) =>
  ids.filter(id => state.chat2.metaMap.getIn([id, 'trustedState'], 'untrusted') === 'untrusted')

// We keep a set of conversations to unbox
let metaQueue = I.OrderedSet()
const queueMetaToRequest = (
  state: TypedState,
  action: Chat2Gen.MetaNeedsUpdatingPayload,
  logger: Saga.SagaLogger
) => {
  const old = metaQueue
  metaQueue = metaQueue.concat(untrustedConversationIDKeys(state, action.payload.conversationIDKeys))
  if (old !== metaQueue) {
    // only unboxMore if something changed
    return Chat2Gen.createMetaHandleQueue()
  } else {
    logger.info('skipping meta queue run, queue unchanged')
    return undefined
  }
}

// Watch the meta queue and take up to 10 items. Choose the last items first since they're likely still visible
function* requestMeta(state: TypedState, _: Chat2Gen.MetaHandleQueuePayload) {
  const maxToUnboxAtATime = 10
  const maybeUnbox = metaQueue.takeLast(maxToUnboxAtATime)
  metaQueue = metaQueue.skipLast(maxToUnboxAtATime)

  const conversationIDKeys = untrustedConversationIDKeys(state, maybeUnbox.toArray())
  const toUnboxActions = conversationIDKeys.length
    ? [Saga.put(Chat2Gen.createMetaRequestTrusted({conversationIDKeys}))]
    : []
  const unboxSomeMoreActions = metaQueue.size ? [Saga.put(Chat2Gen.createMetaHandleQueue())] : []
  const delayBeforeUnboxingMoreActions =
    toUnboxActions.length && unboxSomeMoreActions.length ? [Saga.callUntyped(Saga.delay, 100)] : []

  const nextActions = [...toUnboxActions, ...delayBeforeUnboxingMoreActions, ...unboxSomeMoreActions]

  if (nextActions.length) {
    yield Saga.sequentially(nextActions)
  }
}

// Get valid keys that we aren't already loading or have loaded
const rpcMetaRequestConversationIDKeys = (
  state: TypedState,
  action:
    | Chat2Gen.MetaRequestTrustedPayload
    | Chat2Gen.SelectConversationPayload
    | Chat2Gen.MetasReceivedPayload
) => {
  let keys: Array<Types.ConversationIDKey>
  switch (action.type) {
    case Chat2Gen.metaRequestTrusted:
      keys = action.payload.conversationIDKeys
      if (action.payload.force) {
        return keys.filter(Constants.isValidConversationIDKey)
      }
      break
    case Chat2Gen.selectConversation:
      keys = [action.payload.conversationIDKey].filter(Constants.isValidConversationIDKey)
      break
    case Chat2Gen.metasReceived:
      keys = [Constants.getSelectedConversation(state)]
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      throw new Error('Invalid action passed to unboxRows')
  }
  return Constants.getConversationIDKeyMetasToLoad(keys, state.chat2.metaMap)
}

// We want to unbox rows that have scroll into view
function* unboxRows(
  state: TypedState,
  action:
    | Chat2Gen.MetaRequestTrustedPayload
    | Chat2Gen.SelectConversationPayload
    | Chat2Gen.MetasReceivedPayload,
  logger: Saga.SagaLogger
) {
  if (!state.config.loggedIn) {
    return
  }

  const conversationIDKeys = rpcMetaRequestConversationIDKeys(state, action)
  if (!conversationIDKeys.length) {
    return
  }

  const onUnboxed = function({conv}) {
    const inboxUIItem: RPCChatTypes.InboxUIItem = JSON.parse(conv)
    // We allow empty conversations now since we create them and they're empty now
    const allowEmpty = action.type === Chat2Gen.selectConversation
    const meta = Constants.inboxUIItemToConversationMeta(inboxUIItem, allowEmpty)
    const actions: Array<Saga.PutEffect> = []
    if (meta) {
      actions.push(
        Saga.put(
          Chat2Gen.createMetasReceived({
            metas: [meta],
            neverCreate: action.type === Chat2Gen.metaRequestTrusted,
          })
        )
      )
    } else {
      actions.push(
        Saga.put(
          Chat2Gen.createMetaReceivedError({
            conversationIDKey: Types.stringToConversationIDKey(inboxUIItem.convID),
            error: null, // just remove this item, not a real server error
            username: null,
          })
        )
      )
    }

    const infoMap = state.users.infoMap
    let added = false
    // We get some info about users also so update that too
    const usernameToFullname = (inboxUIItem.participants || []).reduce<{[key: string]: string}>(
      (map, part) => {
        if (!infoMap.get(part.assertion) && part.fullName) {
          added = true
          map[part.assertion] = part.fullName
        }
        return map
      },
      {}
    )
    if (added) {
      actions.push(Saga.put(UsersGen.createUpdateFullnames({usernameToFullname})))
    }
    return Saga.all(actions)
  }

  const onFailed = ({convID, error}) => {
    const conversationIDKey = Types.conversationIDToKey(convID)
    switch (error.typ) {
      case RPCChatTypes.ConversationErrorType.transient:
        logger.info(
          `onFailed: ignoring transient error for convID: ${conversationIDKey} error: ${error.message}`
        )
        return undefined
      default:
        logger.info(`onFailed: displaying error for convID: ${conversationIDKey} error: ${error.message}`)
        return Saga.callUntyped(function*() {
          const state: TypedState = yield* Saga.selectState()
          yield Saga.put(
            Chat2Gen.createMetaReceivedError({
              conversationIDKey: conversationIDKey,
              error,
              username: state.config.username || '',
            })
          )
        })
    }
  }

  yield Saga.put(Chat2Gen.createMetaRequestingTrusted({conversationIDKeys}))
  yield RPCChatTypes.localGetInboxNonblockLocalRpcSaga({
    incomingCallMap: {
      'chat.1.chatUi.chatInboxConversation': onUnboxed,
      'chat.1.chatUi.chatInboxFailed': onFailed,
      'chat.1.chatUi.chatInboxUnverified': () => {},
    },
    params: {
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      query: Constants.makeInboxQuery(conversationIDKeys),
      skipUnverified: true,
    },
    waitingKey: Constants.waitingKeyUnboxing(conversationIDKeys[0]),
  })
}

// We get an incoming message streamed to us
const onIncomingMessage = (
  state: TypedState,
  incoming: RPCChatTypes.IncomingMessage,
  logger: Saga.SagaLogger
) => {
  const {
    message: cMsg,
    modifiedMessage,
    convID,
    displayDesktopNotification,
    desktopNotificationSnippet,
  } = incoming
  const actions: Array<TypedActions> = []

  if (convID && cMsg) {
    const conversationIDKey = Types.conversationIDToKey(convID)
    const shouldAddMessage = state.chat2.containsLatestMessageMap.get(conversationIDKey, false)
    const message = Constants.uiMessageToMessage(state, conversationIDKey, cMsg)
    if (message) {
      // The attachmentuploaded call is like an 'edit' of an attachment. We get the placeholder, then its replaced by the actual image
      if (
        cMsg.state === RPCChatTypes.MessageUnboxedState.valid &&
        cMsg.valid &&
        cMsg.valid.messageBody.messageType === RPCChatTypes.MessageType.attachmentuploaded &&
        cMsg.valid.messageBody.attachmentuploaded &&
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
        actions.push(Chat2Gen.createMessagesAdd({context: {type: 'incoming'}, messages: [message]}))
      }
    } else if (cMsg.state === RPCChatTypes.MessageUnboxedState.valid && cMsg.valid) {
      const valid = cMsg.valid
      const body = valid.messageBody
      logger.info(`Got chat incoming message of messageType: ${body.messageType}`)
      // Types that are mutations
      switch (body.messageType) {
        case RPCChatTypes.MessageType.edit:
          if (modifiedMessage) {
            const modMessage = Constants.uiMessageToMessage(state, conversationIDKey, modifiedMessage)
            if (modMessage) {
              actions.push(Chat2Gen.createMessagesAdd({context: {type: 'incoming'}, messages: [modMessage]}))
            }
          }
          break
        case RPCChatTypes.MessageType.delete:
          if (body.delete && body.delete.messageIDs) {
            // check if the delete is acting on an exploding message
            const messageIDs = body.delete.messageIDs
            const messages = state.chat2.messageMap.get(conversationIDKey)
            const isExplodeNow =
              !!messages &&
              messageIDs.some(_id => {
                const id = Types.numberToOrdinal(_id)
                const message = messages.get(id) || messages.find(msg => msg.id === id)
                if (
                  message &&
                  (message.type === 'text' || message.type === 'attachment') &&
                  message.exploding
                ) {
                  return true
                }
                return false
              })

            actions.push(
              isExplodeNow
                ? Chat2Gen.createMessagesExploded({
                    conversationIDKey,
                    explodedBy: valid.senderUsername,
                    messageIDs: messageIDs,
                  })
                : Chat2Gen.createMessagesWereDeleted({conversationIDKey, messageIDs})
            )
          }
          break
      }
    }
    if (
      !isMobile &&
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
  payload: {
    readonly conv?: RPCChatTypes.InboxUIItem | null
  } | null,
  ignoreDelete?: boolean
) => {
  const conv = payload ? payload.conv : null
  const meta = conv && Constants.inboxUIItemToConversationMeta(conv)
  const conversationIDKey = meta
    ? meta.conversationIDKey
    : conv && Types.stringToConversationIDKey(conv.convID)
  const usernameToFullname = ((conv && conv.participants) || []).reduce((map, part) => {
    if (part.fullName) {
      map[part.assertion] = part.fullName
    }
    return map
  }, {})
  // We ignore inbox rows that are blocked/reported or have no content
  const isADelete =
    !ignoreDelete &&
    conv &&
    ([RPCChatTypes.ConversationStatus.blocked, RPCChatTypes.ConversationStatus.reported].includes(
      conv.status
    ) ||
      conv.isEmpty)

  // We want to select a different convo if its cause we blocked/reported. Otherwise sometimes we get that a convo
  // is empty which we don't want to select something else as sometimes we're in the middle of making it!
  const selectSomethingElse = conv ? !conv.isEmpty : false
  return meta
    ? [
        isADelete
          ? Chat2Gen.createMetaDelete({conversationIDKey: meta.conversationIDKey, selectSomethingElse})
          : Chat2Gen.createMetasReceived({metas: [meta]}),
        UsersGen.createUpdateFullnames({usernameToFullname}),
      ]
    : conversationIDKey && isADelete
    ? [Chat2Gen.createMetaDelete({conversationIDKey, selectSomethingElse})]
    : []
}

// We got errors from the service
const onErrorMessage = (outboxRecords: Array<RPCChatTypes.OutboxRecord>) => {
  const actions = outboxRecords.reduce<Array<TypedActions>>((arr, outboxRecord) => {
    const s = outboxRecord.state
    if (s.state === RPCChatTypes.OutboxStateType.error) {
      const error = s.error

      const conversationIDKey = Types.conversationIDToKey(outboxRecord.convID)
      const outboxID = Types.rpcOutboxIDToOutboxID(outboxRecord.outboxID)

      if (error) {
        // This is temp until fixed by CORE-7112. We get this error but not the call to let us show the red banner
        const reason = Constants.rpcErrorToString(error)
        let tempForceRedBox: string | null = null
        if (error.typ === RPCChatTypes.OutboxErrorType.identify) {
          // Find out the user who failed identify
          const match = error.message && error.message.match(/"(.*)"/)
          tempForceRedBox = match && match[1]
        }
        arr.push(Chat2Gen.createMessageErrored({conversationIDKey, outboxID, reason}))
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
const onChatIdentifyUpdate = (_: TypedState, action: EngineGen.Chat1NotifyChatChatIdentifyUpdatePayload) => {
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
const expungeToActions = (state: TypedState, expunge: RPCChatTypes.ExpungeInfo) => {
  const actions: Array<TypedActions> = []
  const meta = !!expunge.conv && Constants.inboxUIItemToConversationMeta(expunge.conv)
  if (meta) {
    actions.push(Chat2Gen.createMetasReceived({fromExpunge: true, metas: [meta]}))
  }
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
  const actions: Array<TypedActions> = []
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

const messagesUpdatedToActions = (state: TypedState, info: RPCChatTypes.MessagesUpdated) => {
  const conversationIDKey = Types.conversationIDToKey(info.convID)
  const messages = (info.updates || []).reduce<
    Array<{
      message: Types.Message
      messageID: Types.MessageID
    }>
  >((l, msg) => {
    const messageID = Constants.getMessageID(msg)
    if (!messageID) {
      return l
    }
    const uiMsg = Constants.uiMessageToMessage(state, conversationIDKey, msg)
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

const onChatPromptUnfurl = (_: TypedState, action: EngineGen.Chat1NotifyChatChatPromptUnfurlPayload) => {
  const {convID, domain, msgID} = action.payload.params
  return Chat2Gen.createUnfurlTogglePrompt({
    conversationIDKey: Types.conversationIDToKey(convID),
    domain,
    messageID: Types.numberToMessageID(msgID),
    show: true,
  })
}

const onChatAttachmentUploadProgress = (
  _: TypedState,
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
  _: TypedState,
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
const onChatInboxSynced = (state: TypedState, action: EngineGen.Chat1NotifyChatChatInboxSyncedPayload) => {
  const {syncRes} = action.payload.params
  const actions: Array<TypedActions> = [
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
      const selectedConversation = Constants.getSelectedConversation(state)
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
  _: TypedState,
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
  return Chat2Gen.createPaymentInfoReceived({
    conversationIDKey,
    messageID: msgID,
    paymentInfo,
  })
}

const onChatRequestInfo = (
  _: TypedState,
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
  return Chat2Gen.createRequestInfoReceived({
    conversationIDKey,
    messageID: msgID,
    requestInfo,
  })
}

const onChatSetConvRetention = (
  _: TypedState,
  action: EngineGen.Chat1NotifyChatChatSetConvRetentionPayload,
  logger: Saga.SagaLogger
) => {
  const {conv, convID} = action.payload.params
  if (conv) {
    return Chat2Gen.createUpdateConvRetentionPolicy({conv})
  }
  logger.warn('got NotifyChat.ChatSetConvRetention with no attached InboxUIItem. Forcing update.')
  // force to get the new retention policy
  return Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys: [Types.conversationIDToKey(convID)],
    force: true,
  })
}

const onChatSetConvSettings = (
  _: TypedState,
  action: EngineGen.Chat1NotifyChatChatSetConvSettingsPayload,
  logger: Saga.SagaLogger
) => {
  const {conv, convID} = action.payload.params
  const conversationIDKey = Types.conversationIDToKey(convID)
  const newRole =
    (conv &&
      conv.convSettings &&
      conv.convSettings.minWriterRoleInfo &&
      conv.convSettings.minWriterRoleInfo.role) ||
    null
  const role = newRole && TeamsConstants.teamRoleByEnum[newRole]
  const cannotWrite =
    (conv &&
      conv.convSettings &&
      conv.convSettings.minWriterRoleInfo &&
      conv.convSettings.minWriterRoleInfo.cannotWrite) ||
    false
  logger.info(`got new minWriterRole ${role || ''} for convID ${conversationIDKey}`)
  if (role && role !== 'none' && cannotWrite !== undefined) {
    return Chat2Gen.createSaveMinWriterRole({cannotWrite, conversationIDKey, role})
  }
  logger.warn(
    `got NotifyChat.ChatSetConvSettings with no valid minWriterRole for convID ${conversationIDKey}. The local version may be out of date.`
  )
  return undefined
}

const onChatSetTeamRetention = (
  _: TypedState,
  action: EngineGen.Chat1NotifyChatChatSetTeamRetentionPayload,
  logger: Saga.SagaLogger
) => {
  const {convs} = action.payload.params
  if (convs) {
    return Chat2Gen.createUpdateTeamRetentionPolicy({convs})
  }
  // this is a more serious problem, but we don't need to bug the user about it
  logger.error(
    'got NotifyChat.ChatSetTeamRetention with no attached InboxUIItems. The local version may be out of date'
  )
  return undefined
}

const onChatSubteamRename = (_: TypedState, action: EngineGen.Chat1NotifyChatChatSubteamRenamePayload) => {
  const {convs} = action.payload.params
  const conversationIDKeys = (convs || []).map(c => Types.stringToConversationIDKey(c.convID))
  return Chat2Gen.createMetaRequestTrusted({
    conversationIDKeys,
    force: true,
  })
}

const onChatChatTLFFinalizePayload = (
  _: TypedState,
  action: EngineGen.Chat1NotifyChatChatTLFFinalizePayload
) => {
  const {convID} = action.payload.params
  return Chat2Gen.createMetaRequestTrusted({conversationIDKeys: [Types.conversationIDToKey(convID)]})
}

const onChatThreadStale = (
  _: TypedState,
  action: EngineGen.Chat1NotifyChatChatThreadsStalePayload,
  logger: Saga.SagaLogger
) => {
  const {updates} = action.payload.params
  let actions: Array<TypedActions> = []
  Object.keys(RPCChatTypes.StaleUpdateType)
    .filter(k => typeof RPCChatTypes.StaleUpdateType[k] === 'number')
    .forEach(function(key) {
      const conversationIDKeys = (updates || []).reduce<Array<string>>((arr, u) => {
        if (u.updateType === RPCChatTypes.StaleUpdateType[key]) {
          arr.push(Types.conversationIDToKey(u.convID))
        }
        return arr
      }, [])
      // load the inbox instead
      if (key === 'convupdate') {
        logger.info(
          `onChatThreadStale: dispatching inbox unbox actions for ${
            conversationIDKeys.length
          } convs of type ${key}`
        )
        actions = actions.concat([
          Chat2Gen.createMetaRequestTrusted({
            conversationIDKeys,
            force: true,
          }),
        ])
      } else if (conversationIDKeys.length > 0) {
        logger.info(
          `onChatThreadStale: dispatching thread reload actions for ${
            conversationIDKeys.length
          } convs of type ${key}`
        )
        actions = actions.concat([
          Chat2Gen.createMarkConversationsStale({
            conversationIDKeys,
            updateType: RPCChatTypes.StaleUpdateType[key],
          }),
          Chat2Gen.createMetaRequestTrusted({
            conversationIDKeys,
            force: true,
          }),
        ])
      }
    })
  return actions
}

const onChatShowManageChannels = (
  _: TypedState,
  action: EngineGen.Chat1ChatUiChatShowManageChannelsPayload
) => {
  const {teamname} = action.payload.params
  return RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
}

const onNewChatActivity = (
  state: TypedState,
  action: EngineGen.Chat1NotifyChatNewChatActivityPayload,
  logger: Saga.SagaLogger
) => {
  const {activity} = action.payload.params
  logger.info(`Got new chat activity of type: ${activity.activityType}`)
  let actions: Array<TypedActions> | null = null
  switch (activity.activityType) {
    case RPCChatTypes.ChatActivityType.incomingMessage: {
      const incomingMessage = activity.incomingMessage
      if (incomingMessage) {
        actions = [
          ...onIncomingMessage(state, incomingMessage, logger),
          ...chatActivityToMetasAction(incomingMessage),
        ]
      }
      break
    }
    case RPCChatTypes.ChatActivityType.setStatus:
      actions = chatActivityToMetasAction(activity.setStatus)
      break
    case RPCChatTypes.ChatActivityType.readMessage:
      actions = chatActivityToMetasAction(activity.readMessage)
      break
    case RPCChatTypes.ChatActivityType.newConversation:
      actions = chatActivityToMetasAction(activity.newConversation, true)
      break
    case RPCChatTypes.ChatActivityType.failedMessage: {
      const failedMessage: RPCChatTypes.FailedMessageInfo | null = activity.failedMessage
      const outboxRecords = failedMessage && failedMessage.outboxRecords
      if (outboxRecords) {
        actions = onErrorMessage(outboxRecords)
      }
      break
    }
    case RPCChatTypes.ChatActivityType.membersUpdate:
      {
        const convID = activity.membersUpdate && activity.membersUpdate.convID
        if (convID) {
          actions = [
            Chat2Gen.createMetaRequestTrusted({
              conversationIDKeys: [Types.conversationIDToKey(convID)],
              force: true,
            }),
          ]
        }
      }
      break
    case RPCChatTypes.ChatActivityType.setAppNotificationSettings:
      {
        const setAppNotificationSettings = activity.setAppNotificationSettings
        if (setAppNotificationSettings) {
          actions = [
            Chat2Gen.createNotificationSettingsUpdated({
              conversationIDKey: Types.conversationIDToKey(setAppNotificationSettings.convID),
              settings: setAppNotificationSettings.settings,
            }),
          ]
        }
      }
      break
    case RPCChatTypes.ChatActivityType.teamtype:
      actions = [Chat2Gen.createInboxRefresh({reason: 'teamTypeChanged'})]
      break
    case RPCChatTypes.ChatActivityType.expunge: {
      const expunge = activity.expunge
      if (expunge) {
        actions = expungeToActions(state, expunge)
      }
      break
    }
    case RPCChatTypes.ChatActivityType.ephemeralPurge:
      if (activity.ephemeralPurge) {
        actions = ephemeralPurgeToActions(activity.ephemeralPurge)
      }
      break
    case RPCChatTypes.ChatActivityType.reactionUpdate:
      if (activity.reactionUpdate) {
        actions = reactionUpdateToActions(activity.reactionUpdate)
      }
      break
    case RPCChatTypes.ChatActivityType.messagesUpdated: {
      const messagesUpdated = activity.messagesUpdated
      if (messagesUpdated) {
        actions = messagesUpdatedToActions(state, messagesUpdated)
      }
      break
    }
    case RPCChatTypes.ChatActivityType.convsUpdated: {
      if (activity.convsUpdated) {
        const inboxUIItems = activity.convsUpdated.items
        const metas = (inboxUIItems || []).reduce<Array<Types.ConversationMeta>>((l, i) => {
          const meta = Constants.inboxUIItemToConversationMeta(i)
          if (meta) {
            l.push(meta)
          }
          return l
        }, [])
        actions = [Chat2Gen.createMetasReceived({metas})]
      }
      break
    }
  }

  return actions
}

const loadThreadMessageTypes = Object.keys(RPCChatTypes.MessageType)
  .filter(k => typeof RPCChatTypes.MessageType[k] === 'number')
  .reduce<Array<number>>((arr, key) => {
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
        arr.push(RPCChatTypes.MessageType[key])
        break
    }

    return arr
  }, [])

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
  let pagination = {
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
  state: TypedState,
  action:
    | Chat2Gen.SelectConversationPayload
    | Chat2Gen.JumpToRecentPayload
    | Chat2Gen.LoadOlderMessagesDueToScrollPayload
    | Chat2Gen.LoadNewerMessagesDueToScrollPayload
    | Chat2Gen.LoadMessagesCenteredPayload
    | Chat2Gen.MarkConversationsStalePayload
    | Chat2Gen.MetasReceivedPayload
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
  let centeredMessageIDs: Array<{
    conversationIDKey: Types.ConversationIDKey
    messageID: Types.MessageID
    highlightMode: Types.CenterOrdinalHighlightMode
  }> = []

  switch (action.type) {
    case ConfigGen.changedFocus:
      if (!isMobile || !action.payload.appFocused) {
        return
      }
      key = Constants.getSelectedConversation(state)
      reason = 'foregrounding'
      break
    case Chat2Gen.markConversationsStale:
      key = Constants.getSelectedConversation(state)
      // not mentioned?
      if (action.payload.conversationIDKeys.indexOf(key) === -1) {
        return
      }
      reason = 'got stale'
      break
    case Chat2Gen.selectConversation:
      key = action.payload.conversationIDKey
      reason = action.payload.reason || 'selected'
      break
    case Chat2Gen.metasReceived:
      if (!action.payload.clearExistingMessages) {
        // we didn't clear anything out, we don't need to fetch anything
        return
      }
      key = Constants.getSelectedConversation(state)
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

  if (meta.membershipType === 'youAreReset' || !meta.rekeyers.isEmpty()) {
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

    const uiMessages: RPCChatTypes.UIMessages = JSON.parse(thread)

    const actions: Array<Saga.PutEffect> = []

    let shouldClearOthers = false
    if ((forceClear || sd === 'none') && !calledClear) {
      shouldClearOthers = true
      calledClear = true
    }
    const messages = (uiMessages.messages || []).reduce<Array<Types.Message>>((arr, m) => {
      const message = conversationIDKey ? Constants.uiMessageToMessage(state, conversationIDKey, m) : null
      if (message) {
        arr.push(message)
      }
      return arr
    }, [])

    const moreToLoad = uiMessages.pagination ? !uiMessages.pagination.last : true
    actions.push(Saga.put(Chat2Gen.createUpdateMoreToLoad({conversationIDKey, moreToLoad})))

    if (messages.length) {
      actions.push(
        Saga.put(
          Chat2Gen.createMessagesAdd({
            centeredMessageIDs,
            context: {conversationIDKey, type: 'threadLoad'},
            forceContainsLatestCalc,
            messages,
            shouldClearOthers,
          })
        )
      )
    }

    return actions
  }

  const onGotThreadLoadStatus = (status: RPCChatTypes.UIChatThreadStatus) => {
    return [Saga.put(Chat2Gen.createSetThreadLoadStatus({conversationIDKey, status}))]
  }

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
    if (e.code !== RPCTypes.StatusCode.scteamreaderror) {
      // scteamreaderror = user is not in team. they'll see the rekey screen so don't throw for that
      throw e
    }
  }
}

function* getUnreadline(
  state: TypedState,
  action: Chat2Gen.SelectConversationPayload,
  logger: Saga.SagaLogger
) {
  // Get the conversationIDKey
  let key: Types.ConversationIDKey | null = null
  switch (action.type) {
    case Chat2Gen.selectConversation:
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

  const {readMsgID} = state.chat2.metaMap.get(conversationIDKey, Constants.makeConversationMeta())
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
}

// Show a desktop notification
function* desktopNotify(
  state: TypedState,
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
              Saga.put(RouteTreeGen.createSwitchTab({tab: 'tabs.chatTab'})),
              Saga.put(RouteTreeGen.createNavUpToScreen({routeName: 'chatRoot'})),
              Saga.put(
                Chat2Gen.createSelectConversation({
                  conversationIDKey,
                  reason: 'desktopNotification',
                })
              ),
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
const messageDelete = (state: TypedState, action: Chat2Gen.MessageDeletePayload, logger: Saga.SagaLogger) => {
  const {conversationIDKey, ordinal} = action.payload
  const message = state.chat2.messageMap.getIn([conversationIDKey, ordinal])
  if (
    !message ||
    (message.type !== 'text' && message.type !== 'attachment' && message.type !== 'requestPayment')
  ) {
    logger.warn('Deleting non-existant or, non-text non-attachment non-requestPayment message')
    logger.debug('Deleting invalid message:', message)
    return
  }

  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (!meta) {
    logger.warn('Deleting message w/ no meta')
    logger.debug('Deleting message w/ no meta', message)
    return
  }

  // We have to cancel pending messages
  if (!message.id) {
    if (message.outboxID) {
      return RPCChatTypes.localCancelPostRpcPromise(
        {outboxID: Types.outboxIDToRpcOutboxID(message.outboxID)},
        Constants.waitingKeyCancelPost
      ).then(() => Chat2Gen.createMessagesWereDeleted({conversationIDKey, ordinals: [message.ordinal]}))
    } else {
      logger.warn('Delete of no message id and no outboxid')
    }
  } else {
    return RPCChatTypes.localPostDeleteNonblockRpcPromise(
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
    ).then(() => {})
  }
  return undefined
}

const clearMessageSetEditing = (_: TypedState, action: Chat2Gen.MessageEditPayload) =>
  Chat2Gen.createMessageSetEditing({
    conversationIDKey: action.payload.conversationIDKey,
    ordinal: null,
  })

function* messageEdit(state: TypedState, action: Chat2Gen.MessageEditPayload, logger: Saga.SagaLogger) {
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
    let actions: Array<Saga.Effect> = [
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

const messageRetry = (_: TypedState, action: Chat2Gen.MessageRetryPayload) => {
  const {outboxID} = action.payload
  return RPCChatTypes.localRetryPostRpcPromise(
    {outboxID: Types.outboxIDToRpcOutboxID(outboxID)},
    Constants.waitingKeyRetryPost
  )
}

function* loadAttachmentView(state: TypedState, action: Chat2Gen.LoadAttachmentViewPayload) {
  const conversationIDKey = action.payload.conversationIDKey
  const viewType = action.payload.viewType

  const onHit = (hit: RPCChatTypes.MessageTypes['chat.1.chatUi.chatLoadGalleryHit']['inParam']) => {
    const message = Constants.uiMessageToMessage(state, conversationIDKey, hit.message)
    return message
      ? Saga.put(Chat2Gen.createAddAttachmentViewMessage({conversationIDKey, message, viewType}))
      : []
  }
  try {
    const res = yield RPCChatTypes.localLoadGalleryRpcSaga({
      incomingCallMap: {
        'chat.1.chatUi.chatLoadGalleryHit': onHit,
      },
      params: {
        convID: Types.keyToConversationID(conversationIDKey),
        fromMsgID: action.payload.fromMsgID,
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

const onToggleThreadSearch = (state: TypedState, action: Chat2Gen.ToggleThreadSearchPayload) => {
  const visible = Constants.getThreadSearchInfo(state, action.payload.conversationIDKey).visible
  return visible ? [] : RPCChatTypes.localCancelActiveSearchRpcPromise()
}

const hideThreadSearch = (state: TypedState, action: Chat2Gen.SelectConversationPayload) => {
  const visible = Constants.getThreadSearchInfo(state, action.payload.conversationIDKey).visible
  return visible
    ? Chat2Gen.createToggleThreadSearch({conversationIDKey: action.payload.conversationIDKey})
    : []
}

function* threadSearch(state: TypedState, action: Chat2Gen.ThreadSearchPayload, logger: Saga.SagaLogger) {
  const {conversationIDKey, query} = action.payload
  const onHit = (hit: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchHit']['inParam']) => {
    const message = Constants.uiMessageToMessage(state, conversationIDKey, hit.searchHit.hitMessage)
    return message
      ? Saga.put(Chat2Gen.createThreadSearchResults({clear: false, conversationIDKey, messages: [message]}))
      : []
  }
  const onInboxHit = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']) => {
    const messages = (resp.searchHit.hits || []).reduce<Array<Types.Message>>((l, h) => {
      const uiMsg = Constants.uiMessageToMessage(state, conversationIDKey, h.hitMessage)
      if (uiMsg) {
        l.push(uiMsg)
      }
      return l
    }, [])
    return messages.length > 0
      ? Saga.put(Chat2Gen.createThreadSearchResults({clear: true, conversationIDKey, messages}))
      : []
  }
  const onDone = () => {
    return Saga.put(Chat2Gen.createSetThreadSearchStatus({conversationIDKey, status: 'done'}))
  }
  const onStart = () => {
    return Saga.put(Chat2Gen.createSetThreadSearchStatus({conversationIDKey, status: 'inprogress'}))
  }
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
          maxConvsHit: 0,
          maxConvsSearched: 0,
          maxHits: 1000,
          maxMessages: -1,
          maxNameConvs: 0,
          reindexMode: RPCChatTypes.ReIndexingMode.postsearchSync,
          sentAfter: 0,
          sentBefore: 0,
          sentBy: '',
          sentTo: '',
        },
        query: query.stringValue(),
      },
    })
  } catch (e) {
    logger.error('search failed: ' + e.message)
    yield Saga.put(Chat2Gen.createSetThreadSearchStatus({conversationIDKey, status: 'done'}))
  }
}

const onInboxSearchSelect = (state: TypedState, action: Chat2Gen.InboxSearchSelectPayload) => {
  const inboxSearch = state.chat2.inboxSearch
  if (!inboxSearch) {
    return
  }
  const selected = Constants.getInboxSearchSelected(inboxSearch)
  const conversationIDKey = action.payload.conversationIDKey
    ? action.payload.conversationIDKey
    : selected === null || selected === undefined
    ? undefined
    : selected.conversationIDKey
  if (!conversationIDKey) {
    return
  }
  const query = action.payload.query ? action.payload.query : selected && selected.query
  const actions: Array<TypedActions> = [
    Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxSearch'}),
  ]
  if (query) {
    actions.push(Chat2Gen.createSetThreadSearchQuery({conversationIDKey, query}))
    actions.push(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
    actions.push(Chat2Gen.createThreadSearch({conversationIDKey, query}))
  } else {
    actions.push(Chat2Gen.createToggleInboxSearch({enabled: false}))
  }
  return actions
}

const onToggleInboxSearch = (state: TypedState) => {
  const inboxSearch = state.chat2.inboxSearch
  if (!inboxSearch) {
    return RPCChatTypes.localCancelActiveInboxSearchRpcPromise()
  }
  return inboxSearch.nameStatus === 'initial' ? Chat2Gen.createInboxSearch({query: new HiddenString('')}) : []
}

function* inboxSearch(_: TypedState, action: Chat2Gen.InboxSearchPayload, logger: Saga.SagaLogger) {
  const {query} = action.payload
  const teamType = (t: RPCChatTypes.TeamType) => (t === RPCChatTypes.TeamType.complex ? 'big' : 'small')
  const onConvHits = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam']) => {
    return Saga.put(
      Chat2Gen.createInboxSearchNameResults({
        results: (resp.hits.hits || []).reduce<I.List<Types.InboxSearchConvHit>>((l, h) => {
          return l.push(
            Constants.makeInboxSearchConvHit({
              conversationIDKey: Types.stringToConversationIDKey(h.convID),
              teamType: teamType(h.teamType),
            })
          )
        }, I.List()),
        unread: resp.hits.unreadMatches,
      })
    )
  }
  const onTextHit = (resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']) => {
    const conversationIDKey = Types.conversationIDToKey(resp.searchHit.convID)
    return Saga.put(
      Chat2Gen.createInboxSearchTextResult({
        result: Constants.makeInboxSearchTextHit({
          conversationIDKey,
          numHits: (resp.searchHit.hits || []).length,
          query: resp.searchHit.query,
          teamType: teamType(resp.searchHit.teamType),
          time: resp.searchHit.time,
        }),
      })
    )
  }
  const onStart = () => {
    return Saga.put(Chat2Gen.createInboxSearchStarted())
  }
  const onDone = () => {
    return Saga.put(Chat2Gen.createInboxSearchSetTextStatus({status: 'success'}))
  }
  const onIndexStatus = (
    resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam']
  ) => {
    return Saga.put(Chat2Gen.createInboxSearchSetIndexPercent({percent: resp.status.percentIndexed}))
  }
  try {
    yield RPCChatTypes.localSearchInboxRpcSaga({
      incomingCallMap: {
        'chat.1.chatUi.chatSearchConvHits': onConvHits,
        'chat.1.chatUi.chatSearchInboxDone': onDone,
        'chat.1.chatUi.chatSearchInboxHit': onTextHit,
        'chat.1.chatUi.chatSearchInboxStart': onStart,
        'chat.1.chatUi.chatSearchIndexStatus': onIndexStatus,
      },
      params: {
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        namesOnly: false,
        opts: {
          afterContext: 0,
          beforeContext: 0,
          isRegex: false,
          matchMentions: false,
          maxConvsHit: Constants.inboxSearchMaxTextResults,
          maxConvsSearched: 0,
          maxHits: Constants.inboxSearchMaxTextMessages,
          maxMessages: -1,
          maxNameConvs:
            query.stringValue().length > 0
              ? Constants.inboxSearchMaxNameResults
              : Constants.inboxSearchMaxUnreadNameResults,
          reindexMode: RPCChatTypes.ReIndexingMode.postsearchSync,
          sentAfter: 0,
          sentBefore: 0,
          sentBy: '',
          sentTo: '',
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

const onReplyJump = (_: TypedState, action: Chat2Gen.ReplyJumpPayload) => {
  return Chat2Gen.createLoadMessagesCentered({
    conversationIDKey: action.payload.conversationIDKey,
    highlightMode: 'flash',
    messageID: action.payload.messageID,
  })
}

function* messageSend(state: TypedState, action: Chat2Gen.MessageSendPayload, logger: Saga.SagaLogger) {
  const {conversationIDKey, text} = action.payload

  const meta = Constants.getMeta(state, conversationIDKey)
  const tlfName = meta.tlfname
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)
  const replyTo = action.payload.replyTo

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
  const onHideConfirm = ({canceled}) =>
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
    return Saga.put(Chat2Gen.createSetPaymentConfirmInfoError({error}))
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
      waitingKey: Constants.waitingKeyPost,
    })
    logger.info('success')
  } catch (e) {
    logger.info('error')
  }

  // Do some logging to track down the root cause of a bug causing
  // messages to not send. Do this after creating the objects above to
  // narrow down the places where the action can possibly stop.
  logger.info('non-empty text?', text.stringValue().length > 0)
}

type StellarConfirmWindowResponse = {result: (b: boolean) => void}
let _stellarConfirmWindowResponse: StellarConfirmWindowResponse | null = null

function storeStellarConfirmWindowResponse(accept: boolean, response: StellarConfirmWindowResponse | null) {
  _stellarConfirmWindowResponse && _stellarConfirmWindowResponse.result(accept)
  _stellarConfirmWindowResponse = response
}

const confirmScreenResponse = (_: TypedState, action: Chat2Gen.ConfirmScreenResponsePayload) => {
  storeStellarConfirmWindowResponse(action.payload.accept, null)
}

// We always make adhoc convos and never preview it
const previewConversationPersonMakesAConversation = (
  _: TypedState,
  action: Chat2Gen.PreviewConversationPayload
) => {
  const {participants} = action.payload
  return (
    !action.payload.teamname &&
    participants && [
      Chat2Gen.createSelectConversation({
        conversationIDKey: Constants.pendingWaitingConversationIDKey,
        reason: 'justCreated',
      }),
      Chat2Gen.createCreateConversation({participants}),
    ]
  )
}

// We preview channels
const previewConversationTeam = (_: TypedState, action: Chat2Gen.PreviewConversationPayload) => {
  if (action.payload.conversationIDKey) {
    const conversationIDKey = action.payload.conversationIDKey

    if (action.payload.reason === 'messageLink' || action.payload.reason === 'teamMention') {
      // Add preview channel to inbox
      return RPCChatTypes.localPreviewConversationByIDLocalRpcPromise({
        convID: Types.keyToConversationID(conversationIDKey),
      }).then(() => Chat2Gen.createSelectConversation({conversationIDKey, reason: 'previewResolved'}))
    }

    return Chat2Gen.createSelectConversation({
      conversationIDKey,
      reason: 'previewResolved',
    })
  }

  if (!action.payload.teamname) {
    return
  }

  const teamname = action.payload.teamname
  const channelname = action.payload.channelname || 'general'

  return RPCChatTypes.localFindConversationsLocalRpcPromise({
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    membersType: RPCChatTypes.ConversationMembersType.team,
    oneChatPerTLF: true,
    tlfName: teamname,
    topicName: channelname,
    topicType: RPCChatTypes.TopicType.chat,
    visibility: RPCTypes.TLFVisibility.private,
  })
    .then(results => {
      const resultMetas = (results.uiConversations || [])
        .map(row => Constants.inboxUIItemToConversationMeta(row))
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

      const conversationIDKey = first.conversationIDKey
      return RPCChatTypes.localPreviewConversationByIDLocalRpcPromise({
        convID: Types.keyToConversationID(conversationIDKey),
      }).then(results => {
        const actions: Array<TypedActions> = []
        const meta = Constants.inboxUIItemToConversationMeta(results.conv)
        if (meta) {
          actions.push(Chat2Gen.createMetasReceived({metas: [meta]}))
        }
        actions.push(
          Chat2Gen.createSelectConversation({
            conversationIDKey,
            reason: 'previewResolved',
          })
        )
        return actions
      })
    })
    .catch(err => {
      if (err.code === RPCTypes.StatusCode.scteamnotfound && action.payload.reason === 'appLink') {
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
    })
}

const startupInboxLoad = (state: TypedState) =>
  !!state.config.username && Chat2Gen.createInboxRefresh({reason: 'bootstrap'})

const changeSelectedConversation = (
  state: TypedState,
  action:
    | Chat2Gen.MetasReceivedPayload
    | Chat2Gen.LeaveConversationPayload
    | Chat2Gen.MetaDeletePayload
    | Chat2Gen.MessageSendPayload
    | Chat2Gen.AttachmentsUploadPayload
    | Chat2Gen.BlockConversationPayload
    | Chat2Gen.HideConversationPayload
    | TeamsGen.LeaveTeamPayload,
  logger: Saga.SagaLogger
) => {
  if (!isMobile) {
    return _maybeAutoselectNewestConversation(state, action, logger)
  }
  return false
}

const _maybeAutoselectNewestConversation = (
  state: TypedState,
  action:
    | Chat2Gen.MetasReceivedPayload
    | Chat2Gen.LeaveConversationPayload
    | Chat2Gen.MetaDeletePayload
    | Chat2Gen.MessageSendPayload
    | Chat2Gen.AttachmentsUploadPayload
    | Chat2Gen.BlockConversationPayload
    | Chat2Gen.HideConversationPayload
    | TeamsGen.LeaveTeamPayload,
  logger: Saga.SagaLogger
) => {
  // If there is a team we should avoid when selecting a new conversation (e.g.
  // on team leave) put the name in `avoidTeam` and `isEligibleConvo` below will
  // take it into account
  let avoidTeam = ''
  if (action.type === TeamsGen.leaveTeam) {
    avoidTeam = action.payload.teamname
  }
  let selected = Constants.getSelectedConversation(state)
  if (selected === Constants.pendingWaitingConversationIDKey) {
    // never auto select when we're building one
    return
  }
  const selectedMeta = state.chat2.metaMap.get(selected)
  if (!selectedMeta) {
    selected = Constants.noConversationIDKey
  }

  let avoidConversationID = Constants.noConversationIDKey
  if (action.type === Chat2Gen.hideConversation) {
    avoidConversationID = selected
  }
  if (action.type === Chat2Gen.metaDelete) {
    if (!action.payload.selectSomethingElse) {
      return
    }
    // only do this if we blocked the current conversation
    if (selected !== Constants.noConversationIDKey && selected !== action.payload.conversationIDKey) {
      return
    }
  }

  if (action.type === Chat2Gen.metasReceived) {
    // If we have new activity, don't switch to it unless no convo was selected
    if (selected !== Constants.noConversationIDKey) {
      return
    }
  } else if (
    (action.type === Chat2Gen.leaveConversation ||
      action.type === Chat2Gen.blockConversation ||
      action.type === Chat2Gen.hideConversation) &&
    action.payload.conversationIDKey === selected
  ) {
    // Intentional fall-through -- force select a new one
  } else if (
    Constants.isValidConversationIDKey(selected) &&
    (!avoidTeam || (selectedMeta && selectedMeta.teamname !== avoidTeam))
  ) {
    return
    // Stay with our existing convo if it was not empty or pending, or the
    // selected convo already doesn't belong to the team we're trying to switch
    // away from, or we're not avoiding it because it's a channel we're leaving
  }

  const isEligibleConvo = (meta: Types.ConversationMeta) => {
    if (meta.teamType === 'big') {
      // Don't select a big team channel
      return false
    }
    if (meta.status === RPCChatTypes.ConversationStatus.ignored) {
      return false
    }
    if (avoidTeam && meta.teamname === avoidTeam) {
      // We just left this team, don't select a convo from it
      return false
    }
    if (
      avoidConversationID !== Constants.noConversationIDKey &&
      meta.conversationIDKey === avoidConversationID
    ) {
      return false
    }
    return true
  }

  // If we got here we're auto selecting the newest convo
  const meta = state.chat2.metaMap.maxBy(meta => (isEligibleConvo(meta) ? meta.timestamp : 0))

  if (meta) {
    return Chat2Gen.createSelectConversation({
      conversationIDKey: meta.conversationIDKey,
      reason: 'findNewestConversation',
    })
  } else if (avoidTeam) {
    // No conversations besides in the team we're trying to avoid. Select
    // nothing
    logger.info(
      `no eligible conversations left in inbox (no conversations outside of team we're avoiding); selecting nothing`
    )
    return Chat2Gen.createSelectConversation({
      conversationIDKey: Constants.noConversationIDKey,
      reason: 'clearSelected',
    })
  } else {
    return undefined
  }
}

const startupUserReacjisLoad = (_: TypedState, action: ConfigGen.BootstrapStatusLoadedPayload) =>
  Chat2Gen.createUpdateUserReacjis({userReacjis: action.payload.userReacjis})

// onUpdateUserReacjis hooks `userReacjis`, frequently used reactions
// recorded by the service, into the emoji-mart library. Handler spec is
// documented at
// https://github.com/missive/emoji-mart/tree/7c2e2a840bdd48c3c9935dac4208115cbcf6006d#storage
const onUpdateUserReacjis = (state: TypedState) => {
  if (isMobile) {
    return
  }
  const userReacjis = state.chat2.userReacjis
  // emoji-mart expects a frequency map so we convert the sorted list from the
  // service into a frequency map that will appease the lib.
  let i = 0
  let reacjis = {}
  userReacjis.topReacjis.forEach(el => {
    i++
    reacjis[el] = userReacjis.topReacjis.length - i
  })
  store.setHandlers({
    getter: key => {
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

const openFolder = (state: TypedState, action: Chat2Gen.OpenFolderPayload) => {
  const meta = Constants.getMeta(state, action.payload.conversationIDKey)
  const path = FsTypes.stringToPath(
    meta.teamType !== 'adhoc'
      ? teamFolder(meta.teamname)
      : privateFolderWithUsers(meta.participants.toArray())
  )
  return FsConstants.makeActionForOpenPathInFilesTab(path)
}

const clearSearchResults = (_: TypedState, action: SearchGen.UserInputItemsUpdatedPayload) =>
  action.payload.searchKey === 'chatSearch' && SearchGen.createClearSearchResults({searchKey: 'chatSearch'})

function* downloadAttachment(fileName: string, message: Types.Message) {
  try {
    const conversationIDKey = message.conversationIDKey
    let lastRatioSent = -1 // force the first update to show no matter what
    const onDownloadProgress = ({bytesComplete, bytesTotal}) => {
      const ratio = bytesComplete / bytesTotal
      // Don't spam ourselves with updates
      if (ratio - lastRatioSent > 0.05) {
        lastRatioSent = ratio
        return Saga.put(
          Chat2Gen.createAttachmentLoading({conversationIDKey, isPreview: false, message, ratio})
        )
      }
      return undefined
    }

    const rpcRes: RPCChatTypes.DownloadFileAttachmentLocalRes = yield RPCChatTypes.localDownloadFileAttachmentLocalRpcSaga(
      {
        incomingCallMap: {
          'chat.1.chatUi.chatAttachmentDownloadDone': () => {},
          'chat.1.chatUi.chatAttachmentDownloadProgress': onDownloadProgress,
          'chat.1.chatUi.chatAttachmentDownloadStart': () => {},
        },
        params: {
          conversationID: Types.keyToConversationID(conversationIDKey),
          filename: fileName,
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          messageID: message.id,
          preview: false,
        },
      }
    )
    yield Saga.put(Chat2Gen.createAttachmentDownloaded({message, path: fileName}))
    return rpcRes.filename
  } catch (e) {
    logger.error(`downloadAttachment error: ${e.message}`)
    yield Saga.put(
      Chat2Gen.createAttachmentDownloadedError({error: e.message || 'Error downloading attachment', message})
    )
  }
  return fileName
}

// Download an attachment to your device
function* attachmentDownload(
  _: TypedState,
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

  // Download it
  const destPath = yield* Saga.callPromise(downloadFilePath, message.fileName)
  yield Saga.callUntyped(downloadAttachment, destPath, message)
}

function* attachmentFullscreenNext(state: TypedState, action: Chat2Gen.AttachmentFullscreenNextPayload) {
  const {conversationIDKey, messageID, backInTime} = action.payload
  const blankMessage = Constants.makeMessageAttachment({})
  if (conversationIDKey === blankMessage.conversationIDKey) {
    return
  }
  const currentSelection = state.chat2.attachmentFullscreenSelection
  const currentFullscreen = currentSelection ? currentSelection.message : blankMessage
  yield Saga.put(Chat2Gen.createAttachmentFullscreenSelection({autoPlay: false, message: blankMessage}))
  const nextAttachmentRes: Saga.RPCPromiseType<
    typeof RPCChatTypes.localGetNextAttachmentMessageLocalRpcPromise
  > = yield RPCChatTypes.localGetNextAttachmentMessageLocalRpcPromise({
    assetTypes: [RPCChatTypes.AssetMetadataType.image, RPCChatTypes.AssetMetadataType.video],
    backInTime,
    convID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    messageID,
  })

  let nextMsg = currentFullscreen
  if (nextAttachmentRes.message) {
    const uiMsg = Constants.uiMessageToMessage(state, conversationIDKey, nextAttachmentRes.message)
    if (uiMsg) {
      nextMsg = uiMsg
    }
  }
  yield Saga.put(Chat2Gen.createAttachmentFullscreenSelection({autoPlay: false, message: nextMsg}))
}

const attachmentPreviewSelect = (_: TypedState, action: Chat2Gen.AttachmentPreviewSelectPayload) => {
  const message = action.payload.message
  return [
    Chat2Gen.createAttachmentFullscreenSelection({autoPlay: true, message}),
    RouteTreeGen.createNavigateAppend({
      path: [
        {
          props: {},
          selected: 'chatAttachmentFullscreen',
        },
      ],
    }),
  ]
}

// Handle an image pasted into a conversation
const attachmentPasted = async (_: TypedState, action: Chat2Gen.AttachmentPastedPayload) => {
  const {conversationIDKey, data} = action.payload
  const outboxID = Constants.generateOutboxID()
  const path = await RPCChatTypes.localMakeUploadTempFileRpcPromise({data, filename: 'paste.png', outboxID})

  const pathAndOutboxIDs = [{outboxID, path}]
  return RouteTreeGen.createNavigateAppend({
    path: [{props: {conversationIDKey, pathAndOutboxIDs}, selected: 'chatAttachmentGetTitles'}],
  })
}

// Upload an attachment
function* attachmentsUpload(
  state: TypedState,
  action: Chat2Gen.AttachmentsUploadPayload,
  logger: Saga.SagaLogger
) {
  const {conversationIDKey, paths, titles} = action.payload
  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (!meta) {
    logger.warn('Missing meta for attachment upload', conversationIDKey)
    return
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
          tlfName: meta.tlfname,
          visibility: RPCTypes.TLFVisibility.private,
        },
        clientPrev,
      })
    )
  )
}

// Tell service we're typing
const sendTyping = (_: TypedState, action: Chat2Gen.SendTypingPayload) => {
  const {conversationIDKey, typing} = action.payload
  return RPCChatTypes.localUpdateTypingRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    typing,
  })
}

// Implicit teams w/ reset users we can invite them back in or chat w/o them
const resetChatWithoutThem = (state: TypedState, action: Chat2Gen.ResetChatWithoutThemPayload) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  // remove all bad people
  const goodParticipants = meta.participants.toSet().subtract(meta.resetParticipants)
  return Chat2Gen.createPreviewConversation({
    participants: goodParticipants.toArray(),
    reason: 'resetChatWithoutThem',
  })
}

// let them back in after they reset
const resetLetThemIn = (_: TypedState, action: Chat2Gen.ResetLetThemInPayload) =>
  RPCChatTypes.localAddTeamMemberAfterResetRpcPromise({
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
    username: action.payload.username,
  })

const markThreadAsRead = (
  state: TypedState,
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
  const conversationIDKey = Constants.getSelectedConversation(state)

  if (!conversationIDKey) {
    logger.info('bail on no selected conversation')
    return
  }

  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (!meta) {
    logger.info('bail on not in meta list. preview?')
    return
  }

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
  if (!state.chat2.containsLatestMessageMap.get(conversationIDKey, true)) {
    logger.info('bail on not containing latest message')
    return
  }

  let message: Types.Message | undefined
  const mmap = state.chat2.messageMap.get(conversationIDKey)
  if (mmap) {
    const ordinals = Constants.getMessageOrdinals(state, conversationIDKey)
    const ordinal = ordinals.findLast(o => {
      const m = mmap.get(o)
      return m ? !!m.id : false
    })
    message = ordinal ? mmap.get(ordinal) : undefined
  }

  const readMsgID = message ? (message.id > meta.maxMsgID ? message.id : meta.maxMsgID) : meta.maxMsgID
  logger.info(`marking read messages ${conversationIDKey} ${readMsgID}`)
  return RPCChatTypes.localMarkAsReadLocalRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    msgID: readMsgID,
  }).then(() => {})
}

// Delete a message and any older
const deleteMessageHistory = (
  state: TypedState,
  action: Chat2Gen.MessageDeleteHistoryPayload,
  logger: Saga.SagaLogger
) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)

  if (!meta.tlfname) {
    logger.warn('Deleting message history for non-existent TLF:')
    return
  }

  return RPCChatTypes.localPostDeleteHistoryByAgeRpcPromise({
    age: 0,
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: meta.tlfname,
    tlfPublic: false,
  }).then(() => {})
}

// Get the rights a user has on certain actions in a team
const loadCanUserPerform = (state: TypedState, action: Chat2Gen.SelectConversationPayload) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  const teamname = meta.teamname
  if (!teamname) {
    return
  }
  if (!TeamsConstants.hasCanPerform(state, teamname)) {
    return TeamsGen.createGetTeamOperations({teamname})
  }
  return undefined
}

const loadTeamForConv = (state: TypedState, action: Chat2Gen.SelectConversationPayload) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  const teamname = meta.teamname
  if (!teamname) {
    return
  }
  return TeamsGen.createGetMembers({teamname})
}

// Get the full channel names/descs for a team if we don't already have them.
function* loadChannelInfos(state: TypedState, action: Chat2Gen.SelectConversationPayload) {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  const teamname = meta.teamname
  if (!teamname) {
    return
  }
  if (!TeamsConstants.hasChannelInfos(state, teamname)) {
    yield Saga.callUntyped(Saga.delay, 4000)
    yield Saga.put(TeamsGen.createGetChannels({teamname}))
  }
}

// Helpers to nav you to the right place
const navigateToInbox = (
  _: TypedState,
  action:
    | Chat2Gen.NavigateToInboxPayload
    | Chat2Gen.LeaveConversationPayload
    | TeamsGen.LeaveTeamPayload
    | TeamsGen.LeftTeamPayload
) => {
  if (action.type === Chat2Gen.leaveConversation && action.payload.dontNavigateToInbox) {
    return
  }
  return RouteTreeGen.createNavUpToScreen({routeName: Tabs.chatTab})
}

// Unchecked version of Chat2Gen.createNavigateToThread() --
// Saga.put() this if you want to select the pending conversation
// (which doesn't count as valid).
//
const navigateToThreadRoute = (conversationIDKey: Types.ConversationIDKey) => {
  let replace = false

  const visible = Router2Constants.getVisibleScreen()

  if (!isMobile && visible && visible.routeName === 'chatRoot') {
    // Don't append; we don't want to increase the size of the stack on desktop
    return
  }

  // looking at the pending screen?
  if (
    visible.routeName &&
    visible.routeName === 'chatConversation' &&
    visible &&
    visible.params &&
    (visible.params.conversationIDKey === Constants.pendingWaitingConversationIDKey ||
      visible.params.conversationIDKey === Constants.pendingErrorConversationIDKey)
  ) {
    replace = true
  }

  return RouteTreeGen.createNavigateAppend({
    path: [{props: {conversationIDKey}, selected: isMobile ? 'chatConversation' : 'chatRoot'}],
    replace,
  })
}

const navigateToThread = (state: TypedState) => {
  if (!Constants.isValidConversationIDKey(state.chat2.selectedConversation)) {
    console.log('Skip nav to thread on invalid conversation')
    return
  }
  return navigateToThreadRoute(state.chat2.selectedConversation)
}

const refreshPreviousSelected = (state: TypedState) => {
  if (state.chat2.previousSelectedConversation !== Constants.noConversationIDKey) {
    return Chat2Gen.createMetaRequestTrusted({
      conversationIDKeys: [state.chat2.previousSelectedConversation],
      force: true,
    })
  }
  return undefined
}

const deselectConversation = (state: TypedState, action: Chat2Gen.DeselectConversationPayload) => {
  if (state.chat2.selectedConversation === action.payload.ifConversationIDKey) {
    return Chat2Gen.createSelectConversation({
      conversationIDKey: Constants.noConversationIDKey,
      reason: 'clearSelected',
    })
  }
  return undefined
}

const mobileNavigateOnSelect = (state: TypedState, action: Chat2Gen.SelectConversationPayload) => {
  if (Constants.isValidConversationIDKey(action.payload.conversationIDKey)) {
    if (action.payload.reason === 'focused') {
      return // never nav if this is from a nav
    }
    return navigateToThreadRoute(state.chat2.selectedConversation)
  } else if (
    action.payload.conversationIDKey === Constants.pendingWaitingConversationIDKey ||
    action.payload.conversationIDKey === Constants.pendingErrorConversationIDKey
  ) {
    return navigateToThreadRoute(action.payload.conversationIDKey)
  }
  return undefined
}

const desktopNavigateOnSelect = (state: TypedState, action: Chat2Gen.SelectConversationPayload) => {
  if (action.payload.reason === 'findNewestConversation') return
  return navigateToThreadRoute(state.chat2.selectedConversation)
}

// Native share sheet for attachments
function* mobileMessageAttachmentShare(
  _: TypedState,
  action: Chat2Gen.MessageAttachmentNativeSharePayload,
  logger: Saga.SagaLogger
) {
  const {message} = action.payload
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  const fileName = yield* downloadAttachment('', message)
  try {
    yield* Saga.callPromise(showShareActionSheetFromFile, fileName, message.fileType)
  } catch (e) {
    logger.error('Failed to share attachment: ' + JSON.stringify(e))
  }
}

// Native save to camera roll
function* mobileMessageAttachmentSave(
  _: TypedState,
  action: Chat2Gen.MessageAttachmentNativeSavePayload,
  logger: Saga.SagaLogger
) {
  const {message} = action.payload
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  const fileName = yield* downloadAttachment('', message)
  if (fileName === '') {
    // failed to download
    logger.error('Downloading attachment failed')
    throw new Error('Downloading attachment failed')
  }
  yield Saga.put(
    Chat2Gen.createAttachmentMobileSave({
      conversationIDKey: message.conversationIDKey,
      ordinal: message.ordinal,
    })
  )
  try {
    logger.info('Trying to save chat attachment to camera roll')
    yield* Saga.callPromise(saveAttachmentToCameraRoll, fileName, message.fileType)
  } catch (err) {
    logger.error('Failed to save attachment: ' + err)
    throw new Error('Failed to save attachment: ' + err)
  }
  yield Saga.put(
    Chat2Gen.createAttachmentMobileSaved({
      conversationIDKey: message.conversationIDKey,
      ordinal: message.ordinal,
    })
  )
}

const joinConversation = (_: TypedState, action: Chat2Gen.JoinConversationPayload) =>
  RPCChatTypes.localJoinConversationByIDLocalRpcPromise(
    {convID: Types.keyToConversationID(action.payload.conversationIDKey)},
    Constants.waitingKeyJoinConversation
  ).then(() => {})

const leaveConversation = (_: TypedState, action: Chat2Gen.LeaveConversationPayload) =>
  RPCChatTypes.localLeaveConversationLocalRpcPromise({
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
  }).then(() => {})

const muteConversation = (_: TypedState, action: Chat2Gen.MuteConversationPayload) =>
  RPCChatTypes.localSetConversationStatusLocalRpcPromise({
    conversationID: Types.keyToConversationID(action.payload.conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    status: action.payload.muted
      ? RPCChatTypes.ConversationStatus.muted
      : RPCChatTypes.ConversationStatus.unfiled,
  }).then(() => {})

const updateNotificationSettings = (_: TypedState, action: Chat2Gen.UpdateNotificationSettingsPayload) =>
  RPCChatTypes.localSetAppNotificationSettingsLocalRpcPromise({
    channelWide: action.payload.notificationsGlobalIgnoreMentions,
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
    settings: [
      {
        deviceType: RPCTypes.DeviceType.desktop,
        enabled: action.payload.notificationsDesktop === 'onWhenAtMentioned',
        kind: RPCChatTypes.NotificationKind.atmention,
      },
      {
        deviceType: RPCTypes.DeviceType.desktop,
        enabled: action.payload.notificationsDesktop === 'onAnyActivity',
        kind: RPCChatTypes.NotificationKind.generic,
      },
      {
        deviceType: RPCTypes.DeviceType.mobile,
        enabled: action.payload.notificationsMobile === 'onWhenAtMentioned',
        kind: RPCChatTypes.NotificationKind.atmention,
      },
      {
        deviceType: RPCTypes.DeviceType.mobile,
        enabled: action.payload.notificationsMobile === 'onAnyActivity',
        kind: RPCChatTypes.NotificationKind.generic,
      },
    ],
  }).then(() => {})

function* blockConversation(_: TypedState, action: Chat2Gen.BlockConversationPayload) {
  yield Saga.put(Chat2Gen.createNavigateToInbox({findNewConversation: true}))
  yield Saga.callUntyped(RPCChatTypes.localSetConversationStatusLocalRpcPromise, {
    conversationID: Types.keyToConversationID(action.payload.conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    status: action.payload.reportUser
      ? RPCChatTypes.ConversationStatus.reported
      : RPCChatTypes.ConversationStatus.blocked,
  })
}

function* hideConversation(_: TypedState, action: Chat2Gen.HideConversationPayload) {
  // Nav to inbox but don't use findNewConversation since changeSelectedConversation
  // does that with better information. It knows the conversation is hidden even before
  // that state bounces back.
  yield Saga.put(Chat2Gen.createNavigateToInbox({findNewConversation: false}))
  try {
    yield RPCChatTypes.localSetConversationStatusLocalRpcPromise(
      {
        conversationID: Types.keyToConversationID(action.payload.conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        status: RPCChatTypes.ConversationStatus.ignored,
      },
      Constants.waitingKeyConvStatusChange(action.payload.conversationIDKey)
    )
  } catch (err) {
    logger.error('Failed to hide conversation: ' + err)
  }
}

function* unhideConversation(_: TypedState, action: Chat2Gen.HideConversationPayload) {
  try {
    yield RPCChatTypes.localSetConversationStatusLocalRpcPromise(
      {
        conversationID: Types.keyToConversationID(action.payload.conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        status: RPCChatTypes.ConversationStatus.unfiled,
      },
      Constants.waitingKeyConvStatusChange(action.payload.conversationIDKey)
    )
  } catch (err) {
    logger.error('Failed to unhide conversation: ' + err)
  }
}

const setConvRetentionPolicy = (
  _: TypedState,
  action: Chat2Gen.SetConvRetentionPolicyPayload,
  logger: Saga.SagaLogger
) => {
  const {conversationIDKey, policy} = action.payload
  const convID = Types.keyToConversationID(conversationIDKey)
  let servicePolicy: RPCChatTypes.RetentionPolicy | null
  try {
    servicePolicy = TeamsConstants.retentionPolicyToServiceRetentionPolicy(policy)
    if (servicePolicy) {
      return RPCChatTypes.localSetConvRetentionLocalRpcPromise({
        convID,
        policy: servicePolicy,
      })
    }
  } catch (err) {
    // should never happen
    logger.error(`Unable to parse retention policy: ${err.message}`)
    throw err
  }
  return undefined
}

const toggleMessageCollapse = (_: TypedState, action: Chat2Gen.ToggleMessageCollapsePayload) => {
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
  state: TypedState,
  action: Chat2Gen.CreateConversationPayload,
  logger: Saga.SagaLogger
) {
  const username = state.config.username
  if (!username) {
    logger.error('Making a convo while logged out?')
    return
  }

  try {
    const result: Saga.RPCPromiseType<
      typeof RPCChatTypes.localNewConversationLocalRpcPromise
    > = yield RPCChatTypes.localNewConversationLocalRpcPromise(
      {
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.ConversationMembersType.impteamnative,
        tlfName: I.Set([username])
          .concat(action.payload.participants)
          .join(','),
        tlfVisibility: RPCTypes.TLFVisibility.private,
        topicType: RPCChatTypes.TopicType.chat,
      },
      Constants.waitingKeyCreating
    )

    const conversationIDKey = Types.conversationIDToKey(result.conv.info.id)
    if (!conversationIDKey) {
      logger.warn("Couldn't make a new conversation?")
    } else {
      const meta = Constants.inboxUIItemToConversationMeta(result.uiConv, true)
      if (meta) {
        yield Saga.put(Chat2Gen.createMetasReceived({metas: [meta]}))
      }
      yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'justCreated'}))
    }
  } catch (e) {
    logger.error(`Failed to create new conversation: ${e.message}`)
    yield Saga.put(Chat2Gen.createConversationErrored({message: e.message}))
    yield Saga.put(
      Chat2Gen.createSelectConversation({
        conversationIDKey: Constants.pendingErrorConversationIDKey,
        reason: 'justCreated',
      })
    )
  }
}

const messageReplyPrivately = (
  state: TypedState,
  action: Chat2Gen.MessageReplyPrivatelyPayload,
  logger: Saga.SagaLogger
) => {
  const {sourceConversationIDKey, ordinal} = action.payload
  const message = Constants.getMessage(state, sourceConversationIDKey, ordinal)
  if (!message) {
    logger.warn("Can't find message to reply to", ordinal)
    return
  }

  const username = state.config.username
  if (!username) {
    throw new Error('Making a convo while logged out?')
  }
  return RPCChatTypes.localNewConversationLocalRpcPromise(
    {
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      membersType: RPCChatTypes.ConversationMembersType.impteamnative,
      tlfName: I.Set([username, message.author]).join(','),
      tlfVisibility: RPCTypes.TLFVisibility.private,
      topicType: RPCChatTypes.TopicType.chat,
    },
    Constants.waitingKeyCreating
  ).then(result => {
    const conversationIDKey = Types.conversationIDToKey(result.conv.info.id)
    if (!conversationIDKey) {
      logger.warn("Couldn't make a new conversation?")
      return
    }

    return [
      Chat2Gen.createSelectConversation({conversationIDKey, reason: 'createdMessagePrivately'}),
      Chat2Gen.createMessageSetQuoting({
        ordinal: action.payload.ordinal,
        sourceConversationIDKey: action.payload.sourceConversationIDKey,
        targetConversationIDKey: conversationIDKey,
      }),
    ]
  })
}

// don't bug the users with black bars for network errors. chat isn't going to work in general
const ignoreErrors = [
  RPCTypes.StatusCode.scgenericapierror,
  RPCTypes.StatusCode.scapinetworkerror,
  RPCTypes.StatusCode.sctimeout,
]
function* setConvExplodingMode(
  state: TypedState,
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
          `Failed to set exploding mode for conversation ${conversationIDKey} to ${seconds}. Service responded with: ${
            e.message
          }`
        )
      } else {
        logger.error(
          `Failed to unset exploding mode for conversation ${conversationIDKey}. Service responded with: ${
            e.message
          }`
        )
      }
      if (ignoreErrors.includes(e.code)) {
        return
      }
      throw e
    }
  }
}

function* handleSeeingWallets(
  _: TypedState,
  __: Chat2Gen.HandleSeeingWalletsPayload,
  logger: Saga.SagaLogger
) {
  const gregorState: Saga.RPCPromiseType<
    typeof RPCTypes.gregorGetStateRpcPromise
  > = yield RPCTypes.gregorGetStateRpcPromise()
  const seenWallets =
    gregorState.items &&
    gregorState.items.some(i => i.item && i.item.category === Constants.seenWalletsGregorKey)
  if (seenWallets) {
    logger.info('handleSeeingWallets: gregor state already think wallets is old; skipping update.')
    return
  }
  try {
    logger.info('handleSeeingWallets: setting seenWalletsGregorKey')
    yield RPCTypes.gregorUpdateCategoryRpcPromise({
      body: 'true',
      category: Constants.seenWalletsGregorKey,
      dtime: {offset: 0, time: 0},
    })
    logger.info('handleSeeingWallets: successfully set seenWalletsGregorKey')
  } catch (err) {
    logger.error(
      `handleSeeingWallets: failed to set seenWalletsGregorKey. Local state might not persist on restart. Error: ${
        err.message
      }`
    )
  }
}

function* loadStaticConfig(
  state: TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  logger: Saga.SagaLogger
) {
  if (state.chat2.staticConfig) {
    return
  }
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({
      increment: true,
      name: 'chat.loadStatic',
      version: action.payload.version,
    })
  )
  const loadAction = yield RPCChatTypes.localGetStaticConfigRpcPromise().then(res => {
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
    return Chat2Gen.createStaticConfigLoaded({
      staticConfig: Constants.makeStaticConfig({
        builtinCommands: (res.builtinCommands || []).reduce<Types._StaticConfig['builtinCommands']>(
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
        deletableByDeleteHistory: I.Set(deletableByDeleteHistory),
      }),
    })
  })

  if (loadAction) {
    yield Saga.put(loadAction)
  }
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({
      increment: false,
      name: 'chat.loadStatic',
      version: action.payload.version,
    })
  )
}

const toggleMessageReaction = (
  state: TypedState,
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
  if ((message.type === 'text' || message.type === 'attachment') && message.exploded) {
    logger.warn(`toggleMessageReaction: message is exploded`)
    return
  }
  const messageID = message.id
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)
  const meta = Constants.getMeta(state, conversationIDKey)
  const outboxID = Constants.generateOutboxID()
  logger.info(`toggleMessageReaction: posting reaction`)
  return RPCChatTypes.localPostReactionNonblockRpcPromise({
    body: emoji,
    clientPrev,
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    outboxID,
    supersedes: messageID,
    tlfName: meta.tlfname,
    tlfPublic: false,
  })
    .then(() =>
      Chat2Gen.createToggleLocalReaction({
        conversationIDKey,
        emoji,
        targetOrdinal: ordinal,
        username: state.config.username || '',
      })
    )
    .catch(() =>
      Chat2Gen.createToggleLocalReaction({
        conversationIDKey,
        emoji,
        targetOrdinal: ordinal,
        username: state.config.username || '',
      })
    )
}

const receivedBadgeState = (_: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  Chat2Gen.createBadgesUpdated({conversations: action.payload.badgeState.conversations || []})

const setMinWriterRole = (
  _: TypedState,
  action: Chat2Gen.SetMinWriterRolePayload,
  logger: Saga.SagaLogger
) => {
  const {conversationIDKey, role} = action.payload
  logger.info(`Setting minWriterRole to ${role} for convID ${conversationIDKey}`)
  return RPCChatTypes.localSetConvMinWriterRoleLocalRpcPromise({
    convID: Types.keyToConversationID(conversationIDKey),
    role: RPCTypes.TeamRole[role],
  })
}

const unfurlRemove = (state: TypedState, action: Chat2Gen.UnfurlRemovePayload, logger: Saga.SagaLogger) => {
  const {conversationIDKey, messageID} = action.payload
  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (!meta) {
    logger.debug('unfurl remove no meta found, aborting!')
    return
  }
  return RPCChatTypes.localPostDeleteNonblockRpcPromise(
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
  ).then(() => {})
}

const unfurlDismissPrompt = (_: TypedState, action: Chat2Gen.UnfurlResolvePromptPayload) => {
  const {conversationIDKey, messageID, domain} = action.payload
  return Chat2Gen.createUnfurlTogglePrompt({
    conversationIDKey,
    domain,
    messageID,
    show: false,
  })
}

const unfurlResolvePrompt = (_: TypedState, action: Chat2Gen.UnfurlResolvePromptPayload) => {
  const {conversationIDKey, messageID, result} = action.payload
  return RPCChatTypes.localResolveUnfurlPromptRpcPromise({
    convID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    msgID: Types.messageIDToNumber(messageID),
    result,
  })
}

const toggleInfoPanel = (state: TypedState) => {
  const visibleScreen = Router2Constants.getVisibleScreen()
  if (visibleScreen && visibleScreen.routeName === 'chatInfoPanel') {
    return [
      Chat2Gen.createClearAttachmentView({conversationIDKey: state.chat2.selectedConversation}),
      RouteTreeGen.createNavigateUp(),
    ]
  } else {
    return RouteTreeGen.createNavigateAppend({
      path: [{props: {conversationIDKey: state.chat2.selectedConversation}, selected: 'chatInfoPanel'}],
    })
  }
}

const unsentTextChanged = (state: TypedState, action: Chat2Gen.UnsentTextChangedPayload) => {
  const {conversationIDKey, text} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  return RPCChatTypes.localUpdateUnsentTextRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    text: text.stringValue(),
    tlfName: meta.tlfname,
  })
}

const onGiphyResults = (_: TypedState, action: EngineGen.Chat1ChatUiChatGiphySearchResultsPayload) => {
  const {convID, results} = action.payload.params
  return Chat2Gen.createGiphyGotSearchResult({
    conversationIDKey: Types.stringToConversationIDKey(convID),
    results,
  })
}

const onGiphyToggleWindow = (
  _: TypedState,
  action: EngineGen.Chat1ChatUiChatGiphyToggleResultWindowPayload
) => {
  const {convID, show, clearInput} = action.payload.params
  return Chat2Gen.createGiphyToggleWindow({
    clearInput,
    conversationIDKey: Types.stringToConversationIDKey(convID),
    show,
  })
}

const giphySend = (_: TypedState, action: Chat2Gen.GiphySendPayload) => {
  const {conversationIDKey, url} = action.payload
  return Chat2Gen.createMessageSend({conversationIDKey, text: url})
}

const onChatCoinFlipStatus = (_: TypedState, action: EngineGen.Chat1ChatUiChatCoinFlipStatusPayload) => {
  const {statuses} = action.payload.params
  return Chat2Gen.createUpdateCoinFlipStatus({statuses: statuses || []})
}

const onChatCommandMarkdown = (_: TypedState, action: EngineGen.Chat1ChatUiChatCommandMarkdownPayload) => {
  const {convID, md} = action.payload.params
  return Chat2Gen.createSetCommandMarkdown({
    conversationIDKey: Types.stringToConversationIDKey(convID),
    md: md || null,
  })
}

const onChatCommandStatus = (_: TypedState, action: EngineGen.Chat1ChatUiChatCommandStatusPayload) => {
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

const onChatMaybeMentionUpdate = (
  _: TypedState,
  action: EngineGen.Chat1ChatUiChatMaybeMentionUpdatePayload
) => {
  const {teamName, channel, info} = action.payload.params
  return Chat2Gen.createSetMaybeMentionInfo({
    info,
    name: Constants.getTeamMentionName(teamName, channel),
  })
}

const onChatWatchPosition = async (
  _: TypedState,
  action: EngineGen.Chat1ChatUiChatWatchPositionPayload,
  logger: Saga.SagaLogger
) => {
  const response = action.payload.response
  if (isMobile) {
    try {
      await requestLocationPermission()
    } catch (e) {
      logger.info('failed to get location perms: ' + e)
      return []
    }
    const watchID = navigator.geolocation.watchPosition(
      pos =>
        RPCChatTypes.localLocationUpdateRpcPromise({
          coord: {accuracy: pos.coords.accuracy, lat: pos.coords.latitude, lon: pos.coords.longitude},
        }),
      err => {
        logger.warn(err.message)
        if (err.code && err.code === 1) {
          RPCChatTypes.localLocationDeniedRpcPromise({convID: action.payload.params.convID})
        }
      },
      {enableHighAccuracy: isIOS, maximumAge: 0, timeout: 30000}
    )
    response.result(watchID)
  } else {
    setTimeout(() => {
      RPCChatTypes.localLocationUpdateRpcPromise({
        coord: {accuracy: 65, lat: 40.80424, lon: -73.962962},
      })
    }, 1000)
    setTimeout(() => {
      RPCChatTypes.localLocationUpdateRpcPromise({
        coord: {accuracy: 65, lat: 40.756325, lon: -73.992533},
      })
    }, 6000)
    setTimeout(() => {
      RPCChatTypes.localLocationUpdateRpcPromise({
        coord: {accuracy: 65, lat: 40.704454, lon: -74.010893},
      })
    }, 10000)
    response.result(10)
  }
  return []
}

const onChatClearWatch = (_: TypedState, action: EngineGen.Chat1ChatUiChatClearWatchPayload) => {
  navigator.geolocation.clearWatch(action.payload.params.id)
}

const resolveMaybeMention = (_: TypedState, action: Chat2Gen.ResolveMaybeMentionPayload) =>
  RPCChatTypes.localResolveMaybeMentionRpcPromise({
    mention: {channel: action.payload.channel, name: action.payload.name},
  })

const openChatFromWidget = (
  _: TypedState,
  {payload: {conversationIDKey}}: Chat2Gen.OpenChatFromWidgetPayload
) => [
  ConfigGen.createShowMain(),
  RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}),
  ...(conversationIDKey
    ? [Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxSmall'})]
    : []),
]

const gregorPushState = (state: TypedState, action: GregorGen.PushStatePayload, logger: Saga.SagaLogger) => {
  const actions: Array<TypedActions> = []
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

  const seenWallets = items.some(i => i.item.category === Constants.seenWalletsGregorKey)
  if (seenWallets && state.chat2.isWalletsNew) {
    logger.info('chat.gregorPushState: got seenWallets and we thought they were new, updating store.')
    actions.push(Chat2Gen.createSetWalletsOld())
  }

  const isSearchNew = !items.some(i => i.item.category === Constants.inboxSearchNewKey)
  actions.push(Chat2Gen.createSetInboxShowIsNew({isNew: isSearchNew}))

  return actions
}

const prepareFulfillRequestForm = (
  state: TypedState,
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

const addUsersToChannel = async (
  _: TypedState,
  action: Chat2Gen.AddUsersToChannelPayload,
  logger: Saga.SagaLogger
) => {
  const {conversationIDKey, usernames} = action.payload
  try {
    await RPCChatTypes.localBulkAddToConvRpcPromise(
      {convID: Types.keyToConversationID(conversationIDKey), usernames},
      Constants.waitingKeyAddUsersToChannel
    ).then(() => [
      Chat2Gen.createSelectConversation({conversationIDKey, reason: 'addedToChannel'}),
      RouteTreeGen.createClearModals(),
      Chat2Gen.createNavigateToThread(),
    ])
  } catch (err) {
    logger.error(`addUsersToChannel: ${err.message}`) // surfaced in UI via waiting key
  }
}

const onMarkInboxSearchOld = (state: TypedState) =>
  state.chat2.inboxShowNew &&
  GregorGen.createUpdateCategory({body: 'true', category: Constants.inboxSearchNewKey})

const createConversationFromTeamBuilder = (
  state: TypedState,
  {payload: {namespace}}: TeamBuildingGen.FinishedTeamBuildingPayload
) => [
  Chat2Gen.createSelectConversation({
    conversationIDKey: Constants.pendingWaitingConversationIDKey,
    reason: 'justCreated',
  }),
  Chat2Gen.createCreateConversation({
    participants: state[namespace].teamBuilding.teamBuildingFinishedTeam.toArray().map(u => u.id),
  }),
]

export function* chatTeamBuildingSaga(): Saga.SagaGenerator<any, any> {
  yield* commonTeamBuildingSaga('chat2')
  yield* Saga.chainAction2(
    TeamBuildingGen.finishedTeamBuilding,
    filterForNs('chat2', createConversationFromTeamBuilder)
  )
}

function* chat2Saga(): Saga.SagaGenerator<any, any> {
  // Platform specific actions
  if (isMobile) {
    // Push us into the conversation
    yield* Saga.chainAction2(Chat2Gen.selectConversation, mobileNavigateOnSelect, 'mobileNavigateOnSelect')
    yield* Saga.chainGenerator<Chat2Gen.MessageAttachmentNativeSharePayload>(
      Chat2Gen.messageAttachmentNativeShare,
      mobileMessageAttachmentShare,
      'mobileMessageAttachmentShare'
    )
    yield* Saga.chainGenerator<Chat2Gen.MessageAttachmentNativeSavePayload>(
      Chat2Gen.messageAttachmentNativeSave,
      mobileMessageAttachmentSave,
      'mobileMessageAttachmentSave'
    )
  } else {
    yield* Saga.chainGenerator<Chat2Gen.DesktopNotificationPayload>(
      Chat2Gen.desktopNotification,
      desktopNotify
    )
    // Switch to the chat tab
    yield* Saga.chainAction2(Chat2Gen.selectConversation, desktopNavigateOnSelect)
  }

  // Sometimes change the selection
  yield* Saga.chainAction2(
    [
      Chat2Gen.metasReceived,
      Chat2Gen.leaveConversation,
      Chat2Gen.metaDelete,
      Chat2Gen.messageSend,
      Chat2Gen.attachmentsUpload,
      Chat2Gen.blockConversation,
      Chat2Gen.hideConversation,
      TeamsGen.leaveTeam,
    ],
    changeSelectedConversation,
    'changeSelectedConversation'
  )
  // Refresh the inbox
  yield* Saga.chainGenerator<
    | Chat2Gen.InboxRefreshPayload
    | EngineGen.Chat1NotifyChatChatInboxStalePayload
    | EngineGen.Chat1NotifyChatChatJoinedConversationPayload
    | EngineGen.Chat1NotifyChatChatLeftConversationPayload
  >(
    [
      Chat2Gen.inboxRefresh,
      EngineGen.chat1NotifyChatChatInboxStale,
      EngineGen.chat1NotifyChatChatJoinedConversation,
      EngineGen.chat1NotifyChatChatLeftConversation,
    ],
    inboxRefresh,
    'inboxRefresh'
  )
  // Load teams
  yield* Saga.chainAction2(Chat2Gen.metasReceived, requestTeamsUnboxing, 'requestTeamsUnboxing')
  // We've scrolled some new inbox rows into view, queue them up
  yield* Saga.chainAction2(Chat2Gen.metaNeedsUpdating, queueMetaToRequest, 'queueMetaToRequest')
  // We have some items in the queue to process
  yield* Saga.chainGenerator<Chat2Gen.MetaHandleQueuePayload>(
    Chat2Gen.metaHandleQueue,
    requestMeta,
    'requestMeta'
  )

  // Actually try and unbox conversations
  yield* Saga.chainGenerator<
    Chat2Gen.MetaRequestTrustedPayload | Chat2Gen.SelectConversationPayload | Chat2Gen.MetasReceivedPayload
  >(
    [Chat2Gen.metaRequestTrusted, Chat2Gen.selectConversation, Chat2Gen.metasReceived],
    unboxRows,
    'unboxRows'
  )

  // Load the selected thread
  yield* Saga.chainGenerator<
    | Chat2Gen.SelectConversationPayload
    | Chat2Gen.JumpToRecentPayload
    | Chat2Gen.LoadOlderMessagesDueToScrollPayload
    | Chat2Gen.LoadNewerMessagesDueToScrollPayload
    | Chat2Gen.LoadMessagesCenteredPayload
    | Chat2Gen.MarkConversationsStalePayload
    | Chat2Gen.MetasReceivedPayload
    | ConfigGen.ChangedFocusPayload
  >(
    [
      Chat2Gen.selectConversation,
      Chat2Gen.jumpToRecent,
      Chat2Gen.loadOlderMessagesDueToScroll,
      Chat2Gen.loadNewerMessagesDueToScroll,
      Chat2Gen.loadMessagesCentered,
      Chat2Gen.markConversationsStale,
      Chat2Gen.metasReceived,
      ConfigGen.changedFocus,
    ],
    loadMoreMessages,
    'loadMoreMessages'
  )

  // get the unread (orange) line
  yield* Saga.chainGenerator<Chat2Gen.SelectConversationPayload>(
    Chat2Gen.selectConversation,
    getUnreadline,
    'getUnreadline'
  )

  yield* Saga.chainAction2(Chat2Gen.messageRetry, messageRetry, 'messageRetry')
  yield* Saga.chainGenerator<Chat2Gen.MessageSendPayload>(Chat2Gen.messageSend, messageSend, 'messageSend')
  yield* Saga.chainGenerator<Chat2Gen.MessageEditPayload>(Chat2Gen.messageEdit, messageEdit, 'messageEdit')
  yield* Saga.chainAction2(Chat2Gen.messageEdit, clearMessageSetEditing, 'clearMessageSetEditing')
  yield* Saga.chainAction2(Chat2Gen.messageDelete, messageDelete, 'messageDelete')
  yield* Saga.chainAction2(Chat2Gen.messageDeleteHistory, deleteMessageHistory, 'deleteMessageHistory')
  yield* Saga.chainAction2(Chat2Gen.confirmScreenResponse, confirmScreenResponse, 'confirmScreenResponse')

  yield* Saga.chainAction2(Chat2Gen.selectConversation, loadCanUserPerform, 'loadCanUserPerform')
  yield* Saga.chainAction2(Chat2Gen.selectConversation, loadTeamForConv, 'loadTeamForConv')

  // Giphy
  yield* Saga.chainAction2(Chat2Gen.unsentTextChanged, unsentTextChanged, 'unsentTextChanged')
  yield* Saga.chainAction2(Chat2Gen.giphySend, giphySend, 'giphySend')

  yield* Saga.chainAction2(Chat2Gen.unfurlResolvePrompt, unfurlResolvePrompt, 'unfurlResolvePrompt')
  yield* Saga.chainAction2(Chat2Gen.unfurlResolvePrompt, unfurlDismissPrompt, 'unfurlDismissPrompt')
  yield* Saga.chainAction2(Chat2Gen.unfurlRemove, unfurlRemove, 'unfurlRemove')

  yield* Saga.chainAction2(Chat2Gen.previewConversation, previewConversationTeam)
  yield* Saga.chainAction2(Chat2Gen.previewConversation, previewConversationPersonMakesAConversation)
  yield* Saga.chainAction2(Chat2Gen.openFolder, openFolder)

  // On login lets load the untrusted inbox. This helps make some flows easier
  yield* Saga.chainAction2(ConfigGen.bootstrapStatusLoaded, startupInboxLoad, 'startupInboxLoad')

  yield* Saga.chainAction2(ConfigGen.bootstrapStatusLoaded, startupUserReacjisLoad, 'startupUserReacjisLoad')

  yield* Saga.chainAction2(Chat2Gen.updateUserReacjis, onUpdateUserReacjis, 'onUpdateUserReacjis')

  // Search handling
  yield* Saga.chainAction2(SearchGen.userInputItemsUpdated, clearSearchResults, 'clearSearchResults')
  yield* Saga.chainAction2(
    Chat2Gen.attachmentPreviewSelect,
    attachmentPreviewSelect,
    'attachmentPreviewSelect'
  )
  yield* Saga.chainGenerator<Chat2Gen.AttachmentDownloadPayload>(
    Chat2Gen.attachmentDownload,
    attachmentDownload,
    'attachmentDownload'
  )
  yield* Saga.chainGenerator<Chat2Gen.AttachmentsUploadPayload>(
    Chat2Gen.attachmentsUpload,
    attachmentsUpload,
    'attachmentsUpload'
  )
  yield* Saga.chainAction2(Chat2Gen.attachmentPasted, attachmentPasted, 'attachmentPasted')
  yield* Saga.chainGenerator<Chat2Gen.AttachmentFullscreenNextPayload>(
    Chat2Gen.attachmentFullscreenNext,
    attachmentFullscreenNext,
    'attachmentFullscreenNext'
  )

  yield* Saga.chainAction2(Chat2Gen.sendTyping, sendTyping, 'sendTyping')
  yield* Saga.chainAction2(Chat2Gen.resetChatWithoutThem, resetChatWithoutThem, 'resetChatWithoutThem')
  yield* Saga.chainAction2(Chat2Gen.resetLetThemIn, resetLetThemIn, 'resetLetThemIn')

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
    markThreadAsRead,
    'markThreadAsRead'
  )

  yield* Saga.chainAction2(
    [Chat2Gen.navigateToInbox, Chat2Gen.leaveConversation, TeamsGen.leaveTeam, TeamsGen.leftTeam],
    navigateToInbox,
    'navigateToInbox'
  )
  yield* Saga.chainAction2(Chat2Gen.navigateToThread, navigateToThread, 'navigateToThread')

  yield* Saga.chainAction2(Chat2Gen.joinConversation, joinConversation, 'joinConversation')
  yield* Saga.chainAction2(Chat2Gen.leaveConversation, leaveConversation, 'leaveConversation')

  yield* Saga.chainAction2(Chat2Gen.muteConversation, muteConversation, 'muteConversation')
  yield* Saga.chainAction2(
    Chat2Gen.updateNotificationSettings,
    updateNotificationSettings,
    'updateNotificationSettings'
  )
  yield* Saga.chainGenerator<Chat2Gen.BlockConversationPayload>(
    Chat2Gen.blockConversation,
    blockConversation,
    'blockConversation'
  )
  yield* Saga.chainGenerator<Chat2Gen.HideConversationPayload>(
    Chat2Gen.hideConversation,
    hideConversation,
    'hideConversation'
  )
  yield* Saga.chainGenerator<Chat2Gen.HideConversationPayload>(
    Chat2Gen.unhideConversation,
    unhideConversation,
    'unhideConversation'
  )

  yield* Saga.chainAction2(Chat2Gen.setConvRetentionPolicy, setConvRetentionPolicy, 'setConvRetentionPolicy')
  yield* Saga.chainAction2(Chat2Gen.toggleMessageCollapse, toggleMessageCollapse, 'toggleMessageCollapse')
  yield* Saga.chainGenerator<Chat2Gen.CreateConversationPayload>(
    Chat2Gen.createConversation,
    createConversation,
    'createConversation'
  )
  yield* Saga.chainAction2(Chat2Gen.messageReplyPrivately, messageReplyPrivately, 'messageReplyPrivately')
  yield* Saga.chainAction2(Chat2Gen.openChatFromWidget, openChatFromWidget)
  yield* Saga.chainAction2(Chat2Gen.toggleInfoPanel, toggleInfoPanel)

  // Exploding things
  yield* Saga.chainGenerator<Chat2Gen.SetConvExplodingModePayload>(
    Chat2Gen.setConvExplodingMode,
    setConvExplodingMode,
    'setConvExplodingMode'
  )
  yield* Saga.chainGenerator<Chat2Gen.HandleSeeingWalletsPayload>(
    Chat2Gen.handleSeeingWallets,
    handleSeeingWallets,
    'handleSeeingWallets'
  )
  yield* Saga.chainAction2(Chat2Gen.toggleMessageReaction, toggleMessageReaction, 'toggleMessageReaction')
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(
    ConfigGen.daemonHandshake,
    loadStaticConfig,
    'loadStaticConfig'
  )
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState, 'receivedBadgeState')
  yield* Saga.chainAction2(Chat2Gen.setMinWriterRole, setMinWriterRole, 'setMinWriterRole')
  yield* Saga.chainAction2(GregorGen.pushState, gregorPushState, 'gregorPushState')
  yield* Saga.chainAction2(
    Chat2Gen.prepareFulfillRequestForm,
    prepareFulfillRequestForm,
    'prepareFulfillRequestForm'
  )

  yield* Saga.chainGenerator<Chat2Gen.SelectConversationPayload>(
    Chat2Gen.selectConversation,
    loadChannelInfos,
    'loadChannelInfos'
  )

  yield* Saga.chainAction2(Chat2Gen.addUsersToChannel, addUsersToChannel, 'addUsersToChannel')

  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatPromptUnfurl,
    onChatPromptUnfurl,
    'onChatPromptUnfurl'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatAttachmentUploadProgress,
    onChatAttachmentUploadProgress,
    'onChatAttachmentUploadProgress'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatAttachmentUploadStart,
    onChatAttachmentUploadStart,
    'onChatAttachmentUploadStart'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatIdentifyUpdate,
    onChatIdentifyUpdate,
    'onChatIdentifyUpdate'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatInboxSyncStarted,
    onChatInboxSyncStarted,
    'onChatInboxSyncStarted'
  )
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatChatInboxSynced, onChatInboxSynced, 'onChatInboxSynced')
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatChatPaymentInfo, onChatPaymentInfo, 'onChatPaymentInfo')
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatChatRequestInfo, onChatRequestInfo, 'onChatRequestInfo')
  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatSetConvRetention,
    onChatSetConvRetention,
    'onChatSetConvRetention'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatSetConvSettings,
    onChatSetConvSettings,
    'onChatSetConvSettings'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatSetTeamRetention,
    onChatSetTeamRetention,
    'onChatSetTeamRetention'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatSubteamRename,
    onChatSubteamRename,
    'onChatSubteamRename'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1NotifyChatChatTLFFinalize,
    onChatChatTLFFinalizePayload,
    'onChatChatTLFFinalizePayload'
  )
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatChatThreadsStale, onChatThreadStale, 'onChatThreadStale')
  yield* Saga.chainAction2(EngineGen.chat1NotifyChatNewChatActivity, onNewChatActivity, 'onNewChatActivity')
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatGiphySearchResults, onGiphyResults, 'onGiphyResults')
  yield* Saga.chainAction2(
    EngineGen.chat1ChatUiChatGiphyToggleResultWindow,
    onGiphyToggleWindow,
    'onGiphyToggleWindow'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1ChatUiChatShowManageChannels,
    onChatShowManageChannels,
    'onChatShowManageChannels'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1ChatUiChatCoinFlipStatus,
    onChatCoinFlipStatus,
    'onChatCoinFlipStatus'
  )
  yield* Saga.chainAction2(
    EngineGen.chat1ChatUiChatCommandMarkdown,
    onChatCommandMarkdown,
    'onChatCommandMarkdown'
  )
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatCommandStatus, onChatCommandStatus, 'onChatCommandStatus')
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatMaybeMentionUpdate, onChatMaybeMentionUpdate)
  getEngine().registerCustomResponse('chat.1.chatUi.chatWatchPosition')
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatWatchPosition, onChatWatchPosition, 'onChatWatchPosition')
  yield* Saga.chainAction2(EngineGen.chat1ChatUiChatClearWatch, onChatClearWatch, 'onChatClearWatch')

  yield* Saga.chainAction2(Chat2Gen.replyJump, onReplyJump)

  yield* Saga.chainGenerator<Chat2Gen.InboxSearchPayload>(Chat2Gen.inboxSearch, inboxSearch, 'inboxSearch')
  yield* Saga.chainAction2(Chat2Gen.toggleInboxSearch, onToggleInboxSearch, 'onToggleInboxSearch')
  yield* Saga.chainAction2(Chat2Gen.toggleInboxSearch, onMarkInboxSearchOld, 'onMarkInboxSearchOld')
  yield* Saga.chainAction2(Chat2Gen.inboxSearchSelect, onInboxSearchSelect, 'onInboxSearchSelect')
  yield* Saga.chainGenerator<Chat2Gen.ThreadSearchPayload>(
    Chat2Gen.threadSearch,
    threadSearch,
    'threadSearch'
  )
  yield* Saga.chainAction2(Chat2Gen.toggleThreadSearch, onToggleThreadSearch, 'onToggleThreadSearch')
  yield* Saga.chainAction2(Chat2Gen.selectConversation, hideThreadSearch)
  yield* Saga.chainAction2(Chat2Gen.deselectConversation, deselectConversation)

  yield* Saga.chainAction2(Chat2Gen.resolveMaybeMention, resolveMaybeMention)

  yield* Saga.chainGenerator<Chat2Gen.LoadAttachmentViewPayload>(
    Chat2Gen.loadAttachmentView,
    loadAttachmentView
  )

  yield* Saga.chainAction2(Chat2Gen.selectConversation, refreshPreviousSelected)

  yield* Saga.chainAction2(EngineGen.connected, onConnect, 'onConnect')

  yield* chatTeamBuildingSaga()
}

export default chat2Saga
