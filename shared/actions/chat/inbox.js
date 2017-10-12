// @flow
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as EngineRpc from '../engine/helper'
import * as EntityCreators from '../entities'
import * as Shared from './shared'
import {RPCTimeoutError} from '../../util/errors'
import * as I from 'immutable'
import {
  CommonDeviceType,
  CommonTLFVisibility,
  TlfKeysTLFIdentifyBehavior,
} from '../../constants/types/flow-types'
import {call, put, select, cancelled, spawn, all} from 'redux-saga/effects'
import {delay} from 'redux-saga'
import {globalError} from '../../constants/config'
import {unsafeUnwrap} from '../../constants/types/more'
import {usernameSelector} from '../../constants/selectors'
import HiddenString from '../../util/hidden-string'

import type {SagaGenerator} from '../../constants/types/saga'

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

// Update inboxes that have been reset
function* _updateFinalized(inbox: ChatTypes.GetInboxLocalRes) {
  const finalizedState: Constants.FinalizedState = I.Map(
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
          skipUnverified: false,
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

    const idToVersion = I.Map(
      (inbox.items || []).reduce((map, c) => {
        map[c.convID] = c.version
        return map
      }, {})
    )

    const author = yield select(usernameSelector)
    const snippets = (inbox.items || []).reduce((map, c) => {
      const snippet = c.localMetadata ? c.localMetadata.snippet : ''
      map[c.convID] = new HiddenString(Constants.makeSnippet(snippet) || '')
      return map
    }, {})

    const oldInbox = yield select(s => s.entities.get('inbox'))
    const conversations = Shared.makeInboxStateRecords(author, inbox.items || [], oldInbox)
    yield put(EntityCreators.replaceEntity(['convIDToSnippet'], I.Map(snippets)))
    yield put(Creators.setInboxUntrustedState('loaded'))
    yield put(
      EntityCreators.replaceEntity(
        ['inbox'],
        I.Map(
          conversations.reduce((map, c) => {
            map[c.conversationIDKey] = c
            return map
          }, {})
        )
      )
    )

    const inboxSmallTimestamps = I.Map(
      conversations.reduce((map, c) => {
        if (c.teamType !== ChatTypes.CommonTeamType.complex) {
          map[c.conversationIDKey] = c.time
        }
        return map
      }, {})
    )
    const inboxBigChannelsToTeam = I.Map(
      conversations.reduce((map, c) => {
        if (c.teamType === ChatTypes.CommonTeamType.complex) {
          map[c.conversationIDKey] = c.teamname
        }
        return map
      }, {})
    )
    const inboxBigChannels = I.Map(
      conversations.reduce((map, c) => {
        if (c.teamType === ChatTypes.CommonTeamType.complex && c.channelname) {
          map[c.conversationIDKey] = c.channelname
        }
        return map
      }, {})
    )
    const inboxMap = I.Map(
      conversations.reduce((map, c) => {
        map[c.conversationIDKey] = c
        return map
      }, {})
    )
    const inboxIsEmpty = I.Map(
      conversations.reduce((map, c) => {
        map[c.conversationIDKey] = c.isEmpty
        return map
      }, {})
    )

    yield all([
      put(EntityCreators.replaceEntity(['inboxVersion'], idToVersion)),
      put(EntityCreators.replaceEntity(['inboxSmallTimestamps'], inboxSmallTimestamps)),
      put(EntityCreators.mergeEntity(['inboxBigChannels'], inboxBigChannels)), // keep old names if we have them
      put(EntityCreators.replaceEntity(['inboxBigChannelsToTeam'], inboxBigChannelsToTeam)),
      put(EntityCreators.replaceEntity(['inboxIsEmpty'], inboxIsEmpty)),
      put(EntityCreators.replaceEntity(['inbox'], inboxMap)),
    ])

    // Load the first visible simple and teams so we can get the channel names
    const toUnbox = conversations
      .filter(c => !c.teamname)
      .slice(0, 20)
      .concat(conversations.filter(c => c.teamname))
      .map(c => c.conversationIDKey)

    yield put(Creators.unboxConversations(toUnbox))
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
      yield put(Creators.updateSupersedesState(I.Map({[conversationIDKey]: supersedes})))
    }

    const supersededBy = _toSupersedeInfo(conversationIDKey, c.supersededBy || [])
    if (supersededBy) {
      yield put(Creators.updateSupersededByState(I.Map({[conversationIDKey]: supersededBy})))
    }

    if (c.finalizeInfo) {
      yield put(Creators.updateFinalizedState(I.Map({[conversationIDKey]: c.finalizeInfo})))
    }
  }

  const inboxState = _conversationLocalToInboxState(c)

  if (inboxState) {
    yield put(EntityCreators.replaceEntity(['inboxVersion'], I.Map({[conversationIDKey]: c.version})))
    if (isBigTeam) {
      // There's a bug where the untrusted inbox state for the channel is incorrect so we
      // instead make sure that the small team maps and the big team maps don't allow duplicates
      yield all([
        put(
          EntityCreators.replaceEntity(
            ['inboxBigChannels'],
            I.Map({[conversationIDKey]: inboxState.channelname})
          )
        ),
        put(
          EntityCreators.replaceEntity(
            ['inboxBigChannelsToTeam'],
            I.Map({[conversationIDKey]: inboxState.teamname})
          )
        ),
        put(EntityCreators.deleteEntity(['inboxSmallTimestamps'], I.List([conversationIDKey]))),
      ])
    } else {
      yield all([
        put(
          EntityCreators.replaceEntity(
            ['inboxSmallTimestamps'],
            I.Map({[conversationIDKey]: inboxState.time})
          )
        ),
        put(EntityCreators.deleteEntity(['inboxBigChannels'], I.List([conversationIDKey]))),
        put(EntityCreators.deleteEntity(['inboxBigChannelsToTeam'], I.List([conversationIDKey]))),
      ])
    }
  }

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
  const conversation = Constants.makeInboxState({
    conversationIDKey,
    participants: error.rekeyInfo
      ? I.List([].concat(error.rekeyInfo.writerNames, error.rekeyInfo.readerNames).filter(Boolean))
      : I.List(error.unverifiedTLFName.split(',')),
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
  let {conversationIDKeys, force, forInboxSync} = action.payload

  const inbox = yield select(state => state.entities.get('inbox'))

  conversationIDKeys = conversationIDKeys.filter(c => {
    return !Constants.isPendingConversationIDKey(c) && inbox.getIn([c, 'state']) === 'untrusted'
  })

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
        skipUnverified: forInboxSync,
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
  if (forInboxSync) {
    yield put(Creators.setInboxUntrustedState('loaded'))
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

  let parts = I.List(c.participants || [])
  let teamname = null
  let channelname = null

  if (c.membersType === ChatTypes.CommonConversationMembersType.team) {
    teamname = c.name
    channelname = c.channel
  }

  const notifications = c.notifications && parseNotifications(c.notifications)

  return Constants.makeInboxState({
    channelname,
    conversationIDKey,
    isEmpty: c.isEmpty,
    membersType: c.membersType,
    name: c.name,
    notifications,
    participants: parts,
    state: 'unboxed',
    status: Constants.ConversationStatusByEnum[c.status],
    teamType: c.teamType,
    teamname,
    time: c.time,
    version: c.version,
    visibility: c.visibility,
  })
}

function* filterSelectNext(action: Constants.InboxFilterSelectNext): SagaGenerator<any, any> {
  const rows = action.payload.rows
  const direction = action.payload.direction

  const selected = yield select(Constants.getSelectedConversation)

  const idx = rows.findIndex(r => r.conversationIDKey === selected)
  let nextIdx
  if (idx === -1) {
    nextIdx = 0
  } else {
    nextIdx = Math.min(rows.length - 1, Math.max(0, idx + direction))
  }
  const r = rows[nextIdx]
  if (r && r.conversationIDKey) {
    yield put(Creators.selectConversation(r.conversationIDKey, false))
  }
}

export {
  filterSelectNext,
  onInboxStale,
  onGetInboxAndUnbox,
  parseNotifications,
  unboxConversations,
  processConversation,
  unboxMore,
}
