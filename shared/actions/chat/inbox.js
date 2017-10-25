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
import {isMobile} from '../../constants/platform'

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

function* onInboxLoad(): SagaGenerator<any, any> {
  yield put(Creators.inboxStale('random inbox load from view layer'))
}

// Loads the untrusted inbox only
function* onInboxStale(param: Constants.InboxStale): SagaGenerator<any, any> {
  console.log('onInboxStale: running because of: ' + param.payload.reason)
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

    const idToVersion = I.Map((inbox.items || []).map(c => [c.convID, c.version]))

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
        ['inboxUntrustedState'],
        I.Map(conversations.map(c => [c.conversationIDKey, 'untrusted']))
      )
    )

    const inboxSmallTimestamps = I.Map(
      conversations
        .map(c => (c.teamType !== ChatTypes.CommonTeamType.complex ? [c.conversationIDKey, c.time] : null))
        .filter(Boolean)
    )

    const inboxBigChannelsToTeam = I.Map(
      conversations
        .map(
          c => (c.teamType === ChatTypes.CommonTeamType.complex ? [c.conversationIDKey, c.teamname] : null)
        )
        .filter(Boolean)
    )

    const inboxBigChannels = I.Map(
      conversations
        .map(
          c =>
            c.teamType === ChatTypes.CommonTeamType.complex && c.channelname
              ? [c.conversationIDKey, c.channelname]
              : null
        )
        .filter(Boolean)
    )

    const inboxMap = I.Map(conversations.map(c => [c.conversationIDKey, c]))

    const inboxIsEmpty = I.Map(conversations.map(c => [c.conversationIDKey, c.isEmpty]))

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

    yield put(Creators.unboxConversations(toUnbox, 'reloading entire inbox'))
  } finally {
    if (yield cancelled()) {
      yield put(Creators.setInboxUntrustedState('unloaded'))
    }
  }
}

function* onGetInboxAndUnbox({
  payload: {conversationIDKeys},
}: Constants.GetInboxAndUnbox): SagaGenerator<any, any> {
  yield put(Creators.unboxConversations(conversationIDKeys, 'getInboxAndUnbox'))
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
    yield put(EntityCreators.replaceEntity(['inboxUntrustedState'], I.Map({[conversationIDKey]: 'unboxed'})))

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
    // We blocked it
    if (['blocked', 'reported'].includes(inboxState.status)) {
      yield put(EntityCreators.deleteEntity(['inboxSmallTimestamps'], I.List([inboxState.conversationIDKey])))
      yield put(EntityCreators.deleteEntity(['inbox'], I.List([inboxState.conversationIDKey])))
    } else {
      yield put(EntityCreators.replaceEntity(['inbox'], I.Map({[inboxState.conversationIDKey]: inboxState})))
    }

    if (!isBigTeam) {
      // inbox loaded so rekeyInfo is now clear
      yield put(Creators.clearRekey(inboxState.conversationIDKey))
    }

    // Try and load messages if the updated item is the selected one
    const selectedConversation = yield select(Constants.getSelectedConversation)
    if (selectedConversation === inboxState.conversationIDKey) {
      // load validated selected
      yield put(Creators.loadMoreMessages(selectedConversation, true))
    }
  }
}

const _chatInboxToProcess = []

function* _chatInboxConversationSubSaga({conv}) {
  const pconv = JSON.parse(conv)
  _chatInboxToProcess.push(pconv)
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
    status: 'unfiled',
    time: error.remoteConv.readerInfo.mtime,
  })

  yield put(EntityCreators.replaceEntity(['inboxUntrustedState'], I.Map({[conversationIDKey]: 'error'})))
  yield put(Creators.updateSnippet(conversationIDKey, new HiddenString(error.message)))
  yield put(EntityCreators.replaceEntity(['inbox'], I.Map({[conversationIDKey]: conversation})))

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
  let {conversationIDKeys, reason, force, forInboxSync} = action.payload

  const untrustedState = yield select(state => state.entities.inboxUntrustedState)
  // Don't unbox pending conversations
  conversationIDKeys = conversationIDKeys.filter(c => !Constants.isPendingConversationIDKey(c))

  let newConvIDKeys = []
  const newUntrustedState = conversationIDKeys.reduce((map, c) => {
    if (untrustedState.get(c) === 'unboxed') {
      // only unbox unboxed if we force
      if (force) {
        map[c] = 'reUnboxing'
        newConvIDKeys.push(c)
      }
      // only unbox if we're not currently unboxing
    } else if (!['firstUnboxing', 'reUnboxing'].includes(untrustedState.get(c, 'untrusted'))) {
      // This means this is the first unboxing
      map[c] = 'firstUnboxing'
      newConvIDKeys.push(c)
    }
    return map
  }, {})

  conversationIDKeys = newConvIDKeys
  if (!conversationIDKeys.length) {
    return
  }

  console.log(`unboxConversations: unboxing ${conversationIDKeys.length} convs, because: ${reason}`)

  yield put.resolve(EntityCreators.replaceEntity(['inboxUntrustedState'], I.Map(newUntrustedState)))

  // If we've been asked to unbox something and we don't have a selected thing, lets make it selected (on desktop)
  if (!isMobile) {
    const selected = yield select(Constants.getSelectedConversation)
    if (!selected) {
      yield put(Creators.selectConversation(conversationIDKeys[0], false))
    }
  }

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
      yield put.resolve(
        EntityCreators.replaceEntity(
          ['inboxUntrustedState'],
          I.Map(conversationIDKeys.map(c => [c, 'untrusted']))
        )
      )
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
  let fullNames = I.Map(c.fullNames || {})
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
    maxMsgID: c.maxMsgID,
    membersType: c.membersType,
    name: c.name,
    notifications,
    participants: parts,
    fullNames: fullNames,
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
  onInboxLoad,
  onInboxStale,
  onGetInboxAndUnbox,
  parseNotifications,
  unboxConversations,
  processConversation,
  unboxMore,
}
