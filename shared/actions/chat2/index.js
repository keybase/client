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
import {RPCTimeoutError} from '../../util/errors'
import {chatTab} from '../../constants/tabs'

const ERROR_EVERYTHING = false
ERROR_EVERYTHING && console.log('aaaa ERROR EVERYTNIG')
/*
 * TODO:
 * reset
 * empty
 * .>>>> loading state
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

function* rpcInboxRefresh(action: Chat2Gen.InboxRefreshPayload): Generator<any, void, any> {
  const loadInboxChanMap = RPCChatTypes.localGetInboxNonblockLocalRpcChannelMap(
    ['chat.1.chatUi.chatInboxUnverified', 'finished'],
    {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      maxUnbox: 0,
      query: inboxQuery,
      skipUnverified: false,
    }
  )

  const state: TypedState = yield Saga.select()
  const username = state.config.username || ''

  const incoming = yield loadInboxChanMap.race()

  if (incoming.finished) {
    if (incoming.finished.error) {
      throw new Error(`Can't load inbox ${incoming.finished.error}`)
    }
  } else if (incoming['chat.1.chatUi.chatInboxUnverified']) {
    incoming['chat.1.chatUi.chatInboxUnverified'].response.result()
    const result: RPCChatTypes.UnverifiedInboxUIItems = JSON.parse(
      incoming['chat.1.chatUi.chatInboxUnverified'].params.inbox
    )
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
  }
}

const requestTeamsUnboxing = (action: Chat2Gen.MetasReceivedPayload) => {
  const conversationIDKeys = action.payload.metas
    .filter(meta => meta.trustedState === 'untrusted' && meta.teamType === 'big' && !meta.channelname)
    .map(meta => meta.conversationIDKey)
  if (conversationIDKeys.length) {
    // TODO doens't work
    return Saga.put(
      Chat2Gen.createMetaRequestTrusted({
        conversationIDKeys,
      })
    )
  }
}

// const addMessageToConversation = (action: Chat2Gen.CreateUnboxingSuccessPayload) => {}

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

const rpcMetaRequest = (action: Chat2Gen.MetaRequestTrustedPayload | Chat2Gen.SelectConversationPayload) => {
  let conversationIDKeys
  switch (action.type) {
    case Chat2Gen.metaRequestTrusted:
      conversationIDKeys = action.payload.conversationIDKeys
      break
    case Chat2Gen.selectConversation:
      conversationIDKeys = [action.payload.conversationIDKey].filter(Boolean)
      if (!conversationIDKeys.length) return
      break
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(action: empty) // errors if we don't handle any new actions
      throw new Error('Invalid action passed to rpcMetaRequest ')
  }

  const loadInboxRpc = new EngineRpc.EngineRpcCall(
    {
      'chat.1.chatUi.chatInboxConversation': function*({
        conv,
      }: RPCChatTypes.ChatUiChatInboxConversationRpcParam) {
        // TEMP to force errors
        if (ERROR_EVERYTHING) {
          const inboxUIItem: RPCChatTypes.InboxUIItem = JSON.parse(conv)
          const meta = Constants.inboxUIItemToConversationMeta(inboxUIItem)
          if (meta) {
            const state: TypedState = yield Saga.select()
            yield Saga.put(
              // $FlowIssue TEMP
              Chat2Gen.createMetaReceivedError({
                conversationIDKey: meta.conversationIDKey,
                error: {
                  message: 'An error message',
                  rekeyInfo: {
                    readerNames: ['foo', 'bar'],
                    writerNames: meta.participants.toArray(),
                    rekeyers: meta.participants.toArray(),
                  },
                  typ: RPCChatTypes.localConversationErrorType.otherrekeyneeded, // TODO others
                  unverifiedTLFName: meta.participants.toArray().join(','),
                },
                username: state.config.username || '',
              })
            )
          }
        } else {
          const inboxUIItem: RPCChatTypes.InboxUIItem = JSON.parse(conv)
          const meta = Constants.inboxUIItemToConversationMeta(inboxUIItem)
          if (meta) {
            yield Saga.put(Chat2Gen.createMetasReceived({metas: [meta]}))
          }
          if (inboxUIItem.snippetMessage) {
            const message = Constants.uiMessageToMessage(inboxUIItem.convID, inboxUIItem.snippetMessage)
            if (message) {
              yield Saga.put(Chat2Gen.createMessagesAdd({messages: [message]}))
            }
          }
        }
        return EngineRpc.rpcResult()
      },
      'chat.1.chatUi.chatInboxFailed': function*({
        convID,
        error,
      }: RPCChatTypes.ChatUiChatInboxFailedRpcParam) {
        const state: TypedState = yield Saga.select()
        yield Saga.put(
          Chat2Gen.createMetaReceivedError({
            conversationIDKey: Constants.conversationIDToKey(convID),
            error,
            username: state.config.username || '',
          })
        )
        return EngineRpc.rpcResult()
      },
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
    }
  )

  return Saga.call(loadInboxRpc.run, 30e3)
  // if (dismissSyncing) {
  // yield Saga.put(ChatGen.createSetInboxSyncingState({inboxSyncingState: 'notSyncing'}))
  // }
}

const rpcMetaRequestError = (error: Error, action: Chat2Gen.MetaRequestTrustedPayload) => {
  if (error instanceof RPCTimeoutError) {
    logger.warn('unboxConversations: timed out request for unboxConversations, bailing')
    // yield Saga.put.resolve(
    // ChatGen.createReplaceEntity({
    // keyPath: ['inboxUntrustedState'],
    // entities: I.Map(conversationIDKeys.map(c => [c, 'untrusted'])),
    // })
    // )
  } else {
    logger.warn('unboxConversations: error in loadInboxRpc')
    logger.debug('unboxConversations: error in loadInboxRpc', error)
  }
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
  const {conv, message: cMsg, convID} = incoming
  const actions = []

  if (convID && cMsg) {
    const conversationIDKey = Constants.conversationIDToKey(convID)
    const message = Constants.uiMessageToMessage(conversationIDKey, cMsg)
    if (message) {
      // visible type
      actions.push(Chat2Gen.createMessagesAdd({messages: [message]}))
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
          return null // TODO?
        case RPCChatTypes.notifyChatChatActivityType.membersUpdate:
          return null // TODO?
        case RPCChatTypes.notifyChatChatActivityType.setAppNotificationSettings:
          return null // TODO?
        case RPCChatTypes.notifyChatChatActivityType.teamtype:
          return null // TODO?
        default:
          break
      }
    }
  )
}

const navigateToThread = (action: Chat2Gen.SelectConversationPayload) => {
  const {conversationIDKey} = action.payload
  logger.info(`selectConversation: selecting: ${conversationIDKey || ''}`)
  return Saga.put(Route.navigateTo([conversationIDKey].filter(Boolean), [chatTab]))
}

const loadThread = (action: Chat2Gen.SelectConversationPayload) => {
  // TODO
  // const {conversationIDKey} = action.payload
  // logger.info(`selectConversation: selecting: ${conversationIDKey || ''}`)
  // return Saga.put(Route.navigateTo([conversationIDKey].filter(Boolean), [chatTab]))
}

const clearInboxFilter = (action: Chat2Gen.SelectConversationPayload) =>
  Saga.put(Chat2Gen.createSetInboxFilter({filter: ''}))

function* chat2Saga(): Saga.SagaGenerator<any, any> {
  // Refresh the inbox
  yield Saga.safeTakeLatest(Chat2Gen.inboxRefresh, rpcInboxRefresh)
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
  yield Saga.safeTakeEveryPure(
    [Chat2Gen.metaRequestTrusted, Chat2Gen.selectConversation],
    rpcMetaRequest,
    () => {},
    rpcMetaRequestError
  )
  // Incoming messages, inbox updates, etc give us new messages
  // yield Saga.safeTakeEveryPure([Chat2Gen.messagesAdd], addMessagesToConversation)

  yield Saga.safeTakeEveryPure(Chat2Gen.setupChatHandlers, setupChatHandlers)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, navigateToThread)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, loadThread)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, clearInboxFilter)
}

export default chat2Saga
