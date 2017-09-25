// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as EngineRpc from '../engine/helper'
import {RPCTimeoutError} from '../../util/errors'
import {List, Map} from 'immutable'
import {
  CommonDeviceType,
  CommonTLFVisibility,
  TlfKeysTLFIdentifyBehavior,
} from '../../constants/types/flow-types'
import {call, put, select, cancelled, take, spawn} from 'redux-saga/effects'
import {chatTab} from '../../constants/tabs'
import {delay} from 'redux-saga'
import {globalError} from '../../constants/config'
import {navigateTo} from '../route-tree'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {unsafeUnwrap} from '../../constants/types/more'
import {usernameSelector} from '../../constants/selectors'
import {isMobile} from '../../constants/platform'
import HiddenString from '../../util/hidden-string'

import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

// Common props for getting the inbox
const _getInboxQuery = {
  computeActiveList: true,
  readOnly: false,
  status: Object.keys(ChatTypes.CommonConversationStatus)
    .filter(k => !['ignored', 'blocked', 'reported'].includes(k))
    .map(k => ChatTypes.CommonConversationStatus[k]),
  tlfVisibility: CommonTLFVisibility.private,
  topicType: ChatTypes.CommonTopicType.chat,
  unreadOnly: false,
}

let _backgroundLoopTask

// Load the inbox if we haven't yet, mostly done by the UI
function* onInitialInboxLoad(): SagaGenerator<any, any> {
  try {
    yield put(Creators.inboxStale())

    if (!isMobile) {
      // Only allow one loop at a time
      if (!_backgroundLoopTask) {
        yield take('chat:loadedInbox')
        // Use spawn so this is never cancelled if this is
        _backgroundLoopTask = yield spawn(_backgroundUnboxLoop)
      }
    }
  } finally {
  }
}

// On desktop we passively unbox inbox items
const _backgroundUnboxLoop = function*() {
  try {
    while (true) {
      yield call(delay, 10 * 1000)
      const inboxes = yield select(state => state.chat.get('inbox'))
      const conversationIDKeys = inboxes
        .filter(i => i.state === 'untrusted')
        .take(10)
        .map(i => i.conversationIDKey)
        .toArray()

      if (conversationIDKeys.length) {
        yield put(Creators.unboxConversations(conversationIDKeys))
      } else {
        break
      }
    }
  } finally {
    console.log('Background unboxing loop done')
  }
}

// Update inboxes that have been reset
function* _updateFinalized(inbox: ChatTypes.GetInboxLocalRes) {
  const finalizedState: Constants.FinalizedState = Map(
    (inbox.conversationsUnverified || []).filter(c => c.metadata.finalizeInfo).map(convoUnverified => [
      Constants.conversationIDToKey(convoUnverified.metadata.conversationID),
      // $FlowIssue doesn't understand this is non-null
      convoUnverified.metadata.finalizeInfo,
    ])
  )

  if (finalizedState.count()) {
    yield put(Creators.updateFinalizedState(finalizedState))
  }
}

// Loads the untrusted inbox only
function* onInboxStale(): SagaGenerator<any, any> {
  try {
    yield put(Creators.setInboxUntrustedState('loading'))

    const loadInboxChanMap = ChatTypes.localGetInboxNonblockLocalRpcChannelMap(
      ['chat.1.chatUi.chatInboxUnverified', 'finished'],
      {
        param: {
          identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
          maxUnbox: 0,
          query: _getInboxQuery,
        },
      }
    )

    const incoming = yield loadInboxChanMap.race()

    if (incoming.finished) {
      yield put(Creators.setInboxUntrustedState('loaded'))
      if (incoming.finished.error) {
        throw new Error(`Can't load inbox ${incoming.finished.error}`)
      }
      return
    }

    if (
      !incoming['chat.1.chatUi.chatInboxUnverified'] ||
      !incoming['chat.1.chatUi.chatInboxUnverified'].response
    ) {
      throw new Error("Can't load inbox")
    }
    incoming['chat.1.chatUi.chatInboxUnverified'].response.result()

    const jsonInbox: string = incoming['chat.1.chatUi.chatInboxUnverified'].params.inbox
    const inbox: ChatTypes.UnverifiedInboxUIItems = JSON.parse(jsonInbox)
    yield call(_updateFinalized, inbox)

    const author = yield select(usernameSelector)
    const conversations: List<Constants.InboxState> = List(
      (inbox.items || [])
        .map(c => {
          return new Constants.InboxStateRecord({
            channelname: c.membersType === ChatTypes.CommonConversationMembersType.team ? '-' : undefined,
            conversationIDKey: c.convID,
            info: null,
            membersType: c.membersType,
            participants: List(parseFolderNameToUsers(author, c.name).map(ul => ul.username)),
            status: Constants.ConversationStatusByEnum[c.status || 0],
            teamname: c.membersType === ChatTypes.CommonConversationMembersType.team ? c.name : undefined,
            teamType: c.teamType,
            time: c.time,
            version: c.version,
          })
        })
        .filter(Boolean)
    )

    yield put(Creators.setInboxUntrustedState('loaded'))
    yield put(Creators.loadedInbox(conversations))

    // Load the first visible simple and teams so we can get the channel names
    const toUnbox = conversations
      .filter(c => !c.teamname)
      .take(20)
      .concat(conversations.filter(c => c.teamname))

    yield put(Creators.unboxConversations(toUnbox.map(c => c.conversationIDKey).toArray()))

    const {
      initialConversation,
      launchedViaPush,
    } = yield select(({chat: {initialConversation}, config: {launchedViaPush}}: TypedState) => ({
      initialConversation,
      launchedViaPush,
    }))
    if (initialConversation) {
      yield put(Creators.setInitialConversation(null))
      if (!launchedViaPush) {
        yield put(navigateTo([initialConversation], [chatTab]))
        yield put(Creators.selectConversation(initialConversation, false))
      }
    }
  } finally {
    if (yield cancelled()) {
      yield put(Creators.setInboxUntrustedState('unloaded'))
    }
  }
}

function* onGetInboxAndUnbox({
  payload: {conversationIDKeys},
}: Constants.GetInboxAndUnbox): SagaGenerator<any, any> {
  yield put(Creators.unboxConversations(conversationIDKeys))
}

function _toSupersedeInfo(
  conversationIDKey: Constants.ConversationIDKey,
  supersedeData: Array<ChatTypes.ConversationMetadata>
): ?Constants.SupersedeInfo {
  const parsed = supersedeData
    .filter(md => md.idTriple.topicType === ChatTypes.CommonTopicType.chat && md.finalizeInfo)
    .map(md => ({
      conversationIDKey: Constants.conversationIDToKey(md.conversationID),
      finalizeInfo: unsafeUnwrap(md && md.finalizeInfo),
    }))
  return parsed.length ? parsed[0] : null
}

// Update an inbox item
function* processConversation(c: ChatTypes.InboxUIItem): SagaGenerator<any, any> {
  const conversationIDKey = c.convID

  const isBigTeam = c.teamType === ChatTypes.CommonTeamType.complex
  const isTeam = c.membersType === ChatTypes.CommonConversationMembersType.team

  if (!isTeam) {
    const supersedes = _toSupersedeInfo(conversationIDKey, c.supersedes || [])
    if (supersedes) {
      yield put(Creators.updateSupersedesState(Map({[conversationIDKey]: supersedes})))
    }

    const supersededBy = _toSupersedeInfo(conversationIDKey, c.supersededBy || [])
    if (supersededBy) {
      yield put(Creators.updateSupersededByState(Map({[conversationIDKey]: supersededBy})))
    }

    if (c.finalizeInfo) {
      yield put(Creators.updateFinalizedState(Map({[conversationIDKey]: c.finalizeInfo})))
    }
  }

  const inboxState = _conversationLocalToInboxState(c)

  if (!isBigTeam && c && c.snippet) {
    const snippet = c.snippet
    yield put(
      Creators.updateSnippet(conversationIDKey, new HiddenString(Constants.makeSnippet(snippet) || ''))
    )
  }

  if (inboxState) {
    yield put(Creators.updateInbox(inboxState))

    if (!isBigTeam) {
      // inbox loaded so rekeyInfo is now clear
      yield put(Creators.clearRekey(inboxState.get('conversationIDKey')))
    }

    // Try and load messages if the updated item is the selected one
    const selectedConversation = yield select(Constants.getSelectedConversation)
    if (selectedConversation === inboxState.get('conversationIDKey')) {
      // load validated selected
      yield put(Creators.loadMoreMessages(selectedConversation, true))
    }
  }
}

// Gui is showing boxed content, find some rows to unbox
function* untrustedInboxVisible(action: Constants.UntrustedInboxVisible): SagaGenerator<any, any> {
  const {conversationIDKey, rowsVisible} = action.payload
  const inboxes = yield select(state => state.chat.get('inbox'))

  const idx = inboxes.findIndex(inbox => inbox.conversationIDKey === conversationIDKey)
  if (idx === -1) {
    return
  }

  // Collect items to unbox, sanity max at 40
  const total = Math.max(rowsVisible + 2, 40)
  const conversationIDKeys = inboxes
    .slice(idx, idx + total)
    .map(i => (i.state === 'untrusted' ? i.conversationIDKey : null))
    .filter(Boolean)
    .toArray()

  if (conversationIDKeys.length) {
    yield put(Creators.unboxConversations(conversationIDKeys))
  }
}

const _chatInboxToProcess = []

function* _chatInboxConversationSubSaga({conv}) {
  _chatInboxToProcess.push(conv)
  yield put(Creators.unboxMore())
  return EngineRpc.rpcResult()
}

function* unboxMore(): SagaGenerator<any, any> {
  if (!_chatInboxToProcess.length) {
    return
  }

  // the most recent thing you asked for is likely what you want
  // (aka scrolling)
  const conv = _chatInboxToProcess.pop()
  yield spawn(processConversation, conv)

  if (_chatInboxToProcess.length) {
    yield call(delay, 100)
    yield put(Creators.unboxMore())
  }
}

function* _chatInboxFailedSubSaga(params) {
  const {convID, error} = params
  console.log('chatInboxFailed', params)
  const conversationIDKey = Constants.conversationIDToKey(convID)

  // Valid inbox item for rekey errors only
  const conversation = new Constants.InboxStateRecord({
    conversationIDKey,
    participants: error.rekeyInfo
      ? List([].concat(error.rekeyInfo.writerNames, error.rekeyInfo.readerNames).filter(Boolean))
      : List(error.unverifiedTLFName.split(',')),
    state: 'error',
    status: 'unfiled',
    time: error.remoteConv.readerInfo.mtime,
  })

  yield put(Creators.updateSnippet(conversationIDKey, new HiddenString(error.message)))
  yield put(Creators.updateInbox(conversation))

  // Mark the conversation as read, to avoid a state where there's a
  // badged conversation that can't be unbadged by clicking on it.
  const {maxMsgid} = error.remoteConv.readerInfo
  const selectedConversation = yield select(Constants.getSelectedConversation)
  if (maxMsgid && selectedConversation === conversationIDKey) {
    try {
      yield call(ChatTypes.localMarkAsReadLocalRpcPromise, {
        param: {
          conversationID: convID,
          msgID: maxMsgid,
        },
      })
    } catch (err) {
      console.log(`Couldn't mark as read ${conversationIDKey} ${err}`)
    }
  }

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
    case ChatTypes.LocalConversationErrorType.permanent: {
      // Let's show it as failed in the inbox
      break
    }
    default:
      yield put({
        payload: error,
        type: globalError,
      })
  }

  return EngineRpc.rpcResult()
}

const unboxConversationsSagaMap = {
  'chat.1.chatUi.chatInboxConversation': _chatInboxConversationSubSaga,
  'chat.1.chatUi.chatInboxFailed': _chatInboxFailedSubSaga,
  'chat.1.chatUi.chatInboxUnverified': EngineRpc.passthroughResponseSaga,
}

// Loads the trusted inbox segments
function* unboxConversations(action: Constants.UnboxConversations): SagaGenerator<any, any> {
  let {conversationIDKeys, force} = action.payload
  conversationIDKeys = yield select(
    (state: TypedState, conversationIDKeys: Array<Constants.ConversationIDKey>) => {
      const inbox = state.chat.get('inbox')

      return conversationIDKeys.filter(c => {
        if (Constants.isPendingConversationIDKey(c)) {
          return false
        }

        const state = inbox.find(i => i.get('conversationIDKey') === c)
        return force || !state || state.state === 'untrusted'
      })
    },
    conversationIDKeys
  )

  if (!conversationIDKeys.length) {
    return
  }

  yield put.resolve(Creators.setUnboxing(conversationIDKeys, false))

  const loadInboxRpc = new EngineRpc.EngineRpcCall(
    unboxConversationsSagaMap,
    ChatTypes.localGetInboxNonblockLocalRpcChannelMap,
    'unboxConversations',
    {
      param: {
        identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
        query: {
          ..._getInboxQuery,
          convIDs: conversationIDKeys.map(Constants.keyToConversationID),
        },
      },
    }
  )

  try {
    yield call(loadInboxRpc.run, 30e3)
  } catch (error) {
    if (error instanceof RPCTimeoutError) {
      console.warn('timed out request for unboxConversations, bailing')
      yield put.resolve(Creators.setUnboxing(conversationIDKeys, true))
    } else {
      console.warn('Error in loadInboxRpc', error)
    }
  }
}

const parseNotifications = (
  notifications: ChatTypes.ConversationNotificationInfo
): ?Constants.NotificationsState => {
  if (!notifications || !notifications.settings) {
    return null
  }
  const {settings} = notifications
  return {
    channelWide: notifications.channelWide,
    desktop: {
      atmention: settings[CommonDeviceType.desktop.toString()][
        ChatTypes.CommonNotificationKind.atmention.toString()
      ],
      generic: settings[CommonDeviceType.desktop.toString()][
        ChatTypes.CommonNotificationKind.generic.toString()
      ],
    },
    mobile: {
      atmention: settings[CommonDeviceType.mobile.toString()][
        ChatTypes.CommonNotificationKind.atmention.toString()
      ],
      generic: settings[CommonDeviceType.mobile.toString()][
        ChatTypes.CommonNotificationKind.generic.toString()
      ],
    },
  }
}

// Convert server to our data type
function _conversationLocalToInboxState(c: ?ChatTypes.InboxUIItem): ?Constants.InboxState {
  if (
    !c ||
    c.visibility !== CommonTLFVisibility.private || // private chats only
    c.name.includes('#') // We don't support mixed reader/writers
  ) {
    return null
  }

  const conversationIDKey = c.convID

  let parts = List(c.participants || [])
  let teamname = null
  let channelname = null

  if (c.membersType === ChatTypes.CommonConversationMembersType.team) {
    teamname = c.name
    channelname = c.channel
  }

  const notifications = c.notifications && parseNotifications(c.notifications)

  return new Constants.InboxStateRecord({
    channelname,
    conversationIDKey,
    isEmpty: c.isEmpty,
    membersType: c.membersType,
    name: c.name,
    notifications,
    participants: parts,
    state: 'unboxed',
    status: Constants.ConversationStatusByEnum[c.status],
    teamname,
    teamType: c.teamType,
    time: c.time,
    visibility: c.visibility,
    version: c.version,
  })
}

export {
  onInitialInboxLoad,
  onInboxStale,
  onGetInboxAndUnbox,
  parseNotifications,
  unboxConversations,
  processConversation,
  untrustedInboxVisible,
  unboxMore,
}
