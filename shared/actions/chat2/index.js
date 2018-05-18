// @flow
import * as AppGen from '../app-gen'
import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/chat2'
import * as EngineRpc from '../../constants/engine'
import * as I from 'immutable'
import * as KBFSGen from '../kbfs-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Route from '../route-tree'
import * as Saga from '../../util/saga'
import * as SearchConstants from '../../constants/search'
import * as SearchGen from '../search-gen'
import * as TeamsGen from '../teams-gen'
import * as Types from '../../constants/types/chat2'
import * as UsersGen from '../users-gen'
import {hasCanPerform, retentionPolicyToServiceRetentionPolicy} from '../../constants/teams'
import type {NavigateActions} from '../../constants/types/route-tree'
import engine from '../../engine'
import logger from '../../logger'
import type {TypedState, Dispatch} from '../../util/container'
import {chatTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {getPath} from '../../route-tree'
import {NotifyPopup} from '../../native/notifications'
import {
  showMainWindow,
  saveAttachmentToCameraRoll,
  downloadAndShowShareActionSheet,
} from '../platform-specific'
import {tmpDir, downloadFilePath} from '../../util/file'
import {privateFolderWithUsers, teamFolder} from '../../constants/config'
import {parseFolderNameToUsers} from '../../util/kbfs'

const inboxQuery = {
  computeActiveList: true,
  readOnly: false,
  status: Object.keys(RPCChatTypes.commonConversationStatus)
    .filter(k => !['ignored', 'blocked', 'reported'].includes(k))
    .map(k => RPCChatTypes.commonConversationStatus[k]),
  tlfVisibility: RPCTypes.commonTLFVisibility.private,
  topicType: RPCChatTypes.commonTopicType.chat,
  unreadOnly: false,
}

// Ask the service to refresh the inbox
const inboxRefresh = (
  action: Chat2Gen.InboxRefreshPayload | Chat2Gen.LeaveConversationPayload,
  state: TypedState
) => {
  const username = state.config.username || ''
  const untrustedInboxRpc = new EngineRpc.EngineRpcCall(
    {
      'chat.1.chatUi.chatInboxUnverified': function*({
        inbox,
      }: RPCChatTypes.ChatUiChatInboxUnverifiedRpcParam) {
        const result: RPCChatTypes.UnverifiedInboxUIItems = JSON.parse(inbox)
        const items: Array<RPCChatTypes.UnverifiedInboxUIItem> = result.items || []
        // We get a subset of meta information from the cache even in the untrusted payload
        const metas = items
          .map(item => Constants.unverifiedInboxUIItemToConversationMeta(item, username))
          .filter(Boolean)
        // Check if some of our existing stored metas might no longer be valid
        const clearExistingMetas =
          action.type === Chat2Gen.inboxRefresh &&
          ['inboxSyncedClear', 'leftAConversation'].includes(action.payload.reason)
        const clearExistingMessages =
          action.type === Chat2Gen.inboxRefresh && action.payload.reason === 'inboxSyncedClear'
        yield Saga.put(Chat2Gen.createMetasReceived({clearExistingMessages, clearExistingMetas, metas}))
        return EngineRpc.rpcResult()
      },
    },
    RPCChatTypes.localGetInboxNonblockLocalRpcChannelMap,
    'inboxRefresh',
    {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      maxUnbox: 0,
      query: inboxQuery,
      skipUnverified: false,
    },
    false,
    loading => Chat2Gen.createSetLoading({key: 'inboxRefresh', loading})
  )

  return Saga.call(untrustedInboxRpc.run)
}

// When we get info on a team we need to unbox immediately so we can get the channel names
const requestTeamsUnboxing = (action: Chat2Gen.MetasReceivedPayload) => {
  const conversationIDKeys = action.payload.metas
    .filter(meta => meta.trustedState === 'untrusted' && meta.teamType === 'big' && !meta.channelname)
    .map(meta => meta.conversationIDKey)
  if (conversationIDKeys.length) {
    return Saga.put(
      Chat2Gen.createMetaRequestTrusted({
        conversationIDKeys,
      })
    )
  }
}

// Only get the untrusted conversations out
const untrustedConversationIDKeys = (state: TypedState, ids: Array<Types.ConversationIDKey>) =>
  ids.filter(id => state.chat2.metaMap.getIn([id, 'trustedState'], 'untrusted') === 'untrusted')

// We keep a set of conversations to unbox
let metaQueue = I.OrderedSet()
const queueMetaToRequest = (action: Chat2Gen.MetaNeedsUpdatingPayload, state: TypedState) => {
  const old = metaQueue
  metaQueue = metaQueue.concat(untrustedConversationIDKeys(state, action.payload.conversationIDKeys))
  if (old !== metaQueue) {
    // only unboxMore if something changed
    return Saga.put(Chat2Gen.createMetaHandleQueue())
  } else {
    logger.info('skipping meta queue run, queue unchanged')
  }
}

// Watch the meta queue and take up to 10 items. Choose the last items first since they're likely still visible
const requestMeta = (action: Chat2Gen.MetaHandleQueuePayload, state: TypedState) => {
  const maxToUnboxAtATime = 10
  const maybeUnbox = metaQueue.takeLast(maxToUnboxAtATime)
  metaQueue = metaQueue.skipLast(maxToUnboxAtATime)

  const conversationIDKeys = untrustedConversationIDKeys(state, maybeUnbox.toArray())
  const toUnboxActions = conversationIDKeys.length
    ? [Saga.put(Chat2Gen.createMetaRequestTrusted({conversationIDKeys}))]
    : []
  const unboxSomeMoreActions = metaQueue.size ? [Saga.put(Chat2Gen.createMetaHandleQueue())] : []
  const delayBeforeUnboxingMoreActions =
    toUnboxActions.length && unboxSomeMoreActions.length ? [Saga.call(Saga.delay, 100)] : []

  const nextActions = [...toUnboxActions, ...delayBeforeUnboxingMoreActions, ...unboxSomeMoreActions]

  if (nextActions.length) {
    return Saga.sequentially(nextActions)
  }
}

// Get valid keys that we aren't already loading or have loaded
const rpcMetaRequestConversationIDKeys = (
  action: Chat2Gen.MetaRequestTrustedPayload | Chat2Gen.SelectConversationPayload,
  state: TypedState
) => {
  let keys
  switch (action.type) {
    case Chat2Gen.metaRequestTrusted:
      keys = action.payload.conversationIDKeys
      if (action.payload.force) {
        return keys
      }
      break
    case Chat2Gen.selectConversation:
      keys = [action.payload.conversationIDKey].filter(Boolean)
      break
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(action);
      */
      throw new Error('Invalid action passed to unboxRows')
  }
  return Constants.getConversationIDKeyMetasToLoad(keys, state.chat2.metaMap)
}

// We want to unbox rows that have scroll into view
const unboxRows = (
  action: Chat2Gen.MetaRequestTrustedPayload | Chat2Gen.SelectConversationPayload,
  state: TypedState
) => {
  const conversationIDKeys = rpcMetaRequestConversationIDKeys(action, state)
  if (!conversationIDKeys.length) {
    return
  }

  const onUnboxed = function*({conv}: RPCChatTypes.ChatUiChatInboxConversationRpcParam) {
    const inboxUIItem: RPCChatTypes.InboxUIItem = JSON.parse(conv)
    const meta = Constants.inboxUIItemToConversationMeta(inboxUIItem)
    if (meta) {
      yield Saga.put(Chat2Gen.createMetasReceived({metas: [meta], neverCreate: true}))
    } else {
      yield Saga.put(
        Chat2Gen.createMetaReceivedError({
          conversationIDKey: Types.stringToConversationIDKey(inboxUIItem.convID),
          error: null, // just remove this item, not a real server error
          username: null,
        })
      )
    }
    const state: TypedState = yield Saga.select()
    const infoMap = state.users.infoMap
    let added = false
    // We get some info about users also so update that too
    const usernameToFullname = Object.keys(inboxUIItem.fullNames).reduce((map, username) => {
      if (!infoMap.get(username)) {
        added = true
        map[username] = inboxUIItem.fullNames[username]
      }
      return map
    }, {})
    if (added) {
      yield Saga.put(UsersGen.createUpdateFullnames({usernameToFullname}))
    }
    return EngineRpc.rpcResult()
  }
  const onFailed = function*({convID, error}: RPCChatTypes.ChatUiChatInboxFailedRpcParam) {
    const state: TypedState = yield Saga.select()
    const conversationIDKey = Types.conversationIDToKey(convID)
    switch (error.typ) {
      case RPCChatTypes.localConversationErrorType.transient:
        logger.info(
          `onFailed: ignoring transient error for convID: ${conversationIDKey} error: ${error.message}`
        )
        break
      default:
        logger.info(`onFailed: displaying error for convID: ${conversationIDKey} error: ${error.message}`)
        yield Saga.put(
          Chat2Gen.createMetaReceivedError({
            conversationIDKey: conversationIDKey,
            error,
            username: state.config.username || '',
          })
        )
    }
    return EngineRpc.rpcResult()
  }
  const loadInboxRpc = new EngineRpc.EngineRpcCall(
    {
      'chat.1.chatUi.chatInboxConversation': onUnboxed,
      'chat.1.chatUi.chatInboxFailed': onFailed,
      'chat.1.chatUi.chatInboxUnverified': EngineRpc.passthroughResponseSaga,
    },
    RPCChatTypes.localGetInboxNonblockLocalRpcChannelMap,
    'unboxConversations',
    {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      query: {
        ...inboxQuery,
        convIDs: conversationIDKeys.map(Types.keyToConversationID),
      },
      skipUnverified: true,
    },
    false,
    loading => Chat2Gen.createSetLoading({key: `unboxing:${conversationIDKeys[0]}`, loading})
  )

  return Saga.sequentially([
    Saga.put(Chat2Gen.createMetaRequestingTrusted({conversationIDKeys})),
    Saga.call(loadInboxRpc.run),
  ])
}

// We get an incoming message streamed to us
const onIncomingMessage = (incoming: RPCChatTypes.IncomingMessage, state: TypedState) => {
  const {message: cMsg, convID, displayDesktopNotification, conv} = incoming
  const actions = []

  if (convID && cMsg) {
    const conversationIDKey = Types.conversationIDToKey(convID)
    const message = Constants.uiMessageToMessage(
      conversationIDKey,
      cMsg,
      state.config.username || '',
      state.config.deviceName || ''
    )
    if (message) {
      // The attachmentuploaded call is like an 'edit' of an attachment. We get the placeholder, then its replaced by the actual image
      if (
        cMsg.state === RPCChatTypes.chatUiMessageUnboxedState.valid &&
        cMsg.valid &&
        cMsg.valid.messageBody.messageType === RPCChatTypes.commonMessageType.attachmentuploaded &&
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
      } else {
        // A normal message
        actions.push(Chat2Gen.createMessagesAdd({context: {type: 'incoming'}, messages: [message]}))
        if (!isMobile && displayDesktopNotification && conv && conv.snippet) {
          actions.push(
            Chat2Gen.createDesktopNotification({
              author: message.author,
              body: conv.snippet,
              conversationIDKey,
            })
          )
        }
      }
    } else if (cMsg.state === RPCChatTypes.chatUiMessageUnboxedState.valid && cMsg.valid) {
      const body = cMsg.valid.messageBody
      // Types that are mutations
      switch (body.messageType) {
        case RPCChatTypes.commonMessageType.edit:
          if (body.edit) {
            actions.push(
              Chat2Gen.createMessageWasEdited({
                conversationIDKey,
                ...Constants.uiMessageEditToMessage(body.edit, cMsg.valid),
              })
            )
          }
          break
        case RPCChatTypes.commonMessageType.delete:
          if (body.delete && body.delete.messageIDs) {
            actions.push(
              Chat2Gen.createMessagesWereDeleted({conversationIDKey, messageIDs: body.delete.messageIDs})
            )
          }
          break
      }
    }
  }

  // We need to do things and we need to consume the inbox updates that come along with this data
  return [...actions, ...chatActivityToMetasAction(incoming)]
}

// Helper to handle incoming inbox updates that piggy back on various calls
const chatActivityToMetasAction = (payload: ?{+conv?: ?RPCChatTypes.InboxUIItem}) => {
  const conv = payload ? payload.conv : null
  const meta = conv && Constants.inboxUIItemToConversationMeta(conv)
  const conversationIDKey = meta
    ? meta.conversationIDKey
    : conv && Types.stringToConversationIDKey(conv.convID)
  const usernameToFullname = (conv && conv.fullNames) || {}
  // We ignore inbox rows that are ignored/blocked/reported or have no content
  const isADelete =
    conv &&
    ([
      RPCChatTypes.commonConversationStatus.ignored,
      RPCChatTypes.commonConversationStatus.blocked,
      RPCChatTypes.commonConversationStatus.reported,
    ].includes(conv.status) ||
      conv.isEmpty)

  // We want to select a different convo if its cause we ignored/blocked/reported. Otherwise sometimes we get that a convo
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
  const actions = outboxRecords.reduce((arr, outboxRecord) => {
    const s = outboxRecord.state
    if (s.state === RPCChatTypes.localOutboxStateType.error) {
      const error = s.error
      if (error && error.typ) {
        // This is temp until fixed by CORE-7112. We get this error but not the call to let us show the red banner
        const reason = Constants.rpcErrorToString(error)
        let tempForceRedBox
        if (error.typ === RPCChatTypes.localOutboxErrorType.identify) {
          // Find out the user who failed identify
          const match = error.message && error.message.match(/"(.*)"/)
          tempForceRedBox = match && match[1]
        }

        const conversationIDKey = Types.conversationIDToKey(outboxRecord.convID)
        const outboxID = Types.rpcOutboxIDToOutboxID(outboxRecord.outboxID)
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

// Service tells us it's done syncing
const onChatInboxSynced = (syncRes, getState) => {
  const actions = [Chat2Gen.createClearLoading({key: 'inboxSyncStarted'})]

  switch (syncRes.syncType) {
    // Just clear it all
    case RPCChatTypes.commonSyncInboxResType.clear:
      actions.push(Chat2Gen.createInboxRefresh({reason: 'inboxSyncedClear'}))
      break
    // We're up to date
    case RPCChatTypes.commonSyncInboxResType.current:
      break
    // We got some new messages appended
    case RPCChatTypes.commonSyncInboxResType.incremental: {
      const state: TypedState = getState()
      const selectedConversation = Constants.getSelectedConversation(state)
      const username = state.config.username || ''
      const items = (syncRes.incremental && syncRes.incremental.items) || []
      const metas = items.reduce((arr, i) => {
        const meta = Constants.unverifiedInboxUIItemToConversationMeta(i, username)
        if (meta) {
          if (meta.conversationIDKey === selectedConversation) {
            // First thing load the messages
            actions.unshift(
              Chat2Gen.createMarkConversationsStale({conversationIDKeys: [selectedConversation]})
            )
          }
          arr.push(meta)
        }
        return arr
      }, [])
      // Update new untrusted
      if (metas.length) {
        actions.push(Chat2Gen.createMetasReceived({metas}))
      }
      // Unbox items
      actions.push(
        Chat2Gen.createMetaRequestTrusted({
          conversationIDKeys: items.map(i => Types.stringToConversationIDKey(i.convID)),
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

// Got some new typers
const onChatTypingUpdate = typingUpdates => {
  if (!typingUpdates) {
    return null
  } else {
    const conversationToTypers = I.Map(
      typingUpdates.reduce((arr, u) => {
        arr.push([Types.conversationIDToKey(u.convID), I.Set((u.typers || []).map(t => t.username))])
        return arr
      }, [])
    )
    return [Chat2Gen.createUpdateTypers({conversationToTypers})]
  }
}

const onChatThreadStale = updates => {
  const conversationIDKeys = (updates || []).reduce((arr, u) => {
    if (u.updateType === RPCChatTypes.notifyChatStaleUpdateType.clear) {
      arr.push(Types.conversationIDToKey(u.convID))
    }
    return arr
  }, [])
  if (conversationIDKeys.length > 0) {
    return [
      Chat2Gen.createMarkConversationsStale({conversationIDKeys}),
      Chat2Gen.createMetaRequestTrusted({
        conversationIDKeys,
        force: true,
      }),
    ]
  }
}

// Some participants are broken/fixed now
const onChatIdentifyUpdate = update => {
  const usernames = update.CanonicalName.split(',')
  const broken = (update.breaks.breaks || []).map(b => b.user.username)
  const newlyBroken = []
  const newlyFixed = []

  usernames.forEach(name => {
    if (broken.includes(name)) {
      newlyBroken.push(name)
    } else {
      newlyFixed.push(name)
    }
  })

  return [UsersGen.createUpdateBrokenState({newlyBroken, newlyFixed})]
}

// Handle calls that come from the service
const setupChatHandlers = () => {
  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.NewChatActivity',
    (payload: {activity: RPCChatTypes.ChatActivity}, ignore1, ignore2, getState) => {
      const activity: RPCChatTypes.ChatActivity = payload.activity
      logger.info(`Got new chat activity of type: ${activity.activityType}`)
      switch (activity.activityType) {
        case RPCChatTypes.notifyChatChatActivityType.incomingMessage:
          return activity.incomingMessage ? onIncomingMessage(activity.incomingMessage, getState()) : null
        case RPCChatTypes.notifyChatChatActivityType.setStatus:
          return chatActivityToMetasAction(activity.setStatus)
        case RPCChatTypes.notifyChatChatActivityType.readMessage:
          return chatActivityToMetasAction(activity.readMessage)
        case RPCChatTypes.notifyChatChatActivityType.newConversation:
          return chatActivityToMetasAction(activity.newConversation)
        case RPCChatTypes.notifyChatChatActivityType.failedMessage: {
          const failedMessage: ?RPCChatTypes.FailedMessageInfo = activity.failedMessage
          return failedMessage && failedMessage.outboxRecords
            ? onErrorMessage(failedMessage.outboxRecords)
            : null
        }
        case RPCChatTypes.notifyChatChatActivityType.membersUpdate:
          const convID = activity.membersUpdate && activity.membersUpdate.convID
          return convID
            ? [
                Chat2Gen.createMetaRequestTrusted({
                  conversationIDKeys: [Types.conversationIDToKey(convID)],
                  force: true,
                }),
              ]
            : null
        case RPCChatTypes.notifyChatChatActivityType.setAppNotificationSettings:
          const setAppNotificationSettings: ?RPCChatTypes.SetAppNotificationSettingsInfo =
            activity.setAppNotificationSettings
          return setAppNotificationSettings
            ? [
                Chat2Gen.createNotificationSettingsUpdated({
                  conversationIDKey: Types.conversationIDToKey(setAppNotificationSettings.convID),
                  settings: setAppNotificationSettings.settings,
                }),
              ]
            : null
        case RPCChatTypes.notifyChatChatActivityType.teamtype:
          return [Chat2Gen.createInboxRefresh({reason: 'teamTypeChanged'})]
        case RPCChatTypes.notifyChatChatActivityType.expunge:
          const expungeInfo: ?RPCChatTypes.ExpungeInfo = activity.expunge
          return expungeInfo
            ? [
                Chat2Gen.createMessagesWereDeleted({
                  conversationIDKey: Types.conversationIDToKey(expungeInfo.convID),
                  upToMessageID: expungeInfo.expunge.upto,
                }),
              ]
            : null
        default:
          break
      }
    }
  )

  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.ChatTLFFinalize',
    ({convID}: {convID: RPCChatTypes.ConversationID}) => [
      Chat2Gen.createMetaRequestTrusted({conversationIDKeys: [Types.conversationIDToKey(convID)]}),
    ]
  )

  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.ChatInboxSynced',
    ({syncRes}: RPCChatTypes.NotifyChatChatInboxSyncedRpcParam, ignore1, ignore2, getState) =>
      onChatInboxSynced(syncRes, getState)
  )

  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatInboxSyncStarted', () => [
    Chat2Gen.createSetLoading({key: 'inboxSyncStarted', loading: true}),
  ])

  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatInboxStale', () => [
    Chat2Gen.createInboxRefresh({reason: 'inboxStale'}),
  ])

  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.ChatIdentifyUpdate',
    ({update}: RPCChatTypes.NotifyChatChatIdentifyUpdateRpcParam) => onChatIdentifyUpdate(update)
  )

  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.ChatTypingUpdate',
    ({typingUpdates}: RPCChatTypes.NotifyChatChatTypingUpdateRpcParam) => onChatTypingUpdate(typingUpdates)
  )

  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.ChatThreadsStale',
    ({updates}: RPCChatTypes.NotifyChatChatThreadsStaleRpcParam) => onChatThreadStale(updates)
  )

  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatJoinedConversation', () => [
    Chat2Gen.createInboxRefresh({reason: 'joinedAConversation'}),
  ])
  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatLeftConversation', () => [
    Chat2Gen.createInboxRefresh({reason: 'leftAConversation'}),
  ])
  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatSetConvRetention', update => {
    if (update.conv) {
      return [Chat2Gen.createUpdateConvRetentionPolicy({conv: update.conv})]
    }
    logger.warn(
      'ChatHandler: got NotifyChat.ChatSetConvRetention with no attached InboxUIItem. Forcing update.'
    )
    // force to get the new retention policy
    return [
      Chat2Gen.createMetaRequestTrusted({
        conversationIDKeys: [Types.conversationIDToKey(update.convID)],
        force: true,
      }),
    ]
  })
  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatSetTeamRetention', update => {
    if (update.convs) {
      return [Chat2Gen.createUpdateTeamRetentionPolicy({convs: update.convs})]
    }
    // this is a more serious problem, but we don't need to bug the user about it
    logger.error(
      'ChatHandler: got NotifyChat.ChatSetTeamRetention with no attached InboxUIItems. The local version may be out of date'
    )
  })
}

const loadThreadMessageTypes = Object.keys(RPCChatTypes.commonMessageType).reduce((arr, key) => {
  switch (key) {
    case 'edit': // daemon filters this out for us so we can ignore
    case 'delete':
    case 'attachmentuploaded':
      break
    default:
      arr.push(RPCChatTypes.commonMessageType[key])
      break
  }

  return arr
}, [])

// We bookkeep the current request's paginationkey in case we get very slow callbacks so we we can ignore new paginationKeys that are too old
const _loadingMessagesWithPaginationKey = {}
// Load new messages on a thread. We call this when you select a conversation, we get a thread-is-stale notification, or when you scroll up and want more messages
const loadMoreMessages = (
  action:
    | Chat2Gen.SelectConversationPayload
    | Chat2Gen.LoadOlderMessagesDueToScrollPayload
    | Chat2Gen.SetPendingConversationUsersPayload
    | Chat2Gen.MarkConversationsStalePayload
    | Chat2Gen.MetasReceivedPayload,
  state: TypedState
) => {
  const numMessagesOnInitialLoad = isMobile ? 20 : 500
  const numMessagesOnScrollback = isMobile ? 100 : 500

  // Get the conversationIDKey
  let key = null
  let reason: string = ''

  if (action.type === Chat2Gen.setPendingConversationUsers) {
    if (state.chat2.pendingSelected) {
      key = Constants.findConversationFromParticipants(state, I.Set(action.payload.users))
      reason = 'building a search'
    }
  } else if (action.type === Chat2Gen.markConversationsStale) {
    key = Constants.getSelectedConversation(state)
    // not mentioned?
    if (action.payload.conversationIDKeys.indexOf(key) === -1) {
      return
    }
    reason = 'got stale'
  } else if (action.type === Chat2Gen.selectConversation) {
    key = action.payload.conversationIDKey
    reason = action.payload.reason || 'selected'
  } else if (action.type === Chat2Gen.metasReceived) {
    if (!action.payload.clearExistingMessages) {
      // we didn't clear anything out, we don't need to fetch anything
      return
    }
    key = Constants.getSelectedConversation(state)
  } else {
    key = action.payload.conversationIDKey
  }

  if (!key) {
    logger.info('Load thread bail: no conversationIDKey')
    return
  }

  const conversationIDKey = key

  const conversationID = Types.keyToConversationID(conversationIDKey)
  if (!conversationID) {
    logger.info('Load thread bail: invalid conversationIDKey')
    return
  }

  // When we select a conversation we always load the newest N messages and keep track of the pagination information
  // When you scroll back we use that to get the next page and update the value
  // otherwise we always just load the newest N and get a new pagination value
  let numberOfMessagesToLoad
  let paginationKey = null

  const meta = Constants.getMeta(state, conversationIDKey)

  if (meta.membershipType === 'youAreReset' || !meta.rekeyers.isEmpty()) {
    logger.info('Load thread bail: we are reset')
    return
  }

  if (action.type === Chat2Gen.loadOlderMessagesDueToScroll) {
    paginationKey = meta.paginationKey
    // no more to load
    if (!paginationKey) {
      logger.info('Load thread bail: scrolling back and no pagination key')
      return
    }
    numberOfMessagesToLoad = numMessagesOnScrollback
  } else {
    numberOfMessagesToLoad = numMessagesOnInitialLoad
  }

  // Update bookkeeping
  _loadingMessagesWithPaginationKey[Types.conversationIDKeyToString(conversationIDKey)] = paginationKey

  // we clear on the first callback. we sometimes don't get a cached context
  let calledClear = false
  const onGotThread = function*({thread}: {thread: string}, context: 'full' | 'cached') {
    if (thread) {
      const uiMessages: RPCChatTypes.UIMessages = JSON.parse(thread)

      const messages = (uiMessages.messages || []).reduce((arr, m) => {
        const message = conversationIDKey
          ? Constants.uiMessageToMessage(
              conversationIDKey,
              m,
              state.config.username || '',
              state.config.deviceName || ''
            )
          : null
        if (message) {
          arr.push(message)
        }
        return arr
      }, [])

      // Still loading this conversation w/ this paginationKey?
      if (
        _loadingMessagesWithPaginationKey[Types.conversationIDKeyToString(conversationIDKey)] ===
        paginationKey
      ) {
        let newPaginationKey = Types.stringToPaginationKey(
          (uiMessages.pagination && uiMessages.pagination.next) || ''
        )

        if (context === 'full') {
          const paginationMoreToLoad = uiMessages.pagination ? !uiMessages.pagination.last : true
          // if last is true on the full payload we blow away paginationKey
          newPaginationKey = paginationMoreToLoad ? newPaginationKey : Types.stringToPaginationKey('')
        }
        yield Saga.put(
          Chat2Gen.createMetaUpdatePagination({conversationIDKey, paginationKey: newPaginationKey})
        )
      }

      // If we're loading the thread clean lets clear
      if (!calledClear && action.type !== Chat2Gen.loadOlderMessagesDueToScroll) {
        calledClear = true
        // only clear if we've never seen the oldest message, implying there is a gap
        if (messages.length) {
          const oldestOrdinal = messages[messages.length - 1].ordinal
          const state: TypedState = yield Saga.select()
          if (!state.chat2.messageOrdinals.get(conversationIDKey, oldestOrdinal)) {
            yield Saga.put(Chat2Gen.createClearOrdinals({conversationIDKey}))
          }
        }
      }

      if (messages.length) {
        yield Saga.put(
          Chat2Gen.createMessagesAdd({context: {conversationIDKey, type: 'threadLoad'}, messages})
        )
      }
    }

    return EngineRpc.rpcResult()
  }

  logger.info(
    `Load thread: calling rpc convo: ${conversationIDKey} paginationKey: ${paginationKey ||
      ''} num: ${numberOfMessagesToLoad} reason: ${reason}`
  )

  const loadingKey = `loadingThread:${conversationIDKey}`
  const loadThreadChanMapRpc = new EngineRpc.EngineRpcCall(
    {
      'chat.1.chatUi.chatThreadCached': function*(p) {
        return yield* onGotThread(p, 'cached')
      },
      'chat.1.chatUi.chatThreadFull': function*(p) {
        return yield* onGotThread(p, 'full')
      },
    },
    RPCChatTypes.localGetThreadNonblockRpcChannelMap,
    'localGetThreadNonblock',
    {
      cbMode: RPCChatTypes.localGetThreadNonblockCbMode.incremental,
      conversationID,
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      pagination: {
        next: paginationKey,
        num: numberOfMessagesToLoad,
      },
      query: {
        disableResolveSupersedes: false,
        markAsRead: false,
        messageTypes: loadThreadMessageTypes,
      },
      pgmode: RPCChatTypes.localGetThreadNonblockPgMode.server,
      reason:
        reason === 'push'
          ? RPCChatTypes.localGetThreadNonblockReason.push
          : RPCChatTypes.localGetThreadNonblockReason.general,
    },
    false,
    (loading: boolean) => Chat2Gen.createSetLoading({key: loadingKey, loading})
  )

  const actions = [
    Saga.identity(conversationIDKey),
    Saga.call(loadThreadChanMapRpc.run),
    // clear if we loaded from a push
    Saga.put(Chat2Gen.createClearLoading({key: `pushLoad:${conversationIDKey}`})),
  ]

  return Saga.sequentially(actions)
}

const loadMoreMessagesSuccess = (results: ?Array<any>) => {
  if (!results) return
  const conversationIDKey: Types.ConversationIDKey = results[0]
  const res: RPCChatTypes.NonblockFetchRes = results[1].payload.params
  return Saga.put(Chat2Gen.createSetConversationOffline({conversationIDKey, offline: res.offline}))
}

// If we're previewing a conversation we tell the service so it injects it into the inbox with a flag to tell us its a preview
const previewConversation = (action: Chat2Gen.SelectConversationPayload) =>
  action.payload.reason === 'preview' || action.payload.reason === 'messageLink'
    ? Saga.call(RPCChatTypes.localPreviewConversationByIDLocalRpcPromise, {
        convID: Types.keyToConversationID(action.payload.conversationIDKey),
      })
    : null

const clearInboxFilter = (action: Chat2Gen.SelectConversationPayload) =>
  action.payload.reason === 'inboxFilterArrow' || action.payload.reason === 'inboxFilterChanged'
    ? undefined
    : Saga.put(Chat2Gen.createSetInboxFilter({filter: ''}))

// Show a desktop notification
const desktopNotify = (action: Chat2Gen.DesktopNotificationPayload, state: TypedState) => {
  const {conversationIDKey, author, body} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)

  if (
    !Constants.isUserActivelyLookingAtThisThread(state, conversationIDKey) &&
    !meta.isMuted // ignore muted convos
  ) {
    logger.info('Sending Chat notification')
    return Saga.put((dispatch: Dispatch) => {
      let title = ['small', 'big'].includes(meta.teamType) ? meta.teamname : author
      if (meta.teamType === 'big') {
        title += `#${meta.channelname}`
      }
      NotifyPopup(title, {body}, -1, author, () => {
        dispatch(
          Chat2Gen.createSelectConversation({
            conversationIDKey,
            reason: 'desktopNotification',
          })
        )
        dispatch(Route.switchTo([chatTab]))
        showMainWindow()
      })
    })
  }
}

// Delete a message. We cancel pending messages
const messageDelete = (action: Chat2Gen.MessageDeletePayload, state: TypedState) => {
  const {conversationIDKey, ordinal} = action.payload
  const message = state.chat2.messageMap.getIn([conversationIDKey, ordinal])
  if (!message || (message.type !== 'text' && message.type !== 'attachment')) {
    logger.warn('Deleting non-existant or, non-text non-attachment message')
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
      return Saga.sequentially([
        Saga.call(RPCChatTypes.localCancelPostRpcPromise, {
          outboxID: Types.outboxIDToRpcOutboxID(message.outboxID),
        }),
        Saga.put(Chat2Gen.createMessagesWereDeleted({conversationIDKey, ordinals: [message.ordinal]})),
      ])
    } else {
      logger.warn('Delete of no message id and no outboxid')
    }
  } else {
    return Saga.call(RPCChatTypes.localPostDeleteNonblockRpcPromise, {
      clientPrev: 0,
      conversationID: Types.keyToConversationID(conversationIDKey),
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      outboxID: null,
      supersedes: message.id,
      tlfName: meta.tlfname,
      tlfPublic: false,
    })
  }
}

const clearMessageSetEditing = (action: Chat2Gen.MessageEditPayload) =>
  Saga.put(
    Chat2Gen.createMessageSetEditing({
      conversationIDKey: action.payload.conversationIDKey,
      ordinal: null,
    })
  )

// We pass a special flag to tell the service if we're aware of any broken users. This is so we avoid
// accidentally sending into a convo when there should be a red bar but we haven't seen it for some reason
const getIdentifyBehavior = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
  const participants = Constants.getMeta(state, conversationIDKey).participants
  const hasBroken = participants.some(p => state.users.infoMap.getIn([p, 'broken']))
  // We send a flag to the daemon depending on if we know about a broken user or not. If not it'll check before sending and show
  // the red banner
  return hasBroken
    ? RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui
    : RPCTypes.tlfKeysTLFIdentifyBehavior.chatGuiStrict
}

const messageReplyPrivately = (action: Chat2Gen.MessageReplyPrivatelyPayload, state: TypedState) => {
  const {sourceConversationIDKey, ordinal} = action.payload
  const you = state.config.username
  const message = Constants.getMessageMap(state, sourceConversationIDKey).get(ordinal)
  if (!message) {
    logger.warn("Can't find message to reply to", ordinal)
    return
  }

  // Do we already have a convo for this author?
  const newConversationIDKey =
    you && Constants.findConversationFromParticipants(state, I.Set([message.author, you]))

  return Saga.sequentially([
    Saga.put(
      Chat2Gen.createMessageSetQuoting({
        ordinal,
        sourceConversationIDKey,
        targetConversationIDKey: newConversationIDKey || Constants.pendingConversationIDKey,
      })
    ),
    Saga.put(
      Chat2Gen.createStartConversation({
        participants: [message.author],
      })
    ),
  ])
}

const messageEdit = (action: Chat2Gen.MessageEditPayload, state: TypedState) => {
  const {conversationIDKey, text, ordinal} = action.payload
  const message = Constants.getMessageMap(state, conversationIDKey).get(ordinal)
  if (!message) {
    logger.warn("Can't find message to edit", ordinal)
    return
  }

  if (message.type === 'text') {
    // Skip if the content is the same
    if (message.text.stringValue() === text.stringValue()) {
      return Saga.put(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal: null}))
    }

    const meta = Constants.getMeta(state, conversationIDKey)
    const tlfName = meta.tlfname
    const clientPrev = Constants.getClientPrev(state, conversationIDKey)
    // Editing a normal message
    if (message.id) {
      const supersedes = message.id
      const outboxID = Constants.generateOutboxID()

      return Saga.call(RPCChatTypes.localPostEditNonblockRpcPromise, {
        body: text.stringValue(),
        clientPrev,
        conversationID: Types.keyToConversationID(conversationIDKey),
        identifyBehavior: getIdentifyBehavior(state, conversationIDKey),
        outboxID,
        supersedes,
        tlfName,
        tlfPublic: false,
      })
    } else {
      // Pending messages need to be cancelled and resent
      if (message.outboxID) {
        return Saga.sequentially([
          Saga.call(RPCChatTypes.localCancelPostRpcPromise, {
            outboxID: Types.outboxIDToRpcOutboxID(message.outboxID),
          }),
          Saga.put(Chat2Gen.createMessagesWereDeleted({conversationIDKey, ordinals: [message.ordinal]})),
          Saga.put(Chat2Gen.createMessageSend({conversationIDKey, text})),
        ])
      } else {
        logger.warn('Editing no id and no outboxid')
      }
    }
  } else {
    logger.warn('Editing non-text message')
  }
}

// First we make the conversation, then on success we dispatch the piggybacking action
const sendToPendingConversation = (action: Chat2Gen.SendToPendingConversationPayload, state: TypedState) => {
  const tlfName = action.payload.users.join(',')
  const membersType = RPCChatTypes.commonConversationMembersType.impteamnative

  return Saga.sequentially([
    // Disable sending more into a pending conversation
    Saga.put(Chat2Gen.createSetPendingStatus({pendingStatus: 'waiting'})),
    // Disable searching for more people once you've tried to send
    Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'fixedSetOfUsers'})),
    // Try to make the conversation
    Saga.call(RPCChatTypes.localNewConversationLocalRpcPromise, {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      membersType,
      tlfName,
      tlfVisibility: RPCTypes.commonTLFVisibility.private,
      topicType: RPCChatTypes.commonTopicType.chat,
    }),
  ])
}

// Now actually send
const sendToPendingConversationSuccess = (
  results: [any, any, RPCChatTypes.NewConversationLocalRes],
  action: Chat2Gen.SendToPendingConversationPayload
) => {
  const conversationIDKey = Types.conversationIDToKey(results[2].conv.info.id)
  if (!conversationIDKey) {
    logger.warn("Couldn't make a new conversation?")
    return
  }

  // Update conversationIDKey to real one
  const {sendingAction} = action.payload
  const updatedSendingAction = {
    ...sendingAction,
    payload: {
      ...sendingAction.payload,
      conversationIDKey,
    },
  }

  // emulate getting an inbox item for the new conversation. This lets us skip having to unbox the inbox item
  const dummyMeta = Constants.makeConversationMeta({
    conversationIDKey,
    participants: I.OrderedSet(action.payload.users),
    tlfname: action.payload.users.join(','),
  })

  return Saga.sequentially([
    // Clear the search
    Saga.put(Chat2Gen.createExitSearch({canceled: true})),
    // Clear the dummy messages from the pending conversation
    Saga.put(Chat2Gen.createClearPendingConversation()),
    // Emulate us getting an inbox item so we don't have to unbox it before sending
    Saga.put(Chat2Gen.createMetasReceived({metas: [dummyMeta]})),
    // Select it
    Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'justCreated'})),
    // Clear the pendingStatus
    Saga.put(Chat2Gen.createSetPendingStatus({pendingStatus: 'none'})),
    // Post it
    Saga.put(updatedSendingAction),
  ])
}

const sendToPendingConversationError = (e: Error, action: Chat2Gen.SendToPendingConversationPayload) =>
  Saga.sequentially([
    // Enable controls for the user to retry / cancel
    Saga.put(Chat2Gen.createSetPendingStatus({pendingStatus: 'failed'})),
    // Set the submitState of the pending messages
    Saga.put(
      Chat2Gen.createSetPendingMessageSubmitState({
        reason: e.message,
        submitState: 'failed',
      })
    ),
  ])

const cancelPendingConversation = (action: Chat2Gen.CancelPendingConversationPayload) =>
  Saga.sequentially([
    // clear the search
    Saga.put(Chat2Gen.createExitSearch({canceled: true})),
    // clear out pending conv data
    Saga.put(Chat2Gen.createClearPendingConversation()),
    // Reset pending flags
    Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'none'})),
    Saga.put(Chat2Gen.createSetPendingStatus({pendingStatus: 'none'})),
    // Navigate to the inbox
    Saga.put(Chat2Gen.createNavigateToInbox()),
  ])

const retryPendingConversation = (action: Chat2Gen.RetryPendingConversationPayload, state: TypedState) => {
  const pendingMessages = state.chat2.messageMap.get(Constants.pendingConversationIDKey)
  if (!(pendingMessages && !pendingMessages.isEmpty())) {
    logger.warn('retryPendingConversation: found no pending messages; aborting')
    return
  }
  const pendingUsers = state.chat2.pendingConversationUsers
  if (pendingUsers.isEmpty()) {
    logger.warn('retryPendingConversation: found no pending conv users; aborting')
    return
  }

  if (pendingMessages.size > 1) {
    logger.warn('retryPendingConversation: found more than one pending message; only resending the first')
  }
  // $FlowIssue thinks message can be null
  const message: Types.Message = pendingMessages.first()
  const you = state.config.username
  if (!you) {
    logger.warn('retryPendingConversation: found no currently logged in username; aborting')
    return
  }
  let retryAction: ?(Chat2Gen.MessageSendPayload | Chat2Gen.AttachmentUploadPayload)
  if (message.type === 'text') {
    retryAction = Chat2Gen.createMessageSend({
      conversationIDKey: message.conversationIDKey,
      text: message.text,
    })
  } else if (message.type === 'attachment') {
    retryAction = Chat2Gen.createAttachmentUpload({
      conversationIDKey: message.conversationIDKey,
      path: message.previewURL,
      title: message.title,
    })
  }
  if (retryAction) {
    return Saga.sequentially([
      Saga.put(
        Chat2Gen.createSendToPendingConversation({
          users: pendingUsers.concat([you]).toArray(),
          sendingAction: retryAction,
        })
      ),
      Saga.put(
        Chat2Gen.createSetPendingMessageSubmitState({
          reason: 'Retrying createConversation...',
          submitState: 'pending',
        })
      ),
    ])
  }
  logger.warn(`retryPendingConversation: got message of invalid type ${message.type}`)
}

const messageRetry = (action: Chat2Gen.MessageRetryPayload, state: TypedState) => {
  const {outboxID} = action.payload
  return Saga.call(RPCChatTypes.localRetryPostRpcPromise, {
    outboxID: Types.outboxIDToRpcOutboxID(outboxID),
  })
}

const messageSend = (action: Chat2Gen.MessageSendPayload, state: TypedState) => {
  const {conversationIDKey, text} = action.payload
  const outboxID = Constants.generateOutboxID()

  // Sending to pending
  if (!conversationIDKey) {
    if (state.chat2.pendingConversationUsers.isEmpty()) {
      logger.warn('Sending to pending w/ no pending?')
      return
    }
    const you = state.config.username
    if (!you) {
      logger.warn('Sending to pending while logged out?')
      return
    }

    // placeholder then try and make / send
    return Saga.sequentially([
      Saga.put(
        Chat2Gen.createMessagesAdd({
          context: {type: 'sent'},
          messages: [
            Constants.makePendingTextMessage(
              state,
              conversationIDKey,
              text,
              Types.stringToOutboxID(outboxID.toString('hex') || '') // never null but makes flow happy
            ),
          ],
        })
      ),
      Saga.put(
        Chat2Gen.createSendToPendingConversation({
          sendingAction: action,
          users: state.chat2.pendingConversationUsers.concat([you]).toArray(),
        })
      ),
    ])
  }

  // Did we search for an existing conversation? if so exit it
  const exitSearch = state.chat2.pendingSelected
    ? [
        Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'existingSearch'})),
        Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'none'})),
        Saga.put(Chat2Gen.createSetPendingStatus({pendingStatus: 'none'})),
      ]
    : []

  const meta = Constants.getMeta(state, conversationIDKey)
  const tlfName = meta.tlfname // TODO non existant convo
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)

  // Inject pending message and make the call
  return Saga.sequentially([
    Saga.put(
      Chat2Gen.createMessagesAdd({
        context: {type: 'sent'},
        messages: [
          Constants.makePendingTextMessage(
            state,
            conversationIDKey,
            text,
            Types.stringToOutboxID(outboxID.toString('hex') || '') // never null but makes flow happy
          ),
        ],
      })
    ),
    Saga.call(RPCChatTypes.localPostTextNonblockRpcPromise, {
      body: text.stringValue(),
      clientPrev,
      conversationID: Types.keyToConversationID(conversationIDKey),
      identifyBehavior: getIdentifyBehavior(state, conversationIDKey),
      outboxID,
      tlfName,
      tlfPublic: false,
    }),
    ...exitSearch,
  ])
}

// Start a conversation, or select an existing one
const startConversation = (action: Chat2Gen.StartConversationPayload, state: TypedState) => {
  const {participants, tlf, fromAReset} = action.payload
  const you = state.config.username || ''

  let users: Array<string> = []
  let conversationIDKey

  // we handled participants or tlfs
  if (participants) {
    users = participants
    conversationIDKey = Constants.findConversationFromParticipants(state, I.Set(users))
  } else if (tlf) {
    const parts = tlf.split('/')
    if (parts.length >= 4) {
      const [, , type, names] = parts
      if (type === 'private' || type === 'public') {
        // allow talking to yourself
        users =
          names === you
            ? [you]
            : parseFolderNameToUsers('', names)
                .map(u => u.username)
                .filter(u => u !== you)
        conversationIDKey = Constants.findConversationFromParticipants(state, I.Set(users))
      } else if (type === 'team') {
        // Actually a team, find general channel
        const meta = state.chat2.metaMap.find(
          meta => meta.teamname === names && meta.channelname === 'general'
        )
        if (meta) {
          conversationIDKey = meta.conversationIDKey
        } else {
          throw new Error('Start conversation called w/ bad team tlf')
        }
      } else {
        throw new Error('Start conversation called w/ bad tlf type')
      }
    } else {
      throw new Error('Start conversation called w/ bad tlf')
    }
  } else {
    throw new Error('Start conversation called w/ no participants or tlf')
  }

  // There is an existing conversation, select it
  if (conversationIDKey) {
    return Saga.sequentially([
      Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'startFoundExisting'})),
      Saga.put(Chat2Gen.createNavigateToThread()),
    ])
  }

  return Saga.sequentially([
    // it's a fixed set of users so it's not a search (aka you can't add people to it)
    Saga.put(
      Chat2Gen.createSetPendingMode({pendingMode: fromAReset ? 'startingFromAReset' : 'fixedSetOfUsers'})
    ),
    Saga.put(Chat2Gen.createSetPendingConversationUsers({fromSearch: false, users})),
    Saga.put(Chat2Gen.createNavigateToThread()),
  ])
}

const bootstrapSuccess = () => Saga.put(Chat2Gen.createInboxRefresh({reason: 'bootstrap'}))

// Various things can cause us to lose our selection so this reselects the newest conversation
const selectTheNewestConversation = (
  action:
    | Chat2Gen.MetasReceivedPayload
    | Chat2Gen.LeaveConversationPayload
    | Chat2Gen.MetaDeletePayload
    | TeamsGen.LeaveTeamPayload,
  state: TypedState
) => {
  if (action.type === Chat2Gen.metaDelete) {
    if (!action.payload.selectSomethingElse) {
      return
    }
    // only do this if we blocked the current conversation
    if (Constants.getSelectedConversation(state) !== action.payload.conversationIDKey) {
      return
    }
  } else if (action.type === Chat2Gen.metasReceived) {
    // already something?
    if (Constants.getSelectedConversation(state) || !state.chat2.pendingConversationUsers.isEmpty()) {
      return
    }
  }

  const metas = state.chat2.metaMap
    .filter(meta => meta.teamType !== 'big')
    .sort((a, b) => b.timestamp - a.timestamp)
  let meta
  if (action.type === TeamsGen.leaveTeam) {
    // make sure we don't reselect the team chat if it happens to be first in the list
    meta = metas.filter(meta => meta.teamname !== action.payload.teamname).first()
  } else {
    meta = metas.first()
  }
  if (meta) {
    return Saga.put(
      Chat2Gen.createSelectConversation({
        conversationIDKey: meta.conversationIDKey,
        reason: 'findNewestConversation',
      })
    )
  } else if (action.type === TeamsGen.leaveTeam) {
    // the team we left is the only chat we had
    return Saga.put(
      Chat2Gen.createSelectConversation({
        conversationIDKey: Types.stringToConversationIDKey(''),
        reason: 'clearSelected',
      })
    )
  }
}

const onExitSearch = (action: Chat2Gen.ExitSearchPayload, state: TypedState) => {
  const conversationIDKey = Constants.findConversationFromParticipants(
    state,
    state.chat2.pendingConversationUsers
  )
  return Saga.sequentially([
    Saga.put(SearchGen.createClearSearchResults({searchKey: 'chatSearch'})),
    Saga.put(SearchGen.createSetUserInputItems({searchKey: 'chatSearch', searchResults: []})),
    Saga.put(Chat2Gen.createSetPendingConversationUsers({fromSearch: true, users: []})),
    Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'none'})),
    Saga.put(Chat2Gen.createSetPendingStatus({pendingStatus: 'none'})),
    // We may have some failed pending messages sitting around, clear out that data
    Saga.put(Chat2Gen.createClearPendingConversation()),
    ...(action.payload.canceled || !conversationIDKey
      ? []
      : [Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'startFoundExisting'}))]),
  ])
}

const openFolder = (action: Chat2Gen.OpenFolderPayload, state: TypedState) => {
  const meta = Constants.getMeta(state, action.payload.conversationIDKey)
  const path =
    meta.teamType !== 'adhoc'
      ? teamFolder(meta.teamname)
      : privateFolderWithUsers(meta.participants.toArray())
  return Saga.put(KBFSGen.createOpen({path}))
}

const searchUpdated = (
  action: Chat2Gen.SetPendingModePayload | SearchGen.UserInputItemsUpdatedPayload,
  state: TypedState
) => {
  let users = []
  if (action.type === Chat2Gen.setPendingMode) {
    if (action.payload.pendingMode !== 'searchingForUsers') {
      return
    }
  } else {
    users = action.payload.userInputItemIds || []
  }

  return Saga.sequentially([
    Saga.put(SearchGen.createClearSearchResults({searchKey: 'chatSearch'})),
    ...(users.length
      ? [Saga.put(Chat2Gen.createSetPendingConversationUsers({fromSearch: true, users}))]
      : [Saga.put(SearchGen.createSearchSuggestions({searchKey: 'chatSearch'}))]),
  ])
}

const updatePendingSelected = (
  action: Chat2Gen.SetPendingModePayload | Chat2Gen.SelectConversationPayload,
  state: TypedState
) => {
  let selected
  if (action.type === Chat2Gen.setPendingMode) {
    selected = action.payload.pendingMode !== 'none'
  } else {
    selected = !action.payload.conversationIDKey
  }
  if (selected !== state.chat2.pendingSelected) {
    return Saga.put(Chat2Gen.createSetPendingSelected({selected}))
  }
}

function* downloadAttachment(fileName: string, conversationIDKey: any, message: any, ordinal: any) {
  // Start downloading
  let lastRatioSent = 0
  const downloadFileRpc = new EngineRpc.EngineRpcCall(
    {
      'chat.1.chatUi.chatAttachmentDownloadDone': EngineRpc.passthroughResponseSaga,
      'chat.1.chatUi.chatAttachmentDownloadProgress': function*({bytesComplete, bytesTotal}) {
        const ratio = bytesComplete / bytesTotal
        // Don't spam ourselves with updates
        if (ratio - lastRatioSent > 0.05) {
          lastRatioSent = ratio
          yield Saga.put(
            Chat2Gen.createAttachmentLoading({conversationIDKey, isPreview: false, ordinal, ratio})
          )
        }
        return EngineRpc.rpcResult()
      },
      'chat.1.chatUi.chatAttachmentDownloadStart': EngineRpc.passthroughResponseSaga,
    },
    RPCChatTypes.localDownloadFileAttachmentLocalRpcChannelMap,
    fileName,
    {
      conversationID: Types.keyToConversationID(conversationIDKey),
      filename: fileName,
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      messageID: message.id,
    }
  )
  const result = yield Saga.call(downloadFileRpc.run)
  if (EngineRpc.isFinished(result)) {
    yield Saga.put(Chat2Gen.createAttachmentDownloaded({conversationIDKey, ordinal, path: fileName}))
  }
}

// Download an attachment to your device
function* attachmentDownload(action: Chat2Gen.AttachmentDownloadPayload) {
  const {conversationIDKey, forShare, ordinal} = action.payload
  if (forShare) {
    // We are sharing an attachment on mobile,
    // the reducer handles setting the appropriate
    // flags in this case
    // TODO DESKTOP-6562 refactor this logic
    return
  }
  const state: TypedState = yield Saga.select()
  let message = Constants.getMessageMap(state, conversationIDKey).get(ordinal)

  if (!message || message.type !== 'attachment') {
    throw new Error('Trying to download missing / incorrect message?')
  }

  // already downloaded?
  if (message.downloadPath) {
    logger.warn('Attachment already downloaded')
    return
  }

  // Download it
  const destPath = yield Saga.call(downloadFilePath, message.fileName)
  yield Saga.call(downloadAttachment, destPath, conversationIDKey, message, ordinal)
}

// Upload an attachment
function* attachmentUpload(action: Chat2Gen.AttachmentUploadPayload) {
  const {conversationIDKey, path, title} = action.payload
  const state: TypedState = yield Saga.select()

  const outboxID = Constants.generateOutboxID()

  // Sending to pending
  if (!conversationIDKey) {
    if (state.chat2.pendingConversationUsers.isEmpty()) {
      logger.warn('Sending to pending w/ no pending?')
      return
    }
    const you = state.config.username
    if (!you) {
      logger.warn('Sending to pending while logged out?')
      return
    }

    yield Saga.sequentially([
      Saga.put(
        Chat2Gen.createMessagesAdd({
          context: {type: 'sent'},
          messages: [
            Constants.makePendingAttachmentMessage(
              state,
              conversationIDKey,
              Constants.pathToAttachmentType(path),
              title,
              path, // store path here for retry
              Types.stringToOutboxID(outboxID.toString('hex') || '')
            ),
          ],
        })
      ),
      Saga.put(
        Chat2Gen.createSendToPendingConversation({
          sendingAction: action,
          users: state.chat2.pendingConversationUsers.concat([you]).toArray(),
        })
      ),
    ])
    return
  }

  // Make the preview
  const preview: ?RPCChatTypes.MakePreviewRes = yield Saga.call(
    RPCChatTypes.localMakePreviewRpcPromise,
    ({
      attachment: {filename: path},
      outputDir: tmpDir(),
    }: RPCChatTypes.LocalMakePreviewRpcParam)
  )

  const meta = state.chat2.metaMap.get(conversationIDKey)
  if (!meta) {
    logger.warn('Missing meta for attachment upload', conversationIDKey)
    return
  }

  const attachmentType = Constants.pathToAttachmentType(path)
  const message = Constants.makePendingAttachmentMessage(
    state,
    conversationIDKey,
    attachmentType,
    title,
    (preview && preview.filename) || '',
    Types.stringToOutboxID(outboxID.toString('hex') || '') // never null but makes flow happy
  )
  const ordinal = message.ordinal
  yield Saga.put(
    Chat2Gen.createMessagesAdd({
      context: {type: 'sent'},
      messages: [message],
    })
  )
  yield Saga.put(Chat2Gen.createAttachmentUploading({conversationIDKey, ordinal, ratio: 0.01}))

  let lastRatioSent = 0
  const postAttachment = new EngineRpc.EngineRpcCall(
    {
      'chat.1.chatUi.chatAttachmentPreviewUploadDone': EngineRpc.passthroughResponseSaga,
      'chat.1.chatUi.chatAttachmentPreviewUploadStart': function*(metadata) {
        const ratio = 0
        yield Saga.put(Chat2Gen.createAttachmentUploading({conversationIDKey, ordinal, ratio}))
        return EngineRpc.rpcResult()
      },
      'chat.1.chatUi.chatAttachmentUploadDone': EngineRpc.passthroughResponseSaga,
      'chat.1.chatUi.chatAttachmentUploadOutboxID': EngineRpc.passthroughResponseSaga,
      'chat.1.chatUi.chatAttachmentUploadProgress': function*({bytesComplete, bytesTotal}) {
        const ratio = bytesComplete / bytesTotal
        // Don't spam ourselves with updates
        if (ordinal && ratio - lastRatioSent > 0.05) {
          lastRatioSent = ratio
          yield Saga.put(Chat2Gen.createAttachmentUploading({conversationIDKey, ordinal, ratio}))
        }
        return EngineRpc.rpcResult()
      },
      'chat.1.chatUi.chatAttachmentUploadStart': function*(metadata) {
        const ratio = 0
        yield Saga.put(Chat2Gen.createAttachmentUploading({conversationIDKey, ordinal, ratio}))
        return EngineRpc.rpcResult()
      },
    },
    RPCChatTypes.localPostFileAttachmentLocalRpcChannelMap,
    `localPostFileAttachmentLocal-${conversationIDKey}-${path}`,
    {
      attachment: {filename: path},
      conversationID: Types.keyToConversationID(conversationIDKey),
      identifyBehavior: getIdentifyBehavior(state, conversationIDKey),
      metadata: null,
      outboxID,
      title,
      tlfName: meta.tlfname,
      visibility: RPCTypes.commonTLFVisibility.private,
    }
  )

  try {
    const result = yield Saga.call(postAttachment.run)
    if (EngineRpc.isFinished(result)) {
      if (result.error) {
        // TODO better error
        logger.warn('Upload Attachment Failed')
      } else if (ordinal) {
        yield Saga.put(Chat2Gen.createAttachmentUploaded({conversationIDKey, ordinal}))
      }
    } else {
      logger.warn('Upload Attachment Failed')
    }
  } catch (_) {
    logger.warn('Upload Attachment Failed')
  }
}

// Tell service we're typing
const sendTyping = (action: Chat2Gen.SendTypingPayload) => {
  const {conversationIDKey, typing} = action.payload
  return Saga.call(RPCChatTypes.localUpdateTypingRpcPromise, {
    conversationID: Types.keyToConversationID(conversationIDKey),
    typing,
  })
}

// Implicit teams w/ reset users we can invite them back in or chat w/o them
const resetChatWithoutThem = (action: Chat2Gen.ResetChatWithoutThemPayload, state: TypedState) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  // remove all bad people
  const goodParticipants = meta.participants.subtract(meta.resetParticipants)
  return Saga.put(
    Chat2Gen.createStartConversation({
      participants: goodParticipants.toArray(),
    })
  )
}

// let them back in after they reset
const resetLetThemIn = (action: Chat2Gen.ResetLetThemInPayload) =>
  Saga.call(RPCChatTypes.localAddTeamMemberAfterResetRpcPromise, {
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
    username: action.payload.username,
  })

const markThreadAsRead = (
  action:
    | Chat2Gen.SelectConversationPayload
    | Chat2Gen.MessagesAddPayload
    | Chat2Gen.MarkInitiallyLoadedThreadAsReadPayload
    | AppGen.ChangedFocusPayload
    | NavigateActions,
  state: TypedState
) => {
  const conversationIDKey = Constants.getSelectedConversation(state)

  if (!conversationIDKey) {
    logger.info('marking read bail on no selected conversation')
    return
  }

  if (!state.chat2.metaMap.get(conversationIDKey)) {
    logger.info('marking read bail on not in meta list. preview?')
    return
  }

  if (action.type === Chat2Gen.markInitiallyLoadedThreadAsRead) {
    if (action.payload.conversationIDKey !== conversationIDKey) {
      logger.info('marking read bail on not looking at this thread anymore?')
      return
    }
  }

  if (!Constants.isUserActivelyLookingAtThisThread(state, conversationIDKey)) {
    logger.info('marking read bail on not looking at this thread')
    return
  }

  let message
  const mmap = state.chat2.messageMap.get(conversationIDKey)
  if (mmap) {
    const ordinals = Constants.getMessageOrdinals(state, conversationIDKey)
    const ordinal = ordinals.findLast(o => {
      const m = mmap.get(o)
      return m && !!m.id
    })
    message = mmap.get(ordinal)
  }

  if (!message) {
    logger.info('marking read bail on no messages')
    return
  }

  logger.info(`marking read messages ${conversationIDKey} ${message.id}`)
  return Saga.call(RPCChatTypes.localMarkAsReadLocalRpcPromise, {
    conversationID: Types.keyToConversationID(conversationIDKey),
    msgID: message.id,
  })
}

// Delete a message and any older
const deleteMessageHistory = (action: Chat2Gen.MessageDeletePayload, state: TypedState) => {
  const {conversationIDKey, ordinal} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  const message = Constants.getMessageMap(state, conversationIDKey).get(ordinal)
  if (!message) {
    throw new Error('Deleting message history with no message?')
  }

  if (!meta.tlfname) {
    logger.warn('Deleting message history for non-existent TLF:')
    return
  }

  const param: RPCChatTypes.LocalPostDeleteHistoryThroughRpcParam = {
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    through: message.id,
    tlfName: meta.tlfname,
    tlfPublic: false,
  }
  return Saga.call(RPCChatTypes.localPostDeleteHistoryThroughRpcPromise, param)
}

// Get the rights a user has on certain actions in a team
const loadCanUserPerform = (action: Chat2Gen.SelectConversationPayload, state: TypedState) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getMeta(state, conversationIDKey)
  const teamname = meta.teamname
  if (!teamname) {
    return
  }
  if (!hasCanPerform(state, teamname)) {
    return Saga.put(TeamsGen.createGetTeamOperations({teamname}))
  }
}

// Helpers to nav you to the right place
const navigateToInbox = (action: Chat2Gen.NavigateToInboxPayload | Chat2Gen.LeaveConversationPayload) => {
  if (action.type === Chat2Gen.leaveConversation && action.payload.dontNavigateToInbox) {
    return
  }
  return Saga.put(Route.navigateTo([{props: {}, selected: chatTab}, {props: {}, selected: null}]))
}
const navigateToThread = (_: any, state: TypedState) => {
  if (state.chat2.selectedConversation) {
    return Saga.put(
      Route.navigateTo(
        isMobile ? [chatTab, 'conversation'] : [{props: {}, selected: chatTab}, {props: {}, selected: null}]
      )
    )
  }
}

const mobileClearSelectedConversation = (_: any, state: TypedState) => {
  const routePath = getPath(state.routeTree.routeState)
  const inboxSelected = routePath.size === 1 && routePath.get(0) === chatTab
  if (inboxSelected) {
    return Saga.put(
      Chat2Gen.createSelectConversation({
        conversationIDKey: Types.stringToConversationIDKey(''),
        reason: 'clearSelected',
      })
    )
  }
}

// Native share sheet for attachments
function* messageAttachmentNativeShare(action: Chat2Gen.MessageAttachmentNativeSharePayload) {
  const {conversationIDKey, ordinal} = action.payload
  let state: TypedState = yield Saga.select()
  let message = Constants.getMessageMap(state, conversationIDKey).get(ordinal)
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  yield Saga.sequentially([
    Saga.put(Chat2Gen.createAttachmentDownload({conversationIDKey, ordinal, forShare: true})),
    Saga.call(downloadAndShowShareActionSheet, message.fileURL, message.fileType),
    Saga.put(Chat2Gen.createAttachmentDownloaded({conversationIDKey, ordinal, forShare: true})),
  ])
}

// Native save to camera roll
function* messageAttachmentNativeSave(action: Chat2Gen.MessageAttachmentNativeSavePayload) {
  const {conversationIDKey, ordinal} = action.payload
  let state: TypedState = yield Saga.select()
  let message = Constants.getMessageMap(state, conversationIDKey).get(ordinal)
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  try {
    logger.info('Trying to save chat attachment to camera roll')
    yield Saga.call(saveAttachmentToCameraRoll, message.fileURL, message.fileType)
  } catch (err) {
    logger.error('Failed to save attachment: ' + err)
    throw new Error('Failed to save attachment: ' + err)
  }
}

const joinConversation = (action: Chat2Gen.JoinConversationPayload) =>
  Saga.call(RPCChatTypes.localJoinConversationByIDLocalRpcPromise, {
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
  })

const leaveConversation = (action: Chat2Gen.LeaveConversationPayload) =>
  Saga.call(RPCChatTypes.localLeaveConversationLocalRpcPromise, {
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
  })

const muteConversation = (action: Chat2Gen.MuteConversationPayload) =>
  Saga.call(RPCChatTypes.localSetConversationStatusLocalRpcPromise, {
    conversationID: Types.keyToConversationID(action.payload.conversationIDKey),
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    status: action.payload.muted
      ? RPCChatTypes.commonConversationStatus.muted
      : RPCChatTypes.commonConversationStatus.unfiled,
  })

const updateNotificationSettings = (action: Chat2Gen.UpdateNotificationSettingsPayload) =>
  Saga.call(RPCChatTypes.localSetAppNotificationSettingsLocalRpcPromise, {
    channelWide: action.payload.notificationsGlobalIgnoreMentions,
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
    settings: [
      {
        deviceType: RPCTypes.commonDeviceType.desktop,
        enabled: action.payload.notificationsDesktop === 'onWhenAtMentioned',
        kind: RPCChatTypes.commonNotificationKind.atmention,
      },
      {
        deviceType: RPCTypes.commonDeviceType.desktop,
        enabled: action.payload.notificationsDesktop === 'onAnyActivity',
        kind: RPCChatTypes.commonNotificationKind.generic,
      },
      {
        deviceType: RPCTypes.commonDeviceType.mobile,
        enabled: action.payload.notificationsMobile === 'onWhenAtMentioned',
        kind: RPCChatTypes.commonNotificationKind.atmention,
      },
      {
        deviceType: RPCTypes.commonDeviceType.mobile,
        enabled: action.payload.notificationsMobile === 'onAnyActivity',
        kind: RPCChatTypes.commonNotificationKind.generic,
      },
    ],
  })

const blockConversation = (action: Chat2Gen.BlockConversationPayload) =>
  Saga.sequentially([
    Saga.put(Chat2Gen.createNavigateToInbox()),
    Saga.call(RPCChatTypes.localSetConversationStatusLocalRpcPromise, {
      conversationID: Types.keyToConversationID(action.payload.conversationIDKey),
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      status: action.payload.reportUser
        ? RPCChatTypes.commonConversationStatus.reported
        : RPCChatTypes.commonConversationStatus.blocked,
    }),
  ])

const setConvRetentionPolicy = (action: Chat2Gen.SetConvRetentionPolicyPayload) => {
  const {conversationIDKey, policy} = action.payload
  const convID = Types.keyToConversationID(conversationIDKey)
  let servicePolicy: ?RPCChatTypes.RetentionPolicy
  let ret
  try {
    servicePolicy = retentionPolicyToServiceRetentionPolicy(policy)
  } catch (err) {
    // should never happen
    logger.error(`Unable to parse retention policy: ${err.message}`)
    throw err
  } finally {
    if (servicePolicy) {
      ret = Saga.call(RPCChatTypes.localSetConvRetentionLocalRpcPromise, {
        convID,
        policy: servicePolicy,
      })
    }
  }
  return ret
}

const setConvOTRMode = (action: Chat2Gen.SetConvOTRModePayload) => {
  const {conversationIDKey, seconds} = action.payload
  const cat = Constants.otrModeGregorKey(conversationIDKey)
  const dtime = Constants.otrModeDTime()
  return Saga.call(RPCTypes.gregorInjectItemRpcPromise, {
    body: seconds.toString(),
    cat,
    dtime: {offset: 7 * 24 * 360 * 1000, time: 0},
  })
}

const setConvOTRModeSuccess = () => {}

const setConvOTRModeFailure = () => {}

function* chat2Saga(): Saga.SagaGenerator<any, any> {
  // Platform specific actions
  if (isMobile) {
    // Push us into the conversation
    yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, navigateToThread)
    yield Saga.safeTakeEvery(Chat2Gen.messageAttachmentNativeShare, messageAttachmentNativeShare)
    yield Saga.safeTakeEvery(Chat2Gen.messageAttachmentNativeSave, messageAttachmentNativeSave)
    // Unselect the conversation when we go to the inbox
    yield Saga.safeTakeEveryPure(
      a => typeof a.type === 'string' && a.type.startsWith('routeTree:'),
      mobileClearSelectedConversation
    )
  } else {
    yield Saga.safeTakeEveryPure(Chat2Gen.desktopNotification, desktopNotify)
    // Auto select the latest convo
    yield Saga.safeTakeEveryPure(
      [Chat2Gen.metasReceived, Chat2Gen.leaveConversation, Chat2Gen.metaDelete, TeamsGen.leaveTeam],
      selectTheNewestConversation
    )
  }

  // Refresh the inbox
  yield Saga.safeTakeEveryPure(Chat2Gen.inboxRefresh, inboxRefresh)
  // Load teams
  yield Saga.safeTakeEveryPure(Chat2Gen.metasReceived, requestTeamsUnboxing)
  // We've scrolled some new inbox rows into view, queue them up
  yield Saga.safeTakeEveryPure(Chat2Gen.metaNeedsUpdating, queueMetaToRequest)
  // We have some items in the queue to process
  yield Saga.safeTakeEveryPure(Chat2Gen.metaHandleQueue, requestMeta)

  // Actually try and unbox conversations
  yield Saga.safeTakeEveryPure([Chat2Gen.metaRequestTrusted, Chat2Gen.selectConversation], unboxRows)

  // Load the selected thread
  yield Saga.safeTakeEveryPure(
    [
      Chat2Gen.selectConversation,
      Chat2Gen.loadOlderMessagesDueToScroll,
      Chat2Gen.setPendingConversationUsers,
      Chat2Gen.markConversationsStale,
      Chat2Gen.metasReceived,
    ],
    loadMoreMessages,
    loadMoreMessagesSuccess
  )

  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, previewConversation)

  yield Saga.safeTakeEveryPure(Chat2Gen.messageRetry, messageRetry)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageSend, messageSend)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageEdit, messageEdit)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageEdit, clearMessageSetEditing)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageDelete, messageDelete)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageDeleteHistory, deleteMessageHistory)

  yield Saga.safeTakeEveryPure(Chat2Gen.setupChatHandlers, setupChatHandlers)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, clearInboxFilter)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, loadCanUserPerform)

  yield Saga.safeTakeEveryPure(Chat2Gen.startConversation, startConversation)
  yield Saga.safeTakeEveryPure(Chat2Gen.openFolder, openFolder)

  // On bootstrap lets load the untrusted inbox. This helps make some flows easier
  yield Saga.safeTakeEveryPure(ConfigGen.bootstrapSuccess, bootstrapSuccess)

  // Search handling
  // If you select a convo or change modes lets change selected
  yield Saga.safeTakeEveryPure([Chat2Gen.selectConversation, Chat2Gen.setPendingMode], updatePendingSelected)
  // If search is exited clean stuff up
  yield Saga.safeTakeEveryPure(Chat2Gen.exitSearch, onExitSearch)
  // Update our search items
  yield Saga.safeTakeEveryPure(
    [Chat2Gen.setPendingMode, SearchConstants.isUserInputItemsUpdated('chatSearch')],
    searchUpdated
  )

  yield Saga.safeTakeEveryPure(
    Chat2Gen.sendToPendingConversation,
    sendToPendingConversation,
    sendToPendingConversationSuccess,
    sendToPendingConversationError
  )
  yield Saga.safeTakeEveryPure(Chat2Gen.cancelPendingConversation, cancelPendingConversation)
  yield Saga.safeTakeEveryPure(Chat2Gen.retryPendingConversation, retryPendingConversation)

  yield Saga.safeTakeEvery(Chat2Gen.attachmentDownload, attachmentDownload)
  yield Saga.safeTakeEvery(Chat2Gen.attachmentUpload, attachmentUpload)

  yield Saga.safeTakeEveryPure(Chat2Gen.sendTyping, sendTyping)
  yield Saga.safeTakeEveryPure(Chat2Gen.resetChatWithoutThem, resetChatWithoutThem)
  yield Saga.safeTakeEveryPure(Chat2Gen.resetLetThemIn, resetLetThemIn)

  yield Saga.safeTakeEveryPure(
    [
      Chat2Gen.messagesAdd,
      Chat2Gen.selectConversation,
      Chat2Gen.markInitiallyLoadedThreadAsRead,
      AppGen.changedFocus,
      a => typeof a.type === 'string' && a.type.startsWith('routeTree:'),
    ],
    markThreadAsRead
  )

  yield Saga.safeTakeEveryPure([Chat2Gen.navigateToInbox, Chat2Gen.leaveConversation], navigateToInbox)
  yield Saga.safeTakeEveryPure(Chat2Gen.navigateToThread, navigateToThread)

  yield Saga.safeTakeEveryPure(Chat2Gen.joinConversation, joinConversation)
  yield Saga.safeTakeEveryPure(Chat2Gen.leaveConversation, leaveConversation)

  yield Saga.safeTakeEveryPure(Chat2Gen.muteConversation, muteConversation)
  yield Saga.safeTakeEveryPure(Chat2Gen.updateNotificationSettings, updateNotificationSettings)
  yield Saga.safeTakeEveryPure(Chat2Gen.blockConversation, blockConversation)

  yield Saga.safeTakeEveryPure(Chat2Gen.setConvRetentionPolicy, setConvRetentionPolicy)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageReplyPrivately, messageReplyPrivately)

  // OTR things
  yield Saga.safeTakeEveryPure(
    Chat2Gen.setConvOTRMode,
    setConvOTRMode,
    setConvOTRModeSuccess,
    setConvOTRModeFailure
  )
}

export default chat2Saga
