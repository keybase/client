// @flow
import * as Chat2Gen from '../chat2-gen'
import * as SearchGen from '../search-gen'
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/chat2'
import * as SearchConstants from '../../constants/search'
import * as EngineRpc from '../../constants/engine'
import * as I from 'immutable'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Route from '../route-tree'
import * as Saga from '../../util/saga'
import * as Types from '../../constants/types/chat2'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'
import logger from '../../logger'
import type {TypedState, Dispatch} from '../../util/container'
import {chatTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {NotifyPopup} from '../../native/notifications'
import {showMainWindow} from '../platform-specific'
import {tmpDir} from '../../util/file'
import {parseFolderNameToUsers} from '../../util/kbfs'

// If we're out of date we'll only try and fill a gap of this size, otherwise we throw old messages away
const largestGapToFillOnSyncCall = 50
const numMessagesOnInitialLoad = 20
const numMessagesPerLoad = 50

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

const rpcInboxRefresh = (action: Chat2Gen.InboxRefreshPayload, state: TypedState) => {
  const username = state.config.username || ''
  const untrustedInboxRpc = new EngineRpc.EngineRpcCall(
    {
      'chat.1.chatUi.chatInboxUnverified': function*({
        inbox,
      }: RPCChatTypes.ChatUiChatInboxUnverifiedRpcParam) {
        const result: RPCChatTypes.UnverifiedInboxUIItems = JSON.parse(inbox)
        const items: Array<RPCChatTypes.UnverifiedInboxUIItem> = result.items || []
        // We get meta
        const metas = items
          .map(item => Constants.unverifiedInboxUIItemToConversationMeta(item, username))
          .filter(Boolean)
        yield Saga.put(Chat2Gen.createMetasReceived({metas}))
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
    }
  )

  return Saga.sequentially([
    Saga.put(Chat2Gen.createSetLoading({key: 'inboxRefresh', loading: true})),
    Saga.call(untrustedInboxRpc.run),
  ])
}

const rpcInboxRefreshSuccess = () =>
  Saga.put(Chat2Gen.createSetLoading({key: 'inboxRefresh', loading: false}))
const rpcInboxRefreshError = () => Saga.put(Chat2Gen.createSetLoading({key: 'inboxRefresh', loading: false}))

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
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // errors if we don't handle any new actions
      throw new Error('Invalid action passed to rpcMetaRequest ')
  }
  return Constants.getConversationIDKeyMetasToLoad(keys, state.chat2.metaMap)
}

const rpcMetaRequest = (
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
      yield Saga.put(Chat2Gen.createMetasReceived({metas: [meta]}))
    } else {
      yield Saga.put(
        Chat2Gen.createMetaReceivedError({
          conversationIDKey: Types.stringToConversationIDKey(inboxUIItem.convID),
          error: null, // just remove this item, not a real server error
          username: null,
        })
      )
    }
    return EngineRpc.rpcResult()
  }
  const onFailed = function*({convID, error}: RPCChatTypes.ChatUiChatInboxFailedRpcParam) {
    const state: TypedState = yield Saga.select()
    yield Saga.put(
      Chat2Gen.createMetaReceivedError({
        conversationIDKey: Constants.conversationIDToKey(convID),
        error,
        username: state.config.username || '',
      })
    )
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
        convIDs: conversationIDKeys.map(Constants.keyToConversationID),
      },
      skipUnverified: false,
    },
    false,
    loading => Chat2Gen.createSetLoading({key: `unboxing:${conversationIDKeys[0]}`, loading})
  )

  return Saga.sequentially([
    Saga.put(Chat2Gen.createMetaRequestingTrusted({conversationIDKeys})),
    Saga.call(loadInboxRpc.run, 30e3),
  ])
}

const onIncomingMessage = (incoming: RPCChatTypes.IncomingMessage, state: TypedState) => {
  // TODO from thread-content:
  // convert outbox to regular?
  // mark as read
  const {message: cMsg, convID, displayDesktopNotification, conv} = incoming
  const actions = []

  if (convID && cMsg) {
    const conversationIDKey = Constants.conversationIDToKey(convID)
    const message = Constants.uiMessageToMessage(conversationIDKey, cMsg)
    if (message) {
      // visible type
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
    } else if (cMsg.state === RPCChatTypes.chatUiMessageUnboxedState.valid && cMsg.valid) {
      const body = cMsg.valid.messageBody
      // Types that are mutations
      switch (body.messageType) {
        case RPCChatTypes.commonMessageType.edit:
          if (body.edit) {
            const text = new HiddenString(body.edit.body || '')
            const ordinal = Types.numberToOrdinal(body.edit.messageID)
            actions.push(Chat2Gen.createMessageWasEdited({conversationIDKey, ordinal, text}))
          }
          break
        case RPCChatTypes.commonMessageType.delete:
          if (body.delete && body.delete.messageIDs) {
            const ordinals = body.delete.messageIDs.map(Types.numberToOrdinal)
            actions.push(Chat2Gen.createMessagesWereDeleted({conversationIDKey, ordinals}))
          }
          break
        case RPCChatTypes.commonMessageType.attachmentuploaded:
          break // TODO
      }
    }
  }

  return [...actions, ...chatActivityToMetasAction(incoming)]
}

const chatActivityToMetasAction = (payload: ?{+conv?: ?RPCChatTypes.InboxUIItem}) => {
  const meta = payload && payload.conv && Constants.inboxUIItemToConversationMeta(payload.conv)
  return meta ? [Chat2Gen.createMetasReceived({metas: [meta]})] : []
}

const setupChatHandlers = () => {
  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.NewChatActivity',
    (payload: {activity: RPCChatTypes.ChatActivity}, ignore1, ignore2, getState) => {
      const activity: RPCChatTypes.ChatActivity = payload.activity
      switch (activity.activityType) {
        case RPCChatTypes.notifyChatChatActivityType.incomingMessage:
          return activity.incomingMessage ? onIncomingMessage(activity.incomingMessage, getState()) : null
        case RPCChatTypes.notifyChatChatActivityType.setStatus:
          return chatActivityToMetasAction(activity.setStatus)
        case RPCChatTypes.notifyChatChatActivityType.readMessage:
          return chatActivityToMetasAction(activity.readMessage)
        case RPCChatTypes.notifyChatChatActivityType.newConversation:
          return chatActivityToMetasAction(activity.newConversation)
        case RPCChatTypes.notifyChatChatActivityType.failedMessage:
          return null
        // TODO old code for ref
        // const failedMessage: ?RPCChatTypes.FailedMessageInfo = action.payload.activity.failedMessage
        // if (failedMessage && failedMessage.outboxRecords) {
        // for (const outboxRecord of failedMessage.outboxRecords) {
        // const conversationIDKey = Constants.conversationIDToKey(outboxRecord.convID)
        // const outboxID = outboxRecord.outboxID && Constants.outboxIDToKey(outboxRecord.outboxID)
        // const errTyp = outboxRecord.state.error.typ
        // const failureDescription = _decodeFailureDescription(errTyp)
        // const isConversationLoaded = yield Saga.select(Shared.conversationStateSelector, conversationIDKey)
        // if (!isConversationLoaded) return

        // const pendingMessage = yield Saga.select(_messageOutboxIDSelector, conversationIDKey, outboxID)
        // if (pendingMessage) {
        // yield Saga.put(
        // ChatGen.createUpdateTempMessage({
        // conversationIDKey,
        // message: {
        // ...pendingMessage,
        // failureDescription,
        // messageState: 'failed',
        // },
        // outboxIDKey: outboxID,
        // })
        // )
        // } else {
        // throw new Error("Pending message wasn't found!")
        // }
        // }
        // }
        case RPCChatTypes.notifyChatChatActivityType.membersUpdate:
          const convID = activity.membersUpdate && activity.membersUpdate.convID
          return convID
            ? [
                Chat2Gen.createMetaRequestTrusted({
                  conversationIDKeys: [Constants.conversationIDToKey(convID)],
                }),
              ]
            : null
        case RPCChatTypes.notifyChatChatActivityType.setAppNotificationSettings:
          // OLD code for refernc
          // if (action.payload.activity && action.payload.activity.setAppNotificationSettings) {
          // const {convID, settings} = action.payload.activity.setAppNotificationSettings
          // if (convID && settings) {
          // const conversationIDKey = Constants.conversationIDToKey(convID)
          // const notifications = parseNotifications(settings)
          // if (notifications) {
          // yield Saga.put(
          // ChatGen.createUpdatedNotifications({
          // conversationIDKey,
          // notifications,
          // })
          // )
          // }
          // }
          // }
          return null // TODO?
        case RPCChatTypes.notifyChatChatActivityType.teamtype:
          return [Chat2Gen.createInboxRefresh({reason: 'team type changed'})]
        default:
          break
      }
    }
  )

  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.ChatTLFFinalize',
    ({convID}: {convID: RPCChatTypes.ConversationID}) => [
      Chat2Gen.createMetaRequestTrusted({conversationIDKeys: [Constants.conversationIDToKey(convID)]}),
    ]
  )

  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.ChatInboxSynced',
    ({syncRes}: RPCChatTypes.NotifyChatChatInboxSyncedRpcParam, ignore1, ignore2, getState) => {
      const actions = [Chat2Gen.createSetLoading({key: 'inboxSyncStarted', loading: false})]
      switch (syncRes.syncType) {
        case RPCChatTypes.commonSyncInboxResType.clear:
          actions.push(Chat2Gen.createInboxRefresh({clearAllData: true, reason: 'inbox synced clear'}))
          break
        case RPCChatTypes.commonSyncInboxResType.current:
          break
        case RPCChatTypes.commonSyncInboxResType.incremental: {
          const state: TypedState = getState()
          const username = state.config.username || ''
          const items = (syncRes.incremental && syncRes.incremental.items) || []
          const metas = items.reduce((arr, i) => {
            const meta = Constants.unverifiedInboxUIItemToConversationMeta(i, username)
            if (meta) {
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
          actions.push(Chat2Gen.createInboxRefresh({reason: 'inbox synced unknown'}))
      }
      return actions
    }
  )

  engine().setIncomingActionCreators('chat.1.NotifyChat.ChatInboxSyncStarted', () => [
    Chat2Gen.createSetLoading({key: 'inboxSyncStarted', loading: true}),
  ])
}

const navigateToThread = (action: Chat2Gen.SelectConversationPayload) => {
  const {conversationIDKey} = action.payload
  logger.info(`selectConversation: selecting: ${Types.conversationIDKeyToString(conversationIDKey)}`)
  return Saga.put(Route.navigateTo([conversationIDKey].filter(Boolean), [chatTab]))
}

const loadThreadMessageTypes = Object.keys(RPCChatTypes.commonMessageType).reduce((arr, key) => {
  switch (key) {
    case 'edit': // daemon filters this out for us so we can ignore
    case 'delete':
    case 'headline':
    case 'attachmentuploaded':
      break
    default:
      arr.push(RPCChatTypes.commonMessageType[key])
      break
  }

  return arr
}, [])

const rpcLoadThread = (
  action: Chat2Gen.SelectConversationPayload | Chat2Gen.LoadMoreMessagesPayload,
  state: TypedState
) => {
  const conversationIDKey = action.payload.conversationIDKey
  if (!conversationIDKey) {
    logger.info('Load thread bail: no conversationIDKey')
    return
  }

  const conversationID = Constants.keyToConversationID(conversationIDKey)
  if (!conversationID) {
    logger.info('Load thread bail: invalid conversationIDKey')
    return
  }

  let recent // if true we're loading newer content
  let pivot // the messageid we're loading from (newer than or older than)
  let num = numMessagesPerLoad

  const ordinals = Constants.getMessageOrdinals(state, conversationIDKey)
  const actions = []
  switch (action.type) {
    case Chat2Gen.selectConversation:
      // When we just select a conversation we can be in the following states
      // 1. We have no messages at all yet (not unboxed)
      // 2. We have some messages but we never actually did an explicit load (unboxing and some streaming)
      // 3. We have some messages due to a load and want to make sure we're up to date so we ask for newer (aka you clicked and away and back again)
      // 4. We have some messages from a load and then we have a gap cause we were offline or something and got a stale. Assuming [messages...] [gap] [new item]
      const hasLoaded = Constants.getMeta(state, conversationIDKey).hasLoadedThread
      if (!hasLoaded) {
        // case 1/2
        logger.info('Load thread: case 1/2: not loaded yet')
        recent = false
        pivot = Constants.getMessageOrdinals(state, conversationIDKey).last() // get messages older than the oldest one we know about
        num = numMessagesOnInitialLoad
      } else {
        const last = ordinals.last()
        const secondToLast = ordinals.skipLast(1).last()
        // Is there a gap?
        const gap =
          last && secondToLast ? Types.ordinalToNumber(last) - Types.ordinalToNumber(secondToLast) : 0
        if (gap > 1) {
          // Case 4
          if (gap < largestGapToFillOnSyncCall) {
            // TEMP 50
            logger.info('Load thread: case 4: small gap, filling in')
            num = largestGapToFillOnSyncCall
            recent = true
            pivot = secondToLast // newer than the top of the gap
          } else {
            logger.info('Load thread: case 4: big gap, acting like not loaded yet')
            // Gap is too big, treat as Case 1/2 and clear old ordinals
            actions.push(Saga.put(Chat2Gen.createClearOrdinals({conversationIDKey})))
            recent = false
            pivot = null
          }
        } else {
          // Case 3
          logger.info('Load thread: case 3: already loaded, just load newer')
          recent = true
          pivot = last
        }
      }

      break
    case Chat2Gen.loadMoreMessages:
      recent = false // we're always going backwards in time
      pivot = Constants.getMessageOrdinals(state, conversationIDKey).first() // get newer messages than the oldest one we know about
      if (pivot && Constants.isOldestOrdinal(pivot)) {
        logger.info('Load thread bail: pivot is oldest')
        return
      }
      break
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // errors if we don't handle any new actions
      throw new Error('Invalid action passed to rpcLoadThread')
  }

  const onGotThread = function*({thread}: {thread: string}) {
    if (thread) {
      const uiMessages: RPCChatTypes.UIMessages = JSON.parse(thread)

      const messages = (uiMessages.messages || []).reduce((arr, m) => {
        const message = conversationIDKey ? Constants.uiMessageToMessage(conversationIDKey, m) : null
        if (message) {
          arr.push(message)
        }
        return arr
      }, [])

      if (messages.length) {
        yield Saga.put(
          Chat2Gen.createMessagesAdd({context: {conversationIDKey, type: 'threadLoad'}, messages})
        )
      }
    }

    return EngineRpc.rpcResult()
  }

  // Disallow fractional ordinals in pivot
  pivot = pivot ? Types.numberToOrdinal(Math.floor(Types.ordinalToNumber(pivot))) : null

  logger.info(
    `Load thread: calling rpc convo: ${conversationIDKey} pivot: ${
      pivot ? Types.ordinalToNumber(pivot) : ''
    } recent: ${recent ? 'true' : 'false'} num: ${num}`
  )
  const loadThreadChanMapRpc = new EngineRpc.EngineRpcCall(
    {
      'chat.1.chatUi.chatThreadCached': onGotThread,
      'chat.1.chatUi.chatThreadFull': onGotThread,
    },
    RPCChatTypes.localGetThreadNonblockRpcChannelMap,
    'localGetThreadNonblock',
    {
      conversationID,
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      query: {
        disableResolveSupersedes: false,
        markAsRead: true,
        messageIDControl: {
          num,
          pivot,
          recent,
        },
        messageTypes: loadThreadMessageTypes,
      },
    }
  )

  actions.push(Saga.call(loadThreadChanMapRpc.run))
  return Saga.sequentially(actions)
}

const rpcLoadThreadSuccess = () => {}

const clearInboxFilter = (action: Chat2Gen.SelectConversationPayload) =>
  Saga.put(Chat2Gen.createSetInboxFilter({filter: ''}))

const exitSearch = (action: Chat2Gen.SelectConversationPayload) =>
  action.payload.conversationIDKey && Saga.put(Chat2Gen.createExitSearch()

const desktopNotify = (action: Chat2Gen.DesktopNotificationPayload, state: TypedState) => {
  const {conversationIDKey, author, body} = action.payload
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const appFocused = state.config.appFocused
  const chatTabSelected = state.routeTree.getIn(['routeState', 'selected']) === chatTab
  const metaMap = state.chat2.metaMap

  if (
    !appFocused || // app not foxued?
    !chatTabSelected || // not looking at the chat tab?
    (conversationIDKey !== selectedConversationIDKey && // not looking at it currently?
      !metaMap.getIn([conversationIDKey, 'isMuted']))
  ) {
    // ignore muted convos
    logger.info('Sending Chat notification')
    return Saga.put((dispatch: Dispatch) => {
      NotifyPopup(author, {body}, -1, author, () => {
        dispatch(
          Chat2Gen.createSelectConversation({
            conversationIDKey,
            fromUser: false,
          })
        )
        dispatch(Route.switchTo([chatTab]))
        showMainWindow()
      })
    })
  }
}

const messageDelete = (action: Chat2Gen.MessageDeletePayload, state: TypedState) => {
  const {conversationIDKey, ordinal} = action.payload
  const message = Constants.getMessageMap(state, conversationIDKey).get(ordinal)
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

  return Saga.call(RPCChatTypes.localPostDeleteNonblockRpcPromise, {
    clientPrev: 0,
    conversationID: Constants.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    outboxID: null,
    supersedes: Types.ordinalToNumber(message.ordinal),
    tlfName: meta.tlfname,
    tlfPublic: false,
  })
}

const clearMessageSetEditing = (action: Chat2Gen.MessageEditPayload) =>
  Saga.put(
    Chat2Gen.createMessageSetEditing({
      conversationIDKey: action.payload.conversationIDKey,
      ordinal: null,
    })
  )

const messageEdit = (action: Chat2Gen.MessageEditPayload, state: TypedState) => {
  const {conversationIDKey, text, ordinal} = action.payload
  const message = Constants.getMessageMap(state, conversationIDKey).get(ordinal)
  if (!message) {
    logger.warn("Can't find message to edit", ordinal)
    return
  }

  if (message.type === 'text') {
    // Skip if the content is the same
    if (message.text.stringValue() === text) {
      return
    }

    const identifyBehavior = RPCTypes.tlfKeysTLFIdentifyBehavior.chatGuiStrict // TODO
    const meta = Constants.getMeta(state, conversationIDKey)
    const tlfName = meta.tlfname // TODO non existant convo
    const clientPrev = Constants.getClientPrev(state, conversationIDKey)
    const outboxID = Constants.generateOutboxID()
    const supersedes = message.id

    // Inject pending message and make the call
    return Saga.call(RPCChatTypes.localPostEditNonblockRpcPromise, {
      body: text.stringValue(),
      clientPrev,
      conversationID: Constants.keyToConversationID(conversationIDKey),
      identifyBehavior,
      outboxID,
      supersedes,
      tlfName,
      tlfPublic: false,
    })
  } else {
    logger.warn('Editing non-text message')
  }
}

const messageSend = (action: Chat2Gen.MessageSendPayload, state: TypedState) => {
  const {conversationIDKey, text} = action.payload
  const identifyBehavior = RPCTypes.tlfKeysTLFIdentifyBehavior.chatGuiStrict // TODO
  const meta = Constants.getMeta(state, conversationIDKey)
  const tlfName = meta.tlfname // TODO non existant convo
  const clientPrev = Constants.getClientPrev(state, conversationIDKey)
  const outboxID = Constants.generateOutboxID()

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
      conversationID: Constants.keyToConversationID(conversationIDKey),
      identifyBehavior,
      outboxID,
      tlfName,
      tlfPublic: false,
    }),
  ])
}

// First we make a preview
const attachmentPreviewCreate = (action: Chat2Gen.AttachmentSendPayload, state: TypedState) => {
  const param: RPCChatTypes.LocalMakePreviewRpcParam = {
    attachment: {filename: action.payload.filename},
    outputDir: tmpDir(),
  }
  return Saga.call(RPCChatTypes.localMakePreviewRpcPromise, param)
}

const attachmentPreviewCreateSuccess = (
  preview: RPCChatTypes.MakePreviewRes,
  action: Chat2Gen.AttachmentSendPayload
) =>
  Saga.put(
    Chat2Gen.createAttachmentWithPreviewSend({
      ...action.payload,
      preview,
    })
  )

const attachmentSend = (action: Chat2Gen.AttachmentWithPreviewSendPayload, state: TypedState) => {
  // TODO
  // const {conversationIDKey, preview, filename, title} = action.payload
  // const identifyBehavior = RPCTypes.tlfKeysTLFIdentifyBehavior.chatGuiStrict // TODO
  // const meta = Constants.getMeta(state, conversationIDKey)
  // const tlfName = meta.tlfname // TODO non existant convo
  // // TODO be able to send this
  // // const outboxID = Constants.generateOutboxID()
  // const param = {
  // attachment: {filename},
  // conversationID: Constants.keyToConversationID(conversationIDKey),
  // identifyBehavior,
  // metadata: null,
  // preview,
  // title,
  // tlfName,
  // visibility: RPCTypes.commonTLFVisibility.private,
  // }
  // export type LocalPostAttachmentLocalRpcParam = $ReadOnly<{conversationID: ConversationID, tlfName: String, visibility: Keybase1.TLFVisibility, attachment: LocalSource, preview?: ?MakePreviewRes, title: String, metadata: Bytes, identifyBehavior: Keybase1.TLFIdentifyBehavior, incomingCallMap?: IncomingCallMapType, waitingHandler?: WaitingHandlerType}>
}

const startConversation = (action: Chat2Gen.StartConversationPayload, state: TypedState) => {
  const {participants, tlf, forceImmediate} = action.payload
  const you = state.config.username || ''

  let users
  let conversationIDKey

  if (participants) {
    users = participants
  } else if (tlf) {
    const parts = tlf.split('/')
    if (parts.length >= 4) {
      const [, , type, names] = parts
      if (type === 'private' || type === 'public') {
        // allow talking to yourself, [] since we add yourself later
        users = names === you ? [you] : parseFolderNameToUsers('', names).map(u => u.username)
      } else if (type === 'team') {
        // Actually a team
        const meta = state.chat2.metaMap.find(meta => meta.teamname === names)
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

  // Is this an existing conversation?
  if (!conversationIDKey && users) {
    const toFind = I.Set(users)
    conversationIDKey = state.chat2.metaMap.findKey(meta =>
      // Ignore the order of participants
      meta.participants.toSet().equals(toFind)
    )
  }

  if (conversationIDKey) {
    return Saga.sequentially([
      Saga.put(
        Chat2Gen.createSelectConversation({
          conversationIDKey,
          fromUser: true,
        })
      ),
      Saga.put(Route.switchTo([chatTab])),
    ])
  }

  console.log('aaa TODO make convo', users || '')
  // TODO make it
}

const bootstrapSuccess = () => Saga.put(Chat2Gen.createInboxRefresh({reason: 'bootstrap'}))

const selectTheNewestConversation = (action: any, state: TypedState) => {
  // already something?
  if (state.chat2.selectedConversation) {
    return
  }

  const meta = state.chat2.metaMap
    .filter(meta => meta.teamType !== 'big')
    .sort((a, b) => b.timestamp - a.timestamp)
    .first()
  if (meta) {
    return Saga.put(
      Chat2Gen.createSelectConversation({
        conversationIDKey: meta.conversationIDKey,
      })
    )
  }
}

const onExitSearch = (_: any, state: TypedState) => {
  // const userInputItemIds = SearchConstants.getUserInputItemIds(state, {searchKey: 'chatSearch'})

  return Saga.sequentially(
    [
      Saga.put(Chat2Gen.createSetSearching({searching: false})),
      Saga.put(SearchGen.createClearSearchResults({searchKey: 'chatSearch'})),
      Saga.put(SearchGen.createSetUserInputItems({searchKey: 'chatSearch', searchResults: []})),
      // Saga.put(ChatGen.createRemoveTempPendingConversations()),
      // userInputItemIds.length === 0 && !skipSelectPreviousConversation
      // ? Saga.put(ChatGen.createSelectConversation({conversationIDKey: previousConversation}))
      // : null,
    ].filter(Boolean)
  )
}

const searchUpdated = (action: Chat2Gen.SetSearchingPayload | SearchGen.UserInputItemsUpdatedPayload, state: TypedState) => {
  if (action.type === Chat2Gen.setSearching) {
    // TODo
  }
  const {userInputItemIds} = action.payload
  const me = state.config.username
  const isSearching = state.chat2.isSearching

  if (!isSearching || !me) {
    return
  }

  return Saga.sequentially([
    Saga.put(SearchGen.createClearSearchResults({searchKey: 'chatSearch'})),
    ...(userInputItemIds.length
      ? [
          Saga.put(
            Chat2Gen.createSetPendingConversationUsers({
              users: userInputItemIds,
            })
          ),
        ]
      : [
          Saga.put(
            Chat2Gen.createSelectConversation({
              conversationIDKey: Types.stringToConversationIDKey(''),
              fromUser: true,
            })
          ),
        ]),
    Saga.put(SearchGen.createSearchSuggestions({searchKey: 'chatSearch'})),
  ])
}

function* chat2Saga(): Saga.SagaGenerator<any, any> {
  // Refresh the inbox
  yield Saga.safeTakeEveryPure(
    Chat2Gen.inboxRefresh,
    rpcInboxRefresh,
    rpcInboxRefreshSuccess,
    rpcInboxRefreshError
  )
  // Load teams
  yield Saga.safeTakeEveryPure(Chat2Gen.metasReceived, requestTeamsUnboxing)
  // We've scrolled some new inbox rows into view, queue them up
  yield Saga.safeTakeEveryPure(Chat2Gen.metaNeedsUpdating, queueMetaToRequest)
  // We have some items in the queue to process
  yield Saga.safeTakeEveryPure(Chat2Gen.metaHandleQueue, requestMeta)

  // Actually try and unbox conversations
  yield Saga.safeTakeEveryPure([Chat2Gen.metaRequestTrusted, Chat2Gen.selectConversation], rpcMetaRequest)

  // Load the selected thread
  yield Saga.safeTakeEveryPure(
    [Chat2Gen.selectConversation, Chat2Gen.loadMoreMessages],
    rpcLoadThread,
    rpcLoadThreadSuccess
  )

  yield Saga.safeTakeEveryPure(Chat2Gen.messageSend, messageSend)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageEdit, messageEdit)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageEdit, clearMessageSetEditing)
  yield Saga.safeTakeEveryPure(Chat2Gen.messageDelete, messageDelete)

  // First we make a preview, then we post it
  yield Saga.safeTakeEveryPure(
    Chat2Gen.attachmentSend,
    attachmentPreviewCreate,
    attachmentPreviewCreateSuccess
  )
  // We got the preview made so do the real upload
  yield Saga.safeTakeEveryPure(Chat2Gen.attachmentWithPreviewSend, attachmentSend)

  yield Saga.safeTakeEveryPure(Chat2Gen.setupChatHandlers, setupChatHandlers)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, navigateToThread)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, clearInboxFilter)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, exitSearch)

  yield Saga.safeTakeEveryPure(Chat2Gen.startConversation, startConversation)

  // Anything that means we should try and select
  yield Saga.safeTakeEveryPure([Chat2Gen.metasReceived], selectTheNewestConversation)

  if (!isMobile) {
    yield Saga.safeTakeEveryPure(Chat2Gen.desktopNotification, desktopNotify)
  }

  // On bootstrap lets load the untrusted inbox. This helps make some flows easier
  yield Saga.safeTakeEveryPure(ConfigGen.bootstrapSuccess, bootstrapSuccess)

  // Search handling
  yield Saga.safeTakeEveryPure(Chat2Gen.exitSearch, onExitSearch)
  yield Saga.safeTakeEveryPure([SearchConstants.isUserInputItemsUpdated('chatSearch')], searchUpdated)
}

export default chat2Saga
