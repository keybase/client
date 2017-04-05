// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as Shared from './shared'
import {List, Map} from 'immutable'
import {TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {call, put, select, race, fork} from 'redux-saga/effects'
import {chatTab} from '../../constants/tabs'
import {delay} from 'redux-saga'
import {navigateTo} from '../route-tree'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {requestIdleCallback} from '../../util/idle-callback'
import {singleFixedChannelConfig, takeFromChannelMap} from '../../util/saga'
import {unsafeUnwrap} from '../../constants/types/more'
import {usernameSelector} from '../../constants/selectors'
import {isMobile} from '../../constants/platform'

import type {SagaGenerator, ChannelMap} from '../../constants/types/saga'

// Common props for getting the inbox
const _getInboxQuery = {
  computeActiveList: true,
  readOnly: false,
  status: Object.keys(ChatTypes.CommonConversationStatus).filter(k => !['ignored', 'blocked'].includes(k)).map(k => ChatTypes.CommonConversationStatus[k]),
  tlfVisibility: ChatTypes.CommonTLFVisibility.private,
  topicType: ChatTypes.CommonTopicType.chat,
  unreadOnly: false,
}

let _inboxUntrustedError = null

// Load the inbox if we haven't yet, mostly done by the UI
function * onInitialInboxLoad (action: Constants.LoadInbox): SagaGenerator<any, any> {
  const inboxUntrustedState = yield select(Shared.inboxUntrustedStateSelector)
  if (inboxUntrustedState === 'loading') {
    return
  }

  const {force} = action.payload
  if (inboxUntrustedState === 'unloaded' || _inboxUntrustedError || force) {
    yield put({payload: {inboxUntrustedState: 'loading'}, type: 'chat:inboxUntrustedState'})
    _inboxUntrustedError = null
    yield call(onInboxStale)
    if (!isMobile) {
      yield fork(_backgroundUnboxLoop)
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
  const finalizedState: Constants.FinalizedState = Map((inbox.conversationsUnverified || []).map(convoUnverified => [
    Constants.conversationIDToKey(convoUnverified.metadata.conversationID),
    convoUnverified.metadata.finalizeInfo,
  ]))

  if (finalizedState.count()) {
    yield put(Creators.updateFinalizedState(finalizedState))
  }
}

// Loads the untrusted inbox only
function * onInboxStale (): SagaGenerator<any, any> {
  yield put({payload: {inboxUntrustedState: 'loading'}, type: 'chat:inboxUntrustedState'})
  _inboxUntrustedError = null

  const channelConfig = singleFixedChannelConfig(['chat.1.chatUi.chatInboxUnverified', 'finished'])
  const loadInboxChanMap: ChannelMap<any> = ChatTypes.localGetInboxNonblockLocalRpcChannelMap(channelConfig, {
    param: {
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      maxUnbox: 0,
      query: _getInboxQuery,
    },
  })

  const chatInboxUnverified = yield takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxUnverified')

  if (!chatInboxUnverified) {
    throw new Error("Can't load inbox")
  }

  const inbox: ChatTypes.GetInboxLocalRes = chatInboxUnverified.params.inbox
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

  yield put({payload: {inboxUntrustedState: 'loaded'}, type: 'chat:inboxUntrustedState'})
  yield put(Creators.loadedInbox(conversations))
  chatInboxUnverified.response.result()

  const initialConversation = yield select(state => state.chat.get('initialConversation'))
  if (initialConversation) {
    yield put(Creators.setInitialConversation(null))
    yield put(navigateTo([initialConversation], [chatTab]))
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
function * unboxConversations (conversationIDKeys: Array<Constants.ConversationIDKey>): Generator<any, any, any> {
  yield put(Creators.setUnboxing(conversationIDKeys))

  const channelConfig = singleFixedChannelConfig([
    'chat.1.chatUi.chatInboxUnverified',
    'chat.1.chatUi.chatInboxConversation',
    'chat.1.chatUi.chatInboxFailed',
    'finished',
  ])

  const loadInboxChanMap: ChannelMap<any> = ChatTypes.localGetInboxNonblockLocalRpcChannelMap(channelConfig, {
    param: {
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      query: {
        ..._getInboxQuery,
        convIDs: conversationIDKeys.map(Constants.keyToConversationID),
      },
    },
  })

  while (true) {
    const incoming: {[key: string]: any} = yield race({
      chatInboxConversation: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxConversation'),
      chatInboxFailed: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxFailed'),
      chatInboxUnverified: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxUnverified'),
      finished: takeFromChannelMap(loadInboxChanMap, 'finished'),
      timeout: call(delay, 30000),
    })

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
        participants: List([].concat(error.rekeyInfo ? error.rekeyInfo.writerNames : [], error.rekeyInfo ? error.rekeyInfo.readerNames : []).filter(Boolean)),
        state: 'error',
        status: 'unfiled',
        time: error.remoteConv.readerInfo.mtime,
      })

      switch (error.typ) {
        case ChatTypes.LocalConversationErrorType.selfrekeyneeded: {
          yield put(Creators.updateInbox(conversation))
          yield put(Creators.updateInboxRekeySelf(conversationIDKey))
          break
        }
        case ChatTypes.LocalConversationErrorType.otherrekeyneeded: {
          yield put(Creators.updateInbox(conversation))
          const rekeyers = error.rekeyInfo.rekeyers
          yield put(Creators.updateInboxRekeyOthers(conversationIDKey, rekeyers))
          break
        }
        default:
          if (__DEV__) {
            console.warn('Inbox error:', error)
          }
      }
    } else if (incoming.finished || incoming.timeout) {
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
  let time = c.readerInfo.mtime
  let snippet

  (c.maxMessages || []).some(message => {
    if (message.state === ChatTypes.LocalMessageUnboxedState.valid && message.valid) {
      time = message.valid.serverHeader.ctime || time
      snippet = Constants.makeSnippet(message.valid.messageBody)
      return !!snippet
    }
    return false
  })

  return new Constants.InboxStateRecord({
    conversationIDKey,
    info: c.info,
    isEmpty: c.isEmpty,
    participants: List(c.info.writerNames || []),
    snippet,
    state: 'unboxed',
    status: Constants.ConversationStatusByEnum[c.info ? c.info.status : 0],
    time,
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
