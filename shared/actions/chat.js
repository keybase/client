// @flow
import * as Constants from '../constants/chat'
import _ from 'lodash'
import {call, put, select} from 'redux-saga/effects'
import {conversationIDToKey} from '../constants/chat'
import {localGetInboxLocalRpcPromise, CommonMessageType} from '../constants/types/flow-types-chat'
import {takeLatest} from 'redux-saga'

import type {LoadMoreMessages, ConversationID, SelectConversation, LoadInbox, Message} from '../constants/chat'
import type {MessageUnboxed} from '../constants/types/flow-types-chat'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

function loadInbox (): LoadInbox {
  return {type: Constants.loadInbox, payload: undefined}
}

function loadMoreMessages (): LoadMoreMessages {
  return {type: Constants.loadMoreMessages, payload: undefined}
}

function selectConversation (conversationID: ConversationID): SelectConversation {
  return {type: Constants.selectConversation, payload: {conversationID}}
}

function * _loadInbox (): SagaGenerator<any, any> {
  // const inbox = yield call(localGetInboxAndUnboxLocalRpcPromise, {params: {}}) // Not working, mike is looking
  const inbox = yield call(localGetInboxLocalRpcPromise, {params: {}})
  console.log('aaaa got inbox', inbox)

  // TEMP Just select the most recent conversation
  const selector = (state: TypedState) => state.chat.get('selectedConversation')
  const selectedConversation = yield select(selector)

  if (!selectedConversation) {
    if (inbox && inbox.conversationsUnverified.length) {
      const mostRecentConversation = inbox.conversationsUnverified[0]
      yield put(selectConversation(conversationIDToKey(mostRecentConversation.metadata.conversationID)))
    }
  }

  // yield put(loadedInbox()) // TODO real payload
}

let _fakeMessageID = 100000
let _fakeTime = Date.now() - 60 * 60 * 24

function fakeGetThreadLocalCall (num, last) {
  return {
    thread: {
      messages: _.range(0, num).map(i => {
        _fakeMessageID--
        _fakeTime -= 10
        return {
          state: 1,
          valid: {
            clientHeader: {
              tlfName: 'chris,chrisnojima',
              tlfPublic: false,
              messageType: 1,
              supersedes: null,
              prev: null,
            },
            serverHeader: {
              messageID: _fakeMessageID,
              supersededBy: '0',
              ctime: _fakeTime,
            },
            messageBody: {
              messageType: 1,
              text: `${_fakeMessageID}`,
            },
            senderUsername: _.sample(['chris', 'chrisnojima']), // TODO
            senderDeviceName: 'chris computer',
            headerHash: i,
          },
        }
      }).reverse(),
      pagination: {
        next: 0,
        previous: 0,
        num,
        last,
      },
    },
  }
}

function * _loadMoreMessages (): SagaGenerator<any, any> {
  // TODO need chat api conversation id change to string. core is working on it
  const selectedSelector = (state: TypedState) => state.chat.get('selectedConversation')
  const conversationID = yield select(selectedSelector)

  if (!conversationID) {
    return
  }

  const yourNameSelector = (state: TypedState) => state.config.username
  const yourName = yield select(yourNameSelector)

  // running into trouble with this due to identify failures due to dns problems
  // const thread = yield call(localGetThreadLocalRpcPromise, {param: {conversationID}})
  const thread = fakeGetThreadLocalCall(50, false)
  // console.log('aaaa got thread', thread)

  const messages = thread.thread.messages.map((message, idx) => _threadToStorable(message, idx, yourName))
  yield put({type: Constants.prependMessages, payload: {conversationID, messages}})
}

function _threadToStorable (message: MessageUnboxed, idx: number, yourName): Message {
  if (message.state === 1) {
    const payload = message.valid
    if (payload) {
      const common = {
        author: payload.senderUsername,
        timestamp: payload.serverHeader.ctime,
        messageID: payload.serverHeader.messageID,
      }

      const isYou = common.author === yourName

      switch (payload.messageBody.messageType) {
        case CommonMessageType.text:
          // $FlowIssue dunno
          return {
            ...common,
            type: 'Text',
            message: payload.messageBody.text,
            followState: isYou ? 'you' : 'following', // TODO get this
          }
        default:
          return {
            ...common,
            type: 'Unhandled',
          }
      }
    }
  }
  return {
    type: 'Error', // TODO
    messageID: idx,
    reason: 'temp',
  }
}

function * _selectConversation (action: SelectConversation): SagaGenerator<any, any> {
  yield put(loadMoreMessages())
}

function * chatSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.loadInbox, _loadInbox),
    takeLatest(Constants.loadMoreMessages, _loadMoreMessages),
    takeLatest(Constants.selectConversation, _selectConversation),
  ]
}

export default chatSaga

export {
  loadInbox,
  loadMoreMessages,
  selectConversation,
}
