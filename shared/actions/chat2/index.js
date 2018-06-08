// @flow
import * as AppGen from '../app-gen'
import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/chat2'
import * as EngineRpc from '../../constants/engine'
import * as RPCGregorTypes from '../../constants/types/rpc-gregor-gen'
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
import flags from '../../util/feature-flags'

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
      query: Constants.makeInboxQuery([]),
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
        return keys.filter(Constants.isValidConversationIDKey)
      }
      break
    case Chat2Gen.selectConversation:
      keys = [action.payload.conversationIDKey].filter(Constants.isValidConversationIDKey)
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
    const meta = Constants.inboxUIItemToConversationMeta(inboxUIItem, true)
    if (meta) {
      yield Saga.put(
        Chat2Gen.createMetasReceived({
          metas: [meta],
          neverCreate: action.type === Chat2Gen.metaRequestTrusted,
        })
      )
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
      query: Constants.makeInboxQuery(conversationIDKeys),
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
  const {message: cMsg, convID, displayDesktopNotification, desktopNotificationSnippet} = incoming
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
        if (!isMobile && displayDesktopNotification && desktopNotificationSnippet) {
          actions.push(
            Chat2Gen.createDesktopNotification({
              author: message.author,
              body: desktopNotificationSnippet,
              conversationIDKey,
            })
          )
        }
      }
    } else if (cMsg.state === RPCChatTypes.chatUiMessageUnboxedState.valid && cMsg.valid) {
      const valid = cMsg.valid
      const body = valid.messageBody
      logger.info(`Got chat incoming message of messageType: ${body.messageType}`)
      // Types that are mutations
      switch (body.messageType) {
        case RPCChatTypes.commonMessageType.edit:
          if (body.edit) {
            actions.push(
              Chat2Gen.createMessageWasEdited({
                conversationIDKey,
                ...Constants.uiMessageEditToMessage(body.edit, valid),
              })
            )
          }
          break
        case RPCChatTypes.commonMessageType.delete:
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
              Chat2Gen.createMarkConversationsStale({
                conversationIDKeys: [selectedConversation],
                updateType: RPCChatTypes.notifyChatStaleUpdateType.newactivity,
              })
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
  let actions = []
  Object.keys(RPCChatTypes.notifyChatStaleUpdateType).forEach(function(key) {
    const conversationIDKeys = (updates || []).reduce((arr, u) => {
      if (u.updateType === RPCChatTypes.notifyChatStaleUpdateType[key]) {
        arr.push(Types.conversationIDToKey(u.convID))
      }
      return arr
    }, [])
    if (conversationIDKeys.length > 0) {
      logger.info(
        `onChatThreadStale: dispatching thread reload actions for ${
          conversationIDKeys.length
        } convs of type ${key}`
      )
      actions = actions.concat([
        Chat2Gen.createMarkConversationsStale({
          conversationIDKeys,
          updateType: RPCChatTypes.notifyChatStaleUpdateType[key],
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

// Get actions to update messagemap / metamap when retention policy expunge happens
const expungeToActions = (expunge: RPCChatTypes.ExpungeInfo) => {
  const actions = []
  const meta = !!expunge.conv && Constants.inboxUIItemToConversationMeta(expunge.conv)
  if (meta) {
    actions.push(Chat2Gen.createMetasReceived({fromExpunge: true, metas: [meta]}))
  }
  const conversationIDKey = Types.conversationIDToKey(expunge.convID)
  actions.push(
    Chat2Gen.createMessagesWereDeleted({
      conversationIDKey,
      upToMessageID: expunge.expunge.upto,
    })
  )
  return actions
}

// Get actions to update messagemap / metamap when ephemeral messages expire
const ephemeralPurgeToActions = (info: RPCChatTypes.EphemeralPurgeNotifInfo) => {
  const actions = []
  const meta = !!info.conv && Constants.inboxUIItemToConversationMeta(info.conv)
  if (meta) {
    actions.push(Chat2Gen.createMetasReceived({fromEphemeralPurge: true, metas: [meta]}))
  }
  const conversationIDKey = Types.conversationIDToKey(info.convID)
  const messageIDs =
    !!info.msgs &&
    info.msgs.reduce((arr, msg) => {
      const msgID = Constants.getMessageID(msg)
      if (msgID) {
        arr.push(msgID)
      }
      return arr
    }, [])
  !!messageIDs && actions.push(Chat2Gen.createMessagesExploded({conversationIDKey, messageIDs}))
  return actions
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
          return activity.expunge ? expungeToActions(activity.expunge) : null
        case RPCChatTypes.notifyChatChatActivityType.ephemeralPurge:
          return activity.ephemeralPurge ? ephemeralPurgeToActions(activity.ephemeralPurge) : null
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

const reasonToRPCReason = (reason: string): RPCChatTypes.GetThreadNonblockReason => {
  switch (reason) {
    case 'push':
      return RPCChatTypes.localGetThreadNonblockReason.push
    case 'foregrounding':
      return RPCChatTypes.localGetThreadNonblockReason.foreground
    default:
      return RPCChatTypes.localGetThreadNonblockReason.general
  }
}

// Load new messages on a thread. We call this when you select a conversation, we get a thread-is-stale notification, or when you scroll up and want more messages
const loadMoreMessages = (
  action:
    | Chat2Gen.SelectConversationPayload
    | Chat2Gen.LoadOlderMessagesDueToScrollPayload
    | Chat2Gen.SetPendingConversationUsersPayload
    | Chat2Gen.MarkConversationsStalePayload
    | Chat2Gen.MetasReceivedPayload
    | Chat2Gen.SetPendingConversationExistingConversationIDKeyPayload,
  state: TypedState
) => {
  const numMessagesOnInitialLoad = isMobile ? 20 : 500
  const numMessagesOnScrollback = isMobile ? 100 : 500

  // Get the conversationIDKey
  let key = null
  let reason: string = ''

  switch (action.type) {
    case AppGen.changedFocus:
      if (!isMobile || !action.payload.appFocused) {
        return
      }
      key = Constants.getSelectedConversation(state)
      reason = 'foregrounding'
      break
    case Chat2Gen.setPendingConversationUsers:
      if (Constants.getSelectedConversation(state) !== Constants.pendingConversationIDKey) {
        return
      }
      reason = 'building a search'
      // we stash the actual preview conversation id key in here
      key = Constants.getResolvedPendingConversationIDKey(state)
      break
    case Chat2Gen.setPendingConversationExistingConversationIDKey:
      if (Constants.getSelectedConversation(state) !== Constants.pendingConversationIDKey) {
        // We're not looking at it so ignore
        return
      }
      reason = 'got search preview conversationidkey'
      key = Constants.getResolvedPendingConversationIDKey(state)
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

      if (key === Constants.pendingConversationIDKey) {
        key = Constants.getResolvedPendingConversationIDKey(state)
      }
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
      if (action.payload.conversationIDKey === Constants.pendingConversationIDKey) {
        key = Constants.getResolvedPendingConversationIDKey(state)
      }
      break
    default:
      key = action.payload.conversationIDKey
  }

  if (!key || !Constants.isValidConversationIDKey(key)) {
    logger.info('Load thread bail: no conversationIDKey')
    return
  }

  const conversationIDKey = key

  const conversationID = Types.keyToConversationID(conversationIDKey)
  if (!conversationID) {
    logger.info('Load thread bail: invalid conversationIDKey')
    return
  }

  let numberOfMessagesToLoad
  let isScrollingBack = false

  const meta = Constants.getMeta(state, conversationIDKey)

  if (meta.membershipType === 'youAreReset' || !meta.rekeyers.isEmpty()) {
    logger.info('Load thread bail: we are reset')
    return
  }

  if (action.type === Chat2Gen.loadOlderMessagesDueToScroll) {
    if (!state.chat2.moreToLoadMap.get(conversationIDKey)) {
      logger.info('Load thread bail: scrolling back and at the end')
      return
    }
    isScrollingBack = true
    numberOfMessagesToLoad = numMessagesOnScrollback
  } else {
    numberOfMessagesToLoad = numMessagesOnInitialLoad
  }

  let calledClear = false
  const onGotThread = function*({thread}: {thread: string}, context: 'full' | 'cached') {
    if (thread) {
      const uiMessages: RPCChatTypes.UIMessages = JSON.parse(thread)

      let shouldClearOthers = false
      if (!isScrollingBack && !calledClear) {
        shouldClearOthers = true
        calledClear = true
      }

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

      const moreToLoad = uiMessages.pagination ? !uiMessages.pagination.last : true
      yield Saga.put(Chat2Gen.createUpdateMoreToLoad({conversationIDKey, moreToLoad}))

      if (messages.length) {
        yield Saga.put(
          Chat2Gen.createMessagesAdd({
            context: {conversationIDKey, type: 'threadLoad'},
            messages,
            shouldClearOthers,
          })
        )
      }
    }

    return EngineRpc.rpcResult()
  }

  logger.info(
    `Load thread: calling rpc convo: ${conversationIDKey} num: ${numberOfMessagesToLoad} reason: ${reason}`
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
        next: isScrollingBack ? 'deadbeef' : null, // daemon treats this as a boolean essentially. string means to scroll back, null means an initial load
        num: numberOfMessagesToLoad,
      },
      query: {
        disableResolveSupersedes: false,
        markAsRead: false,
        messageTypes: loadThreadMessageTypes,
      },
      pgmode: RPCChatTypes.localGetThreadNonblockPgMode.server,
      reason: reasonToRPCReason(reason),
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

const clearInboxFilter = (
  action: Chat2Gen.SelectConversationPayload | Chat2Gen.MessageSendPayload,
  state: TypedState
) => {
  if (!state.chat2.inboxFilter) {
    return
  }

  if (
    action.type === Chat2Gen.selectConversation &&
    (action.payload.reason === 'inboxFilterArrow' || action.payload.reason === 'inboxFilterChanged')
  ) {
    return
  }

  return Saga.put(Chat2Gen.createSetInboxFilter({filter: ''}))
}

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
  const message = Constants.getMessage(state, sourceConversationIDKey, ordinal)
  if (!message) {
    logger.warn("Can't find message to reply to", ordinal)
    return
  }

  return createConversation(Chat2Gen.createCreateConversation({participants: [message.author]}), state)
}

const messageReplyPrivatelySuccess = (results: Array<any>, action: Chat2Gen.MessageReplyPrivatelyPayload) => {
  const result: RPCChatTypes.NewConversationLocalRes = results[1]
  const conversationIDKey = Types.conversationIDToKey(result.conv.info.id)
  return Saga.sequentially([
    Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'createdMessagePrivately'})),
    Saga.put(
      Chat2Gen.createMessageSetQuoting({
        ordinal: action.payload.ordinal,
        sourceConversationIDKey: action.payload.sourceConversationIDKey,
        targetConversationIDKey: conversationIDKey,
      })
    ),
  ])
}

const messageEdit = (action: Chat2Gen.MessageEditPayload, state: TypedState) => {
  const {conversationIDKey, text, ordinal} = action.payload
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
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

const messageRetry = (action: Chat2Gen.MessageRetryPayload, state: TypedState) => {
  const {outboxID} = action.payload
  return Saga.call(RPCChatTypes.localRetryPostRpcPromise, {
    outboxID: Types.outboxIDToRpcOutboxID(outboxID),
  })
}

const messageSend = (action: Chat2Gen.MessageSendPayload, state: TypedState) => {
  const {conversationIDKey, text} = action.payload
  const outboxID = Constants.generateOutboxID()
  const meta = Constants.getMeta(state, conversationIDKey)
  const tlfName = meta.tlfname
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)

  // disable sending exploding messages if flag is false
  const ephemeralLifetime = flags.explodingMessagesEnabled
    ? Constants.getConversationExplodingMode(state, conversationIDKey)
    : 0
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}

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
            Types.stringToOutboxID(outboxID.toString('hex') || ''), // never null but makes flow happy
            ephemeralLifetime
          ),
        ],
      })
    ),
    Saga.call(RPCChatTypes.localPostTextNonblockRpcPromise, {
      ...ephemeralData,
      body: text.stringValue(),
      clientPrev,
      conversationID: Types.keyToConversationID(conversationIDKey),
      identifyBehavior: getIdentifyBehavior(state, conversationIDKey),
      outboxID,
      tlfName,
      tlfPublic: false,
    }),
  ])
}

const previewConversationAfterFindExisting = (
  _fromPreviewConversation,
  action: Chat2Gen.PreviewConversationPayload | Chat2Gen.SetPendingConversationUsersPayload,
  state: TypedState
) => {
  // TODO make a sequentially that uses an object map and not all this array nonsense
  if (!_fromPreviewConversation || _fromPreviewConversation.length !== 4) {
    return
  }
  const results: ?RPCChatTypes.FindConversationsLocalRes = _fromPreviewConversation[2]
  const users: Array<string> = _fromPreviewConversation[3]

  // still looking for this result?
  if (
    // If action.type === Chat2Gen.setPendingConversationUsers, then
    // we know that fromSearch is true and participants is non-empty
    // (see previewConversationFindExisting).
    action.type === Chat2Gen.setPendingConversationUsers &&
    !Constants.getMeta(state, Constants.pendingConversationIDKey)
      .participants.toSet()
      .equals(I.Set(users))
  ) {
    console.log('Ignoring old preview find due to participant mismatch')
    return
  }

  let existingConversationIDKey

  const isTeam =
    action.type === Chat2Gen.previewConversation && (action.payload.teamname || action.payload.channelname)
  if (action.type === Chat2Gen.previewConversation && action.payload.conversationIDKey) {
    existingConversationIDKey = action.payload.conversationIDKey
  } else if (results && results.conversations && results.conversations.length > 0) {
    // Even if we find an existing conversation lets put it into the pending state so its on top always, makes the UX simpler and better to see it selected
    // and allows quoting privately to work nicely
    existingConversationIDKey = Types.conversationIDToKey(results.conversations[0].info.id)

    // If we get a conversationIDKey we don't know about (maybe an empty convo) lets treat it as not being found so we can go through the create flow
    // if it's a team avoid the flow and just preview & select the channel
    if (
      !isTeam &&
      existingConversationIDKey &&
      Constants.getMeta(state, existingConversationIDKey).conversationIDKey === Constants.noConversationIDKey
    ) {
      existingConversationIDKey = Constants.noConversationIDKey
    }
  }

  // If we're previewing a team conversation we want to actually make an rpc call and add it to the inbox
  if (isTeam) {
    if (!existingConversationIDKey || existingConversationIDKey === Constants.noConversationIDKey) {
      throw new Error('Tried to preview a non-existant channel?')
    }
    return Saga.sequentially([
      Saga.call(RPCChatTypes.localPreviewConversationByIDLocalRpcPromise, {
        convID: Types.keyToConversationID(existingConversationIDKey),
      }),
      Saga.put(
        Chat2Gen.createSelectConversation({
          conversationIDKey: existingConversationIDKey,
          reason: 'previewResolved',
        })
      ),
      Saga.put(Chat2Gen.createNavigateToThread()),
    ])
  } else {
    return Saga.sequentially([
      Saga.put(
        Chat2Gen.createSetPendingConversationExistingConversationIDKey({
          conversationIDKey: existingConversationIDKey || Constants.noConversationIDKey,
        })
      ),
      Saga.put(Chat2Gen.createSetPendingConversationUsers({fromSearch: false, users})),
      Saga.put(Chat2Gen.createNavigateToThread()),
    ])
  }
}

// Start a conversation, or select an existing one
const previewConversationFindExisting = (
  action: Chat2Gen.PreviewConversationPayload | Chat2Gen.SetPendingConversationUsersPayload,
  state: TypedState
) => {
  let participants
  let teamname
  let channelname
  let conversationIDKey
  if (action.type === Chat2Gen.previewConversation) {
    participants = action.payload.participants
    teamname = action.payload.teamname
    channelname = action.payload.channelname || 'general'
    conversationIDKey = action.payload.conversationIDKey
  } else if (action.type === Chat2Gen.setPendingConversationUsers) {
    if (!action.payload.fromSearch) {
      return
    }
    participants = action.payload.users
    if (!participants.length) {
      return Saga.put(
        Chat2Gen.createSetPendingConversationExistingConversationIDKey({
          conversationIDKey: Constants.noConversationIDKey,
        })
      )
    }
  }
  const you = state.config.username || ''

  let params
  let users
  let setUsers

  // we handled participants or teams
  if (participants) {
    const toFind = I.Set(participants).add(you)
    params = {tlfName: toFind.join(',')}
    users = I.Set(participants)
      .subtract([you])
      .toArray()
    setUsers = Saga.put(Chat2Gen.createSetPendingConversationUsers({fromSearch: false, users}))
  } else if (teamname) {
    params = {
      membersType: RPCChatTypes.commonConversationMembersType.team,
      tlfName: teamname,
      topicName: channelname,
    }
  } else if (conversationIDKey) {
    // we can skip the call if we have a conversationid already
  } else {
    throw new Error('Start conversation called w/ no participants or teamname')
  }

  const markPendingWaiting = Saga.put(
    Chat2Gen.createSetPendingConversationExistingConversationIDKey({
      conversationIDKey: Constants.pendingWaitingConversationIDKey,
    })
  )

  const makeCall = conversationIDKey
    ? null
    : Saga.call(RPCChatTypes.localFindConversationsLocalRpcPromise, {
        identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.commonConversationMembersType.impteamnative,
        oneChatPerTLF: true,
        topicName: '',
        topicType: RPCChatTypes.commonTopicType.chat,
        visibility: RPCTypes.commonTLFVisibility.private,
        ...params,
      })

  const passUsersDown = Saga.identity(users)

  return Saga.sequentially([markPendingWaiting, setUsers, makeCall, passUsersDown])
}

const bootstrapSuccess = () => Saga.put(Chat2Gen.createInboxRefresh({reason: 'bootstrap'}))

const changeSelectedConversation = (
  action:
    | Chat2Gen.MetasReceivedPayload
    | Chat2Gen.LeaveConversationPayload
    | Chat2Gen.MetaDeletePayload
    | Chat2Gen.MessageSendPayload
    | Chat2Gen.SetPendingModePayload
    | Chat2Gen.AttachmentUploadPayload
    | TeamsGen.LeaveTeamPayload,
  state: TypedState
) => {
  const selected = Constants.getSelectedConversation(state)
  switch (action.type) {
    case Chat2Gen.setPendingMode: {
      if (action.payload.pendingMode !== 'none') {
        return Saga.sequentially([
          Saga.put(
            Chat2Gen.createSelectConversation({
              conversationIDKey: Constants.pendingConversationIDKey,
              reason: 'setPendingMode',
            })
          ),
          Saga.put(navigateToThreadRoute),
        ])
      } else if (isMobile) {
        return Saga.put(Chat2Gen.createNavigateToInbox())
      }
      break
    }
    case Chat2Gen.messageSend: // fallthrough
    case Chat2Gen.attachmentUpload:
      // Sent into a resolved pending conversation? Select the resolved one
      if (selected === Constants.pendingConversationIDKey) {
        const resolvedPendingConversationIDKey = Constants.getResolvedPendingConversationIDKey(state)
        if (resolvedPendingConversationIDKey !== Constants.noConversationIDKey) {
          return Saga.put(
            Chat2Gen.createSelectConversation({
              conversationIDKey: resolvedPendingConversationIDKey,
              reason: 'sendingToPending',
            })
          )
        }
      }
  }

  if (!isMobile) {
    return _maybeAutoselectNewestConversation(action, state)
  }
}

const _maybeAutoselectNewestConversation = (
  action:
    | Chat2Gen.MetasReceivedPayload
    | Chat2Gen.LeaveConversationPayload
    | Chat2Gen.MetaDeletePayload
    | Chat2Gen.MessageSendPayload
    | Chat2Gen.SetPendingModePayload
    | Chat2Gen.AttachmentUploadPayload
    | TeamsGen.LeaveTeamPayload,
  state: TypedState
) => {
  const selected = Constants.getSelectedConversation(state)
  if (action.type === Chat2Gen.metaDelete) {
    if (!action.payload.selectSomethingElse) {
      return
    }
    // only do this if we blocked the current conversation
    if (selected !== action.payload.conversationIDKey) {
      return
    }
    // only select something if we're leaving a pending conversation
  } else if (action.type === Chat2Gen.setPendingMode) {
    if (action.payload.pendingMode !== 'none') {
      return
    }
  }

  if (action.type === Chat2Gen.setPendingMode) {
    if (Constants.isValidConversationIDKey(selected)) {
      return
    }
  } else if (action.type === Chat2Gen.leaveConversation && action.payload.conversationIDKey === selected) {
    // force select a new one
  } else if (selected !== Constants.noConversationIDKey) {
    return
  }

  // If we got here we're auto selecting the newest convo
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
        conversationIDKey: Constants.noConversationIDKey,
        reason: 'clearSelected',
      })
    )
  }
}

const openFolder = (action: Chat2Gen.OpenFolderPayload, state: TypedState) => {
  const meta = Constants.getMeta(state, action.payload.conversationIDKey)
  const path =
    meta.teamType !== 'adhoc'
      ? teamFolder(meta.teamname)
      : privateFolderWithUsers(meta.participants.toArray())
  return Saga.put(KBFSGen.createOpen({path}))
}

const getRecommendations = (
  action: Chat2Gen.SelectConversationPayload | Chat2Gen.SetPendingConversationUsersPayload,
  state: TypedState
) => {
  if (
    action.type === Chat2Gen.selectConversation &&
    action.payload.conversationIDKey !== Constants.pendingConversationIDKey
  ) {
    return
  }

  const meta = Constants.getMeta(state, Constants.pendingConversationIDKey)
  if (meta.participants.isEmpty()) {
    return Saga.put(SearchGen.createSearchSuggestions({searchKey: 'chatSearch'}))
  }
}

const clearSearchResults = (action: SearchGen.UserInputItemsUpdatedPayload) =>
  Saga.put(SearchGen.createClearSearchResults({searchKey: 'chatSearch'}))

const updatePendingParticipants = (
  action: Chat2Gen.SetPendingModePayload | SearchGen.UserInputItemsUpdatedPayload,
  state: TypedState
) => {
  let users
  if (action.type === Chat2Gen.setPendingMode) {
    // Ignore the pendingMode changes other than the clear
    if (action.payload.pendingMode !== 'none') {
      return
    }
    users = []
  } else {
    users = action.payload.userInputItemIds || []
  }

  return Saga.sequentially([
    Saga.put(Chat2Gen.createSetPendingConversationUsers({fromSearch: true, users})),
    Saga.put(SearchGen.createSetUserInputItems({searchKey: 'chatSearch', searchResults: users})),
  ])
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
  let message = Constants.getMessage(state, conversationIDKey, ordinal)

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

  // disable sending exploding messages if flag is false
  const ephemeralLifetime = flags.explodingMessagesEnabled
    ? Constants.getConversationExplodingMode(state, conversationIDKey)
    : 0
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}

  const attachmentType = Constants.pathToAttachmentType(path)
  const message = Constants.makePendingAttachmentMessage(
    state,
    conversationIDKey,
    attachmentType,
    title,
    (preview && preview.filename) || '',
    Types.stringToOutboxID(outboxID.toString('hex') || ''), // never null but makes flow happy
    ephemeralLifetime
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
      ...ephemeralData,
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
  const goodParticipants = meta.participants.toSet().subtract(meta.resetParticipants)
  return Saga.put(
    Chat2Gen.createPreviewConversation({
      participants: goodParticipants.toArray(),
      reason: 'resetChatWithoutThem',
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
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
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

// Unchecked version of Chat2Gen.createNavigateToThread() --
// Saga.put() this if you want to select the pending conversation
// (which doesn't count as valid).
const navigateToThreadRoute = Route.navigateTo(
  isMobile ? [chatTab, 'conversation'] : [{props: {}, selected: chatTab}, {props: {}, selected: null}]
)

const navigateToThread = (action: Chat2Gen.NavigateToThreadPayload, state: TypedState) => {
  if (!Constants.isValidConversationIDKey(state.chat2.selectedConversation)) {
    console.log('Skip nav to thread on invalid conversation')
    return
  }
  return Saga.put(navigateToThreadRoute)
}

const mobileNavigateOnSelect = (action: Chat2Gen.SelectConversationPayload, state: TypedState) => {
  if (Constants.isValidConversationIDKey(action.payload.conversationIDKey)) {
    return Saga.put(navigateToThreadRoute)
  }
}

const mobileChangeSelection = (_: any, state: TypedState) => {
  const routePath = getPath(state.routeTree.routeState)
  const inboxSelected = routePath.size === 1 && routePath.get(0) === chatTab
  if (inboxSelected) {
    return Saga.put(
      Chat2Gen.createSelectConversation({
        conversationIDKey: Constants.noConversationIDKey,
        reason: 'clearSelected',
      })
    )
  }
}

// Native share sheet for attachments
function* mobileMessageAttachmentShare(action: Chat2Gen.MessageAttachmentNativeSharePayload) {
  const {conversationIDKey, ordinal} = action.payload
  let state: TypedState = yield Saga.select()
  let message = Constants.getMessage(state, conversationIDKey, ordinal)
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
function* mobileMessageAttachmentSave(action: Chat2Gen.MessageAttachmentNativeSavePayload) {
  const {conversationIDKey, ordinal} = action.payload
  let state: TypedState = yield Saga.select()
  let message = Constants.getMessage(state, conversationIDKey, ordinal)
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

const changePendingMode = (
  action: Chat2Gen.SelectConversationPayload | Chat2Gen.PreviewConversationPayload,
  state: TypedState
) => {
  switch (action.type) {
    case Chat2Gen.previewConversation:
      // We decided to make a team instead of start a convo, so no resolution will take place
      if (action.payload.reason === 'convertAdHoc') {
        return Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'none'}))
      }
      // We're selecting a team so we never want to show the row, we'll instead make the rpc call to add it to the inbox
      if (action.payload.teamname || action.payload.channelname) {
        return Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'none'}))
      } else {
        // Otherwise, we're starting a chat with some users.
        return Saga.put(
          Chat2Gen.createSetPendingMode({
            pendingMode: action.payload.reason === 'fromAReset' ? 'startingFromAReset' : 'fixedSetOfUsers',
          })
        )
      }
    case Chat2Gen.selectConversation: {
      if (state.chat2.pendingMode === 'none') {
        return
      }
      if (
        action.payload.conversationIDKey === Constants.pendingConversationIDKey ||
        action.payload.conversationIDKey === Constants.pendingWaitingConversationIDKey
      ) {
        return
      }

      // Selected another conversation and the pending users are empty
      const meta = Constants.getMeta(state, Constants.pendingConversationIDKey)
      if (meta.participants.isEmpty()) {
        return Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'none'}))
      }

      // Selected the resolved pending conversation? Exit pendingMode
      if (meta.conversationIDKey === action.payload.conversationIDKey) {
        return Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'none'}))
      }
    }
  }
}

const createConversation = (action: Chat2Gen.CreateConversationPayload, state: TypedState) => {
  const username = state.config.username
  if (!username) {
    throw new Error('Making a convo while logged out?')
  }
  return Saga.sequentially([
    Saga.put(Chat2Gen.createSetLoading({key: Constants.creatingLoadingKey, loading: true})),
    Saga.call(RPCChatTypes.localNewConversationLocalRpcPromise, {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      membersType: RPCChatTypes.commonConversationMembersType.impteamnative,
      tlfName: I.Set([username])
        .concat(action.payload.participants)
        .join(','),
      tlfVisibility: RPCTypes.commonTLFVisibility.private,
      topicType: RPCChatTypes.commonTopicType.chat,
    }),
    Saga.put(Chat2Gen.createSetLoading({key: Constants.creatingLoadingKey, loading: false})),
  ])
}

const createConversationSelectIt = (results: Array<any>) => {
  const result: RPCChatTypes.NewConversationLocalRes = results[1]
  const conversationIDKey = Types.conversationIDToKey(result.conv.info.id)
  if (!conversationIDKey) {
    logger.warn("Couldn't make a new conversation?")
    return
  }
  return Saga.sequentially([
    Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'justCreated'})),
    Saga.put(Chat2Gen.createSetPendingMode({pendingMode: 'none'})),
  ])
}

const setConvExplodingMode = (action: Chat2Gen.SetConvExplodingModePayload) => {
  const {conversationIDKey, seconds} = action.payload
  const actions = []
  logger.info(`Setting exploding mode for conversation ${conversationIDKey} to ${seconds}`)

  // unset a conversation exploding lock for this convo so we accept the new one
  actions.push(Saga.put(Chat2Gen.createSetExplodingModeLock({conversationIDKey, unset: true})))

  const category = Constants.explodingModeGregorKey(conversationIDKey)
  if (seconds === 0) {
    // dismiss the category so we don't leave cruft in the push state
    actions.push(Saga.call(RPCTypes.gregorDismissCategoryRpcPromise, {category}))
  } else {
    // update the category with the exploding time
    actions.push(
      Saga.call(RPCTypes.gregorUpdateCategoryRpcPromise, {
        body: seconds.toString(),
        category,
        dtime: {offset: 0, time: 0},
      })
    )
  }

  return Saga.sequentially(actions)
}

const setConvExplodingModeSuccess = (
  res: RPCGregorTypes.MsgID | void,
  action: Chat2Gen.SetConvExplodingModePayload
) => {
  const {conversationIDKey, seconds} = action.payload
  if (seconds !== 0) {
    logger.info(`Successfully set exploding mode for conversation ${conversationIDKey} to ${seconds}`)
  } else {
    logger.info(`Successfully unset exploding mode for conversation ${conversationIDKey}`)
  }
}

// don't bug the users with black bars for network errors. chat isn't going to work in general
const ignoreErrors = [
  RPCTypes.constantsStatusCode.scgenericapierror,
  RPCTypes.constantsStatusCode.scapinetworkerror,
  RPCTypes.constantsStatusCode.sctimeout,
]
const setConvExplodingModeFailure = (e, action: Chat2Gen.SetConvExplodingModePayload) => {
  const {conversationIDKey, seconds} = action.payload
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

function* handleSeeingExplodingMessages(action: Chat2Gen.HandleSeeingExplodingMessagesPayload) {
  const gregorState = yield Saga.call(RPCTypes.gregorGetStateRpcPromise)
  const seenExplodingMessages = !!gregorState.items.filter(
    i => i.item.category === Constants.seenExplodingGregorKey
  ).length
  if (seenExplodingMessages) {
    // do nothing
    return
  }
  // neither are set, inject both
  yield Saga.all([
    Saga.call(RPCTypes.gregorInjectItemRpcPromise, {
      cat: Constants.seenExplodingGregorKey,
      body: 'true',
      dtime: {time: 0, offset: 0},
    }),
    // note that we don't get a push state when this item expires,
    // it doesn't really affect things here - we can wait for the
    // next push state to stop displaying 'new' mode
    Saga.call(RPCTypes.gregorInjectItemRpcPromise, {
      cat: Constants.newExplodingGregorKey,
      body: 'true',
      dtime: {time: 0, offset: Constants.newExplodingGregorOffset},
    }),
  ])
}

function* chat2Saga(): Saga.SagaGenerator<any, any> {
  // Platform specific actions
  if (isMobile) {
    // Push us into the conversation
    yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, mobileNavigateOnSelect)
    yield Saga.safeTakeEvery(Chat2Gen.messageAttachmentNativeShare, mobileMessageAttachmentShare)
    yield Saga.safeTakeEvery(Chat2Gen.messageAttachmentNativeSave, mobileMessageAttachmentSave)
    // Unselect the conversation when we go to the inbox
    yield Saga.safeTakeEveryPure(
      a => typeof a.type === 'string' && a.type.startsWith('routeTree:'),
      mobileChangeSelection
    )
  } else {
    yield Saga.safeTakeEveryPure(Chat2Gen.desktopNotification, desktopNotify)
  }

  // Sometimes change the selection
  yield Saga.safeTakeEveryPure(
    [
      Chat2Gen.metasReceived,
      Chat2Gen.leaveConversation,
      Chat2Gen.metaDelete,
      Chat2Gen.setPendingMode,
      Chat2Gen.messageSend,
      Chat2Gen.attachmentUpload,
      TeamsGen.leaveTeam,
    ],
    changeSelectedConversation
  )
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
      Chat2Gen.setPendingConversationExistingConversationIDKey,
      Chat2Gen.loadOlderMessagesDueToScroll,
      Chat2Gen.setPendingConversationUsers,
      Chat2Gen.markConversationsStale,
      Chat2Gen.metasReceived,
      AppGen.changedFocus,
    ],
    loadMoreMessages,
    loadMoreMessagesSuccess
  )

  yield Saga.safeTakeEveryPure(Chat2Gen.messageRetry, messageRetry)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageSend, messageSend)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageEdit, messageEdit)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageEdit, clearMessageSetEditing)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageDelete, messageDelete)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageDeleteHistory, deleteMessageHistory)

  yield Saga.safeTakeEveryPure(Chat2Gen.setupChatHandlers, setupChatHandlers)
  yield Saga.safeTakeEveryPure([Chat2Gen.selectConversation, Chat2Gen.messageSend], clearInboxFilter)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, loadCanUserPerform)

  yield Saga.safeTakeEveryPure(
    [Chat2Gen.previewConversation, Chat2Gen.setPendingConversationUsers],
    previewConversationFindExisting,
    previewConversationAfterFindExisting
  )
  yield Saga.safeTakeEveryPure(Chat2Gen.openFolder, openFolder)

  // On bootstrap lets load the untrusted inbox. This helps make some flows easier
  yield Saga.safeTakeEveryPure(ConfigGen.bootstrapSuccess, bootstrapSuccess)

  // Search handling
  yield Saga.safeTakeEveryPure(
    [Chat2Gen.setPendingMode, SearchConstants.isUserInputItemsUpdated('chatSearch')],
    updatePendingParticipants
  )
  yield Saga.safeTakeEveryPure(SearchConstants.isUserInputItemsUpdated('chatSearch'), clearSearchResults)
  yield Saga.safeTakeEveryPure(
    [Chat2Gen.setPendingConversationUsers, Chat2Gen.selectConversation],
    getRecommendations
  )

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
  yield Saga.safeTakeEveryPure(
    Chat2Gen.messageReplyPrivately,
    messageReplyPrivately,
    messageReplyPrivatelySuccess
  )
  yield Saga.safeTakeEveryPure(Chat2Gen.createConversation, createConversation, createConversationSelectIt)
  yield Saga.safeTakeEveryPure([Chat2Gen.selectConversation, Chat2Gen.previewConversation], changePendingMode)

  // Exploding things
  yield Saga.safeTakeEveryPure(
    Chat2Gen.setConvExplodingMode,
    setConvExplodingMode,
    setConvExplodingModeSuccess,
    setConvExplodingModeFailure
  )
  yield Saga.safeTakeEvery(Chat2Gen.handleSeeingExplodingMessages, handleSeeingExplodingMessages)
}

export default chat2Saga
