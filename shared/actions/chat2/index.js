// @flow
import * as Chat2Gen from '../chat2-gen'
import * as Constants from '../../constants/chat2'
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
import type {TypedState} from '../../constants/reducer'
import {chatTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {NotifyPopup} from '../../native/notifications'
import {showMainWindow} from '../platform-specific'

/*
 * TODO:
 * reset
 * >>>> Send tlfname and convid to send so daemon can verify its been unboxed
 */

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
        const items = result.items || []
        // We get meta
        const metas = items
          .map(item => Constants.unverifiedInboxUIItemToConversationMeta(item, username))
          .filter(Boolean)
        yield Saga.put(Chat2Gen.createMetasReceived({metas}))

        // We also get some cached messages which are trusted
        const messages = items.reduce((arr, i) => {
          if (i.localMetadata && i.localMetadata.snippetMsg) {
            const message = Constants.uiMessageToMessage(i.convID, i.localMetadata.snippetMsg)
            if (message) {
              arr.push(message)
            }
          }
          return arr
        }, [])
        if (messages.length) {
          yield Saga.put(Chat2Gen.createMessagesAdd({messages}))
        }
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
      break
    case Chat2Gen.selectConversation:
      keys = [action.payload.conversationIDKey]
      break
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // errors if we don't handle any new actions
      throw new Error('Invalid action passed to rpcMetaRequest ')
  }
  return keys.reduce((arr, key) => {
    if (key) {
      const trustedState = state.chat2.metaMap.getIn([key, 'trustedState'])
      if (trustedState !== 'requesting' && trustedState !== 'trusted') {
        arr.push(key)
      }
    }
    return arr
  }, [])
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
      if (inboxUIItem.snippetMessage) {
        const message = Constants.uiMessageToMessage(inboxUIItem.convID, inboxUIItem.snippetMessage)
        if (message) {
          yield Saga.put(Chat2Gen.createMessagesAdd({messages: [message]}))
        }
      }
    } else {
      yield Saga.put(
        Chat2Gen.createMetaReceivedError({
          conversationIDKey: inboxUIItem.convID,
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

  return Saga.call(loadInboxRpc.run, 30e3)
}

const changeMetaTrustedState = (
  action: Chat2Gen.MetaRequestTrustedPayload | Chat2Gen.MetaReceivedErrorPayload
) => {
  let newState
  let conversationIDKeys

  switch (action.type) {
    case Chat2Gen.metaRequestTrusted:
      newState = 'requesting'
      conversationIDKeys = action.payload.conversationIDKeys
      break
    case Chat2Gen.metaReceivedError:
      newState = 'error'
      conversationIDKeys = [action.payload.conversationIDKey]
      break
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // errors if we don't handle any new actions
      throw new Error('Invalid action passed to updateMetaTrustedState')
  }
  return Saga.put(
    Chat2Gen.createMetaUpdateTrustedState({
      conversationIDKeys,
      newState,
    })
  )
}

const onIncomingMessage = (incoming: RPCChatTypes.IncomingMessage) => {
  // TODO from thread-content:
  // convert outbox to regular?
  // mark as read
  const {conv, message: cMsg, convID, displayDesktopNotification} = incoming
  const actions = []

  // TODO figure out notify plumbing
  if (convID && cMsg) {
    const conversationIDKey = Constants.conversationIDToKey(convID)
    const message = Constants.uiMessageToMessage(conversationIDKey, cMsg)
    if (message) {
      // visible type
      actions.push(
        Chat2Gen.createMessagesAdd({notify: !isMobile && displayDesktopNotification, messages: [message]})
      )
    } else if (cMsg.state === RPCChatTypes.chatUiMessageUnboxedState.valid && cMsg.valid) {
      const body = cMsg.valid.messageBody
      // Types that are mutations
      switch (body.messageType) {
        case RPCChatTypes.commonMessageType.edit:
          if (body.edit) {
            const text = new HiddenString(body.edit.body || '')
            const ordinal = body.edit.messageID
            actions.push(Chat2Gen.createMessageEdit({conversationIDKey, ordinal, text}))
          }
          break
        case RPCChatTypes.commonMessageType.delete:
          if (body.delete && body.delete.messageIDs) {
            const ordinals = body.delete.messageIDs
            actions.push(Chat2Gen.createMessagesDelete({conversationIDKey, ordinals}))
          }
          break
        case RPCChatTypes.commonMessageType.attachmentuploaded:
          break // TODO
      }
    }
  }

  actions.push(chatActivityToMetasAction(conv))
  return actions
}

const chatActivityToMetasAction = payload => {
  const meta = payload && payload.conv && Constants.inboxUIItemToConversationMeta(payload.conv)
  return meta ? [Chat2Gen.createMetasReceived({metas: [meta]})] : null
}

const setupChatHandlers = () => {
  engine().setIncomingActionCreators(
    'chat.1.NotifyChat.NewChatActivity',
    ({activity}: {activity: RPCChatTypes.ChatActivity}) => {
      switch (activity.activityType) {
        case RPCChatTypes.notifyChatChatActivityType.incomingMessage:
          return activity.incomingMessage ? onIncomingMessage(activity.incomingMessage) : null
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
          return [Chat2Gen.createInboxRefresh()]
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
}

const navigateToThread = (action: Chat2Gen.SelectConversationPayload) => {
  const {conversationIDKey} = action.payload
  logger.info(`selectConversation: selecting: ${conversationIDKey || ''}`)
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
  let conversationIDKey
  let recent

  switch (action.type) {
    case Chat2Gen.selectConversation:
      conversationIDKey = action.payload.conversationIDKey
      // When a conversation is selected we want to get the newer items, if any
      recent = !conversationIDKey || Constants.getMeta(conversationIDKey).hasLoadedThread
      break
    case Chat2Gen.loadMoreMessages:
      conversationIDKey = action.payload.conversationIDKey
      recent = false
      break
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // errors if we don't handle any new actions
      throw new Error('Invalid action passed to rpcLoadThread')
  }

  if (!conversationIDKey) {
    logger.info('Load thread bail: no conversationIDKey')
    return
  }
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  if (!conversationID) {
    logger.info('Load thread bail: invalid conversationIDKey')
    return
  }

  const pivot = Constants.getMessageOrdinals(state, conversationIDKey).first()

  if (Constants.isOldestOrdinal(pivot)) {
    logger.info('Load thread bail: pivot is oldest')
    return
  }

  const num = 20 // TODO dynamic maybe, deal w/ stale // TODO more

  const onGotThread = function*({thread}) {
    if (thread) {
      const uiMessages: RPCChatTypes.UIMessages = JSON.parse(thread)

      const messages = (uiMessages.messages || [])
        .map(m => Constants.uiMessageToMessage(conversationIDKey, m))
        .filter(Boolean)

      if (messages.length) {
        yield Saga.put(Chat2Gen.createMessagesAdd({messages}))
      }
    }
    return EngineRpc.rpcResult()
  }

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

  return Saga.call(loadThreadChanMapRpc.run)
}

const rpcLoadThreadSuccess = () => {}

const clearInboxFilter = (action: Chat2Gen.SelectConversationPayload) =>
  Saga.put(Chat2Gen.createSetInboxFilter({filter: ''}))

const exitSearch = (action: Chat2Gen.SelectConversationPayload) =>
  action.payload.conversationIDKey && Saga.put(Chat2Gen.createSetSearching({searching: false}))

const desktopNotify = (action: Chat2Gen.MessagesAddPayload, state: TypedState) => {
  if (!action.payload.notify) {
    return
  }
  const conversationIDKey = Constants.getSelectedConversation(state)
  const appFocused = state.config.appFocused
  const chatTabSelected = state.routeTree.getIn(['routeState', 'selected']) === chatTab
  const metaMap = state.chat2.metaMap

  const notifys = action.payload.messages
    .filter(
      m =>
        (!appFocused || // app not foxued?
        !chatTabSelected || // not looking at the chat tab?
          m.conversationIDKey !== conversationIDKey) && // not looking at it currently?
        !metaMap.getIn([m.conversationIDKey, 'isMuted']) // ignore muted convos
    )
    .map(m => ({
      author: m.author,
      body: Constants.getSnippetText(m),
      conversationIDKey: m.conversationIDKey,
    }))
    .filter(n => n.body)

  if (notifys.length) {
    logger.info('Sending Chat notification')
    return Saga.sequentially(
      notifys.map(notify =>
        Saga.put(dispatch => {
          NotifyPopup(notify.author, {body: notify.body}, -1, notify.author, () => {
            dispatch(
              Chat2Gen.createSelectConversation({
                conversationIDKey: notify.conversationIDKey,
                fromUser: false,
              })
            )
            dispatch(Route.switchTo([chatTab]))
            showMainWindow()
          })
        })
      )
    )
  }
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
  // Mark rows as loading, unboxing, unboxed, etc
  yield Saga.safeTakeEveryPure(
    [Chat2Gen.metaRequestTrusted, Chat2Gen.metaReceivedError],
    changeMetaTrustedState
  )
  // Actually try and unbox conversations
  yield Saga.safeTakeEveryPure([Chat2Gen.metaRequestTrusted, Chat2Gen.selectConversation], rpcMetaRequest)

  // Load the selected thread
  yield Saga.safeTakeEveryPure(
    [Chat2Gen.selectConversation, Chat2Gen.loadMoreMessages],
    rpcLoadThread,
    rpcLoadThreadSuccess
  )

  yield Saga.safeTakeEveryPure(Chat2Gen.setupChatHandlers, setupChatHandlers)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, navigateToThread)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, clearInboxFilter)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, exitSearch)

  if (!isMobile) {
    yield Saga.safeTakeEveryPure(Chat2Gen.messagesAdd, desktopNotify)
  }
}

export default chat2Saga
