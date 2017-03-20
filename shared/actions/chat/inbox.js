// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import {List, Map} from 'immutable'
import {TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {call, put, select, race} from 'redux-saga/effects'
import {delay} from 'redux-saga'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {replaceEntity, deleteEntity, deleteAll} from '../entities'
import {requestIdleCallback} from '../../util/idle-callback'
import {singleFixedChannelConfig, takeFromChannelMap} from '../../util/saga'
import {usernameSelector} from '../../constants/selectors'

import type {TypedState} from '../../constants/reducer'
import type {SagaGenerator, ChannelMap} from '../../constants/types/saga'
import type {GetInboxLocalRes} from '../../constants/types/flow-types-chat'

import type {
  FinalizedState,
  MetaData,
  InboxState,
  LoadInbox,
} from '../../constants/chat'

const {
  InboxStateRecord,
  conversationIDToKey,
  keyToConversationID,
  getSelectedConversation,
} = Constants

const {
  CommonConversationStatus,
  CommonTLFVisibility,
  CommonTopicType,
  Conversation,
  LocalConversationErrorType,
  localGetInboxNonblockLocalRpcChannelMap,
} = ChatTypes

const loadedInboxActionTransformer = action => ({
  payload: {
    inbox: action.payload.inbox.map(i => {
      const {
        conversationIDKey,
        muted,
        time,
        validated,
        participants,
        info,
      } = i

      return {
        conversationIDKey,
        info: {
          status: info && info.status,
        },
        muted,
        participantsCount: participants.count(),
        time,
        validated,
      }
    }),
  },
  type: action.type,
})

function loadInbox (force?: boolean = false): LoadInbox {
  return {payload: {force}, type: 'chat:loadInbox'}
}

function _inboxToFinalized (inbox: GetInboxLocalRes): FinalizedState {
  return Map((inbox.conversationsUnverified || []).map(convoUnverified => [
    conversationIDToKey(convoUnverified.metadata.conversationID),
    convoUnverified.metadata.finalizeInfo,
  ]))
}

function _inboxToConversations (inbox: GetInboxLocalRes, author: ?string, following: {[key: string]: boolean}, metaData: MetaData): List<InboxState> {
  return List((inbox.conversationsUnverified || []).map(convoUnverified => {
    const msgMax = convoUnverified.maxMsgSummaries && convoUnverified.maxMsgSummaries.length && convoUnverified.maxMsgSummaries[0]

    if (!msgMax) {
      return null
    }

    const participants = List(parseFolderNameToUsers(author, msgMax.tlfName).map(ul => ul.username))
    const statusEnum = convoUnverified.metadata.status || 0
    const status = Constants.ConversationStatusByEnum[statusEnum]

    return new InboxStateRecord({
      conversationIDKey: conversationIDToKey(convoUnverified.metadata.conversationID),
      info: null,
      participants,
      snippet: ' ',
      status,
      time: convoUnverified.readerInfo && convoUnverified.readerInfo.mtime,
      validated: false,
    })
  }).filter(Boolean))
}

let _loadedInboxOnce = false
function * loadInboxMaybeOnce (action: LoadInbox): SagaGenerator<any, any> {
  if (!_loadedInboxOnce || action.payload.force) {
    _loadedInboxOnce = true
    yield call(loadInbox)
  }
}

function * loadInbox (): SagaGenerator<any, any> {
  const channelConfig = singleFixedChannelConfig([
    'chat.1.chatUi.chatInboxUnverified',
    'chat.1.chatUi.chatInboxConversation',
    'chat.1.chatUi.chatInboxFailed',
    'finished',
  ])

  const loadInboxChanMap: ChannelMap<any> = localGetInboxNonblockLocalRpcChannelMap(channelConfig, {
    param: {
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      query: {
        computeActiveList: true,
        readOnly: false,
        status: Object.keys(CommonConversationStatus).filter(k => !['ignored', 'blocked'].includes(k)).map(k => CommonConversationStatus[k]),
        tlfVisibility: CommonTLFVisibility.private,
        topicType: CommonTopicType.chat,
        unreadOnly: false,
      },
    },
  })

  const chatInboxUnverified = yield takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxUnverified')

  if (!chatInboxUnverified) {
    throw new Error("Can't load inbox")
  }

  const metaData = ((yield select(_metaDataSelector)): any)
  const inbox: GetInboxLocalRes = chatInboxUnverified.params.inbox
  const author = yield select(usernameSelector)
  const following = yield select(followingSelector)
  const conversations: List<InboxState> = _inboxToConversations(inbox, author, following || {}, metaData)
  const finalizedState: FinalizedState = _inboxToFinalized(inbox)

  const tlfsToUntrusted = (inbox.conversationsUnverified || []).reduce((map: {[tlf: string]: InboxEntityRecord}, c: Conversation) => {
    const msgMax = c.maxMsgSummaries && c.maxMsgSummaries.length && c.maxMsgSummaries[0]
    if (!msgMax ||
        c.metadata.visibility === ChatTypes.CommonTLFVisibility.public ||
        msgMax.tlfName.includes('#')) {
      return map
    }

    map[msgMax.tlfName] = new InboxEntityRecord({
      conversationIDKey: conversationIDToKey(c.metadata.conversationID),
      info: null,
      participants: List(parseFolderNameToUsers(author, msgMax.tlfName).map(ul => ul.username)),
      snippet: '',
      status: Constants.ConversationStatusByEnum[c.metadata.status || 0],
      time: c.readerInfo && c.readerInfo.mtime,
      validated: false,
    })

    return map
  }, {})

  yield put(({type: 'chat:setInboxTLFs', payload: {inboxTLFs: Object.keys(tlfsToUntrusted)}}: Constants.SetInboxTLFs))
  yield put(deleteAll(['chatInbox']))
  yield put(replaceEntity(['chatInbox'], tlfsToUntrusted))

  // TODO del
  yield put(({type: 'chat:loadedInbox', payload: {inbox: conversations}, logTransformer: loadedInboxActionTransformer}: Constants.LoadedInbox))
  if (finalizedState.count()) {
    yield put(({type: 'chat:updateFinalizedState', payload: {finalizedState}}: Constants.UpdateFinalizedState))
  }

  chatInboxUnverified.response.result()

  let finishedCalled = false
  while (!finishedCalled) {
    const incoming: {[key: string]: any} = yield race({
      chatInboxConversation: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxConversation'),
      chatInboxFailed: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxFailed'),
      finished: takeFromChannelMap(loadInboxChanMap, 'finished'),
      timeout: call(delay, 30000),
    })

    if (incoming.chatInboxConversation) {
      requestIdleCallback(() => {
        incoming.chatInboxConversation.response.result()
      }, {timeout: 100})

      yield call(delay, 1)
      let conversation: ?InboxState = _inboxConversationToInboxState(incoming.chatInboxConversation.params.conv, author, following || {}, metaData)

      // TODO this is ugly, ideally we should just call _updateInbox here
      const conv = incoming.chatInboxConversation.params.conv
      const supersedesState: Constants.SupersedesState = _inboxConversationLocalToSupersedesState(conv)
      const supersededByState: Constants.SupersededByState = _inboxConversationLocalToSupersededByState(conv)
      const finalizedState: Constants.FinalizedState = _conversationLocalToFinalized(conv)

      if (supersedesState.count()) {
        yield put(({type: 'chat:updateSupersedesState', payload: {supersedesState}}: Constants.UpdateSupersedesState))
      }
      if (supersededByState.count()) {
        yield put(({type: 'chat:updateSupersededByState', payload: {supersededByState}}: Constants.UpdateSupersededByState))
      }
      if (finalizedState.count()) {
        yield put(({type: 'chat:updateFinalizedState', payload: {finalizedState}}: Constants.UpdateFinalizedState))
      }

      if (conversation) {
        const tlf = incoming.chatInboxConversation.params.conv.info.tlfName
        yield put(replaceEntity(['chatInbox'], {[tlf]: conversation}))

        // TODO del
        yield put(({type: 'chat:updateInbox', payload: {conversation}}: Constants.UpdateInbox))
        const selectedConversation = yield select(getSelectedConversation)
        if (selectedConversation === conversation.get('conversationIDKey')) {
          // load validated selected
          yield put(loadMoreMessages(selectedConversation, false))
        }
      }
      // find it
    } else if (incoming.chatInboxFailed) {
      console.log('ignoring chatInboxFailed', incoming.chatInboxFailed)
      requestIdleCallback(() => {
        incoming.chatInboxFailed.response.result()
      }, {timeout: 100})

      yield call(delay, 1)
      const error = incoming.chatInboxFailed.params.error
      const conversationIDKey = conversationIDToKey(incoming.chatInboxFailed.params.convID)
      const conversation = new InboxStateRecord({
        info: null,
        isEmpty: false,
        conversationIDKey,
        participants: List([].concat(error.rekeyInfo ? error.rekeyInfo.writerNames : [], error.rekeyInfo ? error.rekeyInfo.readerNames : []).filter(Boolean)),
        status: 'unfiled',
        time: error.remoteConv.readerInfo.mtime,
        snippet: null,
        validated: true,
      })

      const entity = new InboxEntityRecord({
        conversationIDKey,
        info: null,
        isEmpty: false,
        participants: List([].concat(error.rekeyInfo ? error.rekeyInfo.writerNames : [], error.rekeyInfo ? error.rekeyInfo.readerNames : []).filter(Boolean)),
        snippet: null,
        status: 'unfiled',
        time: error.remoteConv.readerInfo.mtime,
        validated: true,
      })

      const tlf = incoming.chatInboxFailed.params.error.unverifiedTLFName
      yield put(replaceEntity(['chatInbox'], {[tlf]: entity}))

      // TODO del
      yield put(({type: 'chat:updateInbox', payload: {conversation}}: Constants.UpdateInbox))

      switch (error.typ) {
        case LocalConversationErrorType.selfrekeyneeded: {
          yield put({type: 'chat:updateInboxRekeySelf', payload: {conversationIDKey}})
          break
        }
        case LocalConversationErrorType.otherrekeyneeded: {
          const rekeyers = error.rekeyInfo.rekeyers
          yield put({type: 'chat:updateInboxRekeyOthers', payload: {conversationIDKey, rekeyers}})
          break
        }
        default:
          if (__DEV__) {
            console.warn('Inbox error:', error)
          }
      }
    } else if (incoming.finished) {
      finishedCalled = true

      const toDelSelector = (state: TypedState) => {
        const map = state.entities.get('chatInbox')
        return map.map((e, key) => e.get('validated') ? null : key).filter(Boolean)
      }
      const toDel = yield select(toDelSelector)
      yield put(deleteEntity(['chatInbox'], toDel))

      // TODO del
      yield put({type: 'chat:updateInboxComplete', payload: undefined})
      break
    } else if (incoming.timeout) {
      console.warn('Inbox loading timed out')
      yield put({type: 'chat:updateInboxComplete', payload: undefined})
      break
    }
  }
}


function * getInboxAndUnbox ({payload: {conversationIDKey}}: Constants.GetInboxAndUnbox) {
  const param: ChatTypes.localGetInboxAndUnboxLocalRpcParam = {
    identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
    query: {
      convIDs: [keyToConversationID(conversationIDKey)],
      computeActiveList: true,
      tlfVisibility: CommonTLFVisibility.private,
      topicType: CommonTopicType.chat,
      unreadOnly: false,
      readOnly: true,
    },
  }

  const result: ChatTypes.GetInboxAndUnboxLocalRes = yield call(ChatTypes.localGetInboxAndUnboxLocalRpcPromise, {param})
  const {conversations} = result
  if (conversations && conversations[0]) {
    yield call(_updateInbox, conversations[0])
    // inbox loaded so rekeyInfo is now clear
    yield put({payload: {conversationIDKey}, type: 'chat:clearRekey'})
  }
  // TODO maybe we get failures and we should update rekeyinfo? unclear...
}

export {
  getInboxAndUnbox,
  loadInbox,
  onLoadInbox,
  onLoadInboxMaybeOnce,
}
