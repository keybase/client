// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as Shared from './shared'
import {List, Map} from 'immutable'
import {TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {call, put, select, race, fork, cancelled, take} from 'redux-saga/effects'
import {chatTab} from '../../constants/tabs'
import {delay} from 'redux-saga'
import {globalError} from '../../constants/config'
import {navigateTo} from '../route-tree'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {requestIdleCallback} from '../../util/idle-callback'
// import {singleFixedChannelConfig, takeFromChannelMap, closeChannelMap} from '../../util/saga'
import {unsafeUnwrap} from '../../constants/types/more'
import {usernameSelector} from '../../constants/selectors'
import {isMobile} from '../../constants/platform'

import type {SagaGenerator/*, ChannelMap*/} from '../../constants/types/saga'

// Common props for getting the inbox
const _getInboxQuery = {
  computeActiveList: true,
  readOnly: false,
  status: Object.keys(ChatTypes.CommonConversationStatus).filter(k => !['ignored', 'blocked'].includes(k)).map(k => ChatTypes.CommonConversationStatus[k]),
  tlfVisibility: ChatTypes.CommonTLFVisibility.private,
  topicType: ChatTypes.CommonTopicType.chat,
  unreadOnly: false,
}

let _inboxUntrustedError
let _backgroundLoopTask

// Load the inbox if we haven't yet, mostly done by the UI
function * onInitialInboxLoad (): SagaGenerator<any, any> {
  const inboxUntrustedState = yield select(Shared.inboxUntrustedStateSelector)
  if (inboxUntrustedState === 'loading') {
    return
  }

  if (inboxUntrustedState === 'unloaded' || _inboxUntrustedError) {
    yield put(Creators.setInboxUntrustedState('loading'))
    _inboxUntrustedError = null
    yield put(Creators.inboxStale())
    if (!isMobile) {
      // Only allow one loop at a time
      if (!_backgroundLoopTask) {
        yield take('chat:loadedInbox')
        _backgroundLoopTask = yield fork(_backgroundUnboxLoop)
      }
    }
  }
}

// On desktop we passively unbox inbox items
function * _backgroundUnboxLoop () {
  while (true) {
    yield call(delay, 10 * 1000)
    const inboxes = yield select(state => state.chat.get('inbox'))
    const conversationIDKeys = inboxes.filter(i => i.state === 'untrusted').take(10).map(i => i.conversationIDKey).toArray()

    if (conversationIDKeys.length) {
      yield call(unboxConversations, conversationIDKeys)
    } else {
      break
    }
  }
}

// Update inboxes that have been reset
function * _updateFinalized (inbox: ChatTypes.GetInboxLocalRes) {
  const finalizedState: Constants.FinalizedState = Map((inbox.conversationsUnverified || []).reduce((map, convoUnverified) => {
    return map.set(Constants.conversationIDToKey(convoUnverified.metadata.conversationID), convoUnverified.metadata.finalizeInfo)
  }, Map()))

  if (finalizedState.count()) {
    yield put(Creators.updateFinalizedState(finalizedState))
  }
}

// Loads the untrusted inbox only
function * onInboxStale (): SagaGenerator<any, any> {
  try {
    yield put(Creators.setInboxUntrustedState('loading'))
    _inboxUntrustedError = null

    // const channelConfig = singleFixedChannelConfig(['chat.1.chatUi.chatInboxUnverified', 'finished'])
    const loadInboxChanMap = ChatTypes.localGetInboxNonblockLocalRpcChannelMap([
      'chat.1.chatUi.chatInboxUnverified',
      'finished',
    ], {
      param: {
        identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
        maxUnbox: 0,
        query: _getInboxQuery,
      },
    })

    // const chatInboxUnverified = yield takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxUnverified')
    // const incoming = yield call([loadInboxChanMap, 'race'])
    const incoming = yield loadInboxChanMap.race()
    incoming.chatInboxUnverified.response.result()

    if (!incoming.chatInboxUnverified) {
      throw new Error("Can't load inbox")
    }

    const inbox: ChatTypes.GetInboxLocalRes = incoming.chatInboxUnverified.params.inbox
    yield call(_updateFinalized, inbox)

    const author = yield select(usernameSelector)
    const conversations: List<Constants.InboxState> = List((inbox.conversationsUnverified || []).map(c => {
      if (c.metadata.visibility !== ChatTypes.CommonTLFVisibility.private) { // private chats only
        return null
      }

      const msgMax = c.maxMsgSummaries && c.maxMsgSummaries.length && c.maxMsgSummaries[0]
      if (!msgMax || msgMax.tlfName.includes('#')) { // We don't support mixed reader/writers
        return null
      }

      return new Constants.InboxStateRecord({
        conversationIDKey: Constants.conversationIDToKey(c.metadata.conversationID),
        info: null,
        participants: List(parseFolderNameToUsers(author, msgMax.tlfName).map(ul => ul.username)),
        snippet: ' ',
        state: 'untrusted',
        status: Constants.ConversationStatusByEnum[c.metadata.status || 0],
        time: c.readerInfo && c.readerInfo.mtime,
      })
    }).filter(Boolean))

    yield put(Creators.setInboxUntrustedState('loaded'))
    yield put(Creators.loadedInbox(conversations))

    const initialConversation = yield select(state => state.chat.get('initialConversation'))
    if (initialConversation) {
      yield put(Creators.setInitialConversation(null))
      yield put(navigateTo([initialConversation], [chatTab]))
    }
  } finally {
    if (yield cancelled()) {
      yield put(Creators.setInboxUntrustedState('unloaded'))
    }
  }
}

function * onGetInboxAndUnbox ({payload: {conversationIDKeys}}: Constants.GetInboxAndUnbox): SagaGenerator<any, any> {
  yield call(unboxConversations, conversationIDKeys)
}

function _toSupersedeInfo (conversationIDKey: Constants.ConversationIDKey, supersedeData: Array<ChatTypes.ConversationMetadata>): ?Constants.SupersedeInfo {
  const parsed = supersedeData
    .filter(md => md.idTriple.topicType === ChatTypes.CommonTopicType.chat && md.finalizeInfo)
    .map(md => ({
      conversationIDKey: Constants.conversationIDToKey(md.conversationID),
      finalizeInfo: unsafeUnwrap(md && md.finalizeInfo),
    }))
  return parsed.length ? parsed[0] : null
}

// Update an inbox item
function * processConversation (c: ChatTypes.ConversationLocal): SagaGenerator<any, any> {
  const conversationIDKey = Constants.conversationIDToKey(c.info.id)

  const supersedes = _toSupersedeInfo(conversationIDKey, c.supersedes || [])
  if (supersedes) {
    yield put(Creators.updateSupersedesState(Map({[conversationIDKey]: supersedes})))
  }

  const supersededBy = _toSupersedeInfo(conversationIDKey, c.supersededBy || [])
  if (supersededBy) {
    yield put(Creators.updateSupersededByState(Map({[conversationIDKey]: supersededBy})))
  }

  if (c.info.finalizeInfo) {
    yield put(Creators.updateFinalizedState(Map({[conversationIDKey]: c.info.finalizeInfo})))
  }

  const inboxState = _conversationLocalToInboxState(c)

  if (inboxState) {
    yield put(Creators.updateInbox(inboxState))

    // inbox loaded so rekeyInfo is now clear
    yield put(Creators.clearRekey(inboxState.get('conversationIDKey')))

    // Try and load messages if the updated item is the selected one
    const selectedConversation = yield select(Constants.getSelectedConversation)
    if (selectedConversation === inboxState.get('conversationIDKey')) {
      // load validated selected
      yield put(Creators.loadMoreMessages(selectedConversation, true))
    }
  }
}

// Gui is showing boxed content, find some rows to unbox
function * untrustedInboxVisible (action: Constants.UntrustedInboxVisible): SagaGenerator<any, any> {
  const {conversationIDKey, rowsVisible} = action.payload
  const inboxes = yield select(state => state.chat.get('inbox'))

  const idx = inboxes.findIndex(inbox => inbox.conversationIDKey === conversationIDKey)
  if (idx === -1) {
    return
  }

  // Collect items to unbox
  const total = rowsVisible * 2
  const conversationIDKeys = inboxes.slice(idx, idx + total).map(i => i.state === 'untrusted' ? i.conversationIDKey : null).filter(Boolean).toArray()

  if (conversationIDKeys.length) {
    yield call(unboxConversations, conversationIDKeys)
  }
}

// Loads the trusted inbox segments
function * unboxConversations (conversationIDKeys: Array<Constants.ConversationIDKey>, ttl?: number = 1): Generator<any, any, any> {
  console.log('aaa my ttl is', ttl)
  yield put(Creators.setUnboxing(conversationIDKeys))

  // const channelConfig = singleFixedChannelConfig([
    // 'chat.1.chatUi.chatInboxUnverified',
    // 'chat.1.chatUi.chatInboxConversation',
    // 'chat.1.chatUi.chatInboxFailed',
    // 'finished',
  // ])

  // const loadInboxChanMap: ChannelMap<any> = ChatTypes.localGetInboxNonblockLocalRpcChannelMap(channelConfig, {
    // param: {
      // identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      // query: {
        // ..._getInboxQuery,
        // convIDs: conversationIDKeys.map(Constants.keyToConversationID),
      // },
    // },
  // })
  const loadInboxChanMap = ChatTypes.localGetInboxNonblockLocalRpcChannelMap([
    'chat.1.chatUi.chatInboxUnverified',
    'chat.1.chatUi.chatInboxConversation',
    'chat.1.chatUi.chatInboxFailed',
    'finished',
  ], {
    param: {
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      query: {
        ..._getInboxQuery,
        convIDs: conversationIDKeys.map(Constants.keyToConversationID),
      },
    },
  })

  while (true) {
    const incoming = yield loadInboxChanMap.race({timeout: ttl})

    // const incoming = yield race(loadInboxChanMap.raceMap({timeout: ttl}))
    // const incoming: {[key: string]: any} = yield race({
      // chatInboxConversation: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxConversation'),
      // chatInboxFailed: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxFailed'),
      // chatInboxUnverified: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxUnverified'),
      // finished: takeFromChannelMap(loadInboxChanMap, 'finished'),
      // timeout: call(delay, ttl),
    // })

    // Ignore untrusted version
    if (incoming.chatInboxUnverified) {
      incoming.chatInboxUnverified.response.result()
    } else if (incoming.chatInboxConversation) {
      requestIdleCallback(() => { incoming.chatInboxConversation.response.result() }, {timeout: 100})
      yield call(delay, 1)
      yield call(processConversation, incoming.chatInboxConversation.params.conv)
      // find it
    } else if (incoming.chatInboxFailed) {
      console.log('chatInboxFailed', incoming.chatInboxFailed)
      requestIdleCallback(() => { incoming.chatInboxFailed.response.result() }, {timeout: 100})
      yield call(delay, 1)
      const error = incoming.chatInboxFailed.params.error
      const conversationIDKey = Constants.conversationIDToKey(incoming.chatInboxFailed.params.convID)

      // Valid inbox item for rekey errors only
      const conversation = new Constants.InboxStateRecord({
        conversationIDKey,
        participants: error.rekeyInfo ? List([].concat(error.rekeyInfo.writerNames, error.rekeyInfo.readerNames).filter(Boolean)) : List(error.unverifiedTLFName.split(',')),
        state: 'error',
        status: 'unfiled',
        time: error.remoteConv.readerInfo.mtime,
      })

      yield put(Creators.updateInbox(conversation))
      switch (error.typ) {
        case ChatTypes.LocalConversationErrorType.selfrekeyneeded: {
          yield put(Creators.updateInboxRekeySelf(conversationIDKey))
          break
        }
        case ChatTypes.LocalConversationErrorType.otherrekeyneeded: {
          const rekeyers = error.rekeyInfo.rekeyers
          yield put(Creators.updateInboxRekeyOthers(conversationIDKey, rekeyers))
          break
        }
        case ChatTypes.LocalConversationErrorType.transient: {
          // Just ignore these, it is a transient error
          break
        }
        default:
          yield put({
            payload: error,
            type: globalError,
          })
      }
    } else if (incoming.timeout) {
      console.warn('timed out request for unboxConversations, bailing')
      console.warn('aaaa trying again')
      // closeChannelMap(loadInboxChanMap)
      yield call(unboxConversations, conversationIDKeys, ttl * 2)
      break
    } else if (incoming.finished) {
      break
    }
  }
}

// Convert server to our data type. Make timestamps and snippets
function _conversationLocalToInboxState (c: ?ChatTypes.ConversationLocal): ?Constants.InboxState {
  if (!c ||
      c.info.visibility !== ChatTypes.CommonTLFVisibility.private || // private chats only
      c.info.tlfName.includes('#') // We don't support mixed reader/writers
      ) {
    return null
  }

  const conversationIDKey = Constants.conversationIDToKey(c.info.id)

  const toShow = List(c.maxMessages || [])
    .filter(m => m.valid && m.state === ChatTypes.LocalMessageUnboxedState.valid)
    .map((m: any) => ({body: m.valid.messageBody, time: m.valid.serverHeader.ctime}))
    .filter(m => [
      ChatTypes.CommonMessageType.attachment,
      ChatTypes.CommonMessageType.edit,
      ChatTypes.CommonMessageType.text,
    ].includes(m.body.messageType))
    .sort((a, b) => b.time - a.time)
    .map((message: {time: number, body: ?ChatTypes.MessageBody}) => ({
      snippet: Constants.makeSnippet(message.body),
      time: message.time,
    })).first() || {}

  return new Constants.InboxStateRecord({
    conversationIDKey,
    info: c.info,
    isEmpty: c.isEmpty,
    participants: List(c.info.writerNames || []),
    snippet: toShow.snippet,
    state: 'unboxed',
    status: Constants.ConversationStatusByEnum[c.info ? c.info.status : 0],
    time: toShow.time || c.readerInfo.mtime,
  })
}

export {
  onInitialInboxLoad,
  onInboxStale,
  onGetInboxAndUnbox,
  unboxConversations,
  processConversation,
  untrustedInboxVisible,
}
