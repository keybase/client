// @flow
// Actions that have to do with the inbox.
// Loading, unboxing, filtering, stale, out of sync, badging
import * as RPCChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as ChatGen from '../chat-gen'
import * as ConfigGen from '../config-gen'
import * as EngineRpc from '../engine/helper'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Selectors from '../../constants/selectors'
import * as Shared from './shared'
import HiddenString from '../../util/hidden-string'
import {NotifyPopup} from '../../native/notifications'
import {RPCTimeoutError} from '../../util/errors'
import {chatTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {showMainWindow} from '../platform-specific'
import {switchTo} from '../route-tree'
import {type SagaGenerator} from '../../constants/types/saga'
import {type TypedState} from '../../constants/reducer'

// How many messages we consider too many to just download when you are stale and we could possibly just append
const tooManyMessagesToJustAppendOnStale = 200

// Common props for getting the inbox
const _getInboxQuery = {
  computeActiveList: true,
  readOnly: false,
  status: Object.keys(RPCChatTypes.commonConversationStatus)
    .filter(k => !['ignored', 'blocked', 'reported'].includes(k))
    .map(k => RPCChatTypes.commonConversationStatus[k]),
  tlfVisibility: RPCTypes.commonTLFVisibility.private,
  topicType: RPCChatTypes.commonTopicType.chat,
  unreadOnly: false,
}

// Update inboxes that have been reset
function* _updateFinalized(inbox: RPCChatTypes.UnverifiedInboxUIItems): Generator<any, void, any> {
  const finalizedState: Constants.FinalizedState = I.Map(
    (inbox.conversationsUnverified || [])
      .filter(c => c.metadata.finalizeInfo)
      .map(convoUnverified => [
        Constants.conversationIDToKey(convoUnverified.metadata.conversationID),
        convoUnverified.metadata.finalizeInfo,
      ])
  )

  if (finalizedState.count()) {
    yield Saga.put(ChatGen.createUpdateFinalizedState({finalizedState}))
  }
}

function* onInboxLoad(): SagaGenerator<any, any> {
  yield Saga.put(ChatGen.createInboxStale({reason: 'random inbox load from view layer'}))
}

// Loads the untrusted inbox only
function* onInboxStale(action: ChatGen.InboxStalePayload): SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const author = Selectors.usernameSelector(state)
  if (!author) {
    console.log('Not logged in in inbox stale?')
    return
  }
  console.log('onInboxStale: running because of: ' + action.payload.reason)
  try {
    yield Saga.put(ChatGen.createSetInboxGlobalUntrustedState({inboxGlobalUntrustedState: 'loading'}))

    const loadInboxChanMap = RPCChatTypes.localGetInboxNonblockLocalRpcChannelMap(
      ['chat.1.chatUi.chatInboxUnverified', 'finished'],
      {
        param: {
          identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
          maxUnbox: 0,
          query: _getInboxQuery,
          skipUnverified: false,
        },
      }
    )

    const incoming = yield loadInboxChanMap.race()

    if (incoming.finished) {
      yield Saga.put(ChatGen.createSetInboxGlobalUntrustedState({inboxGlobalUntrustedState: 'loaded'}))
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
    const inbox: RPCChatTypes.UnverifiedInboxUIItems = JSON.parse(jsonInbox)
    yield Saga.call(_updateFinalized, inbox)

    const idToVersion = I.Map((inbox.items || []).map(c => [c.convID, c.version]))

    const snippets = (inbox.items || []).reduce((map, c) => {
      // If we don't have metaData ignore it
      if (c.localMetadata) {
        map[c.convID] = new HiddenString(Constants.makeSnippet(c.localMetadata.snippet) || '')
      }
      return map
    }, {})

    const oldInbox = state.chat.get('inbox')
    const toDelete = oldInbox.keySeq().toSet().subtract((inbox.items || []).map(c => c.convID))
    const conversations = Shared.makeInboxStateRecords(author, inbox.items || [], oldInbox)
    yield Saga.put(ChatGen.createReplaceEntity({keyPath: ['inboxSnippet'], entities: I.Map(snippets)}))
    yield Saga.put(ChatGen.createSetInboxGlobalUntrustedState({inboxGlobalUntrustedState: 'loaded'}))
    yield Saga.put(
      ChatGen.createReplaceEntity({
        keyPath: ['inboxUntrustedState'],
        entities: I.Map(conversations.map(c => [c.conversationIDKey, 'untrusted'])),
      })
    )

    const inboxSmallTimestamps = I.Map(
      conversations
        .map(c => (c.teamType !== RPCChatTypes.commonTeamType.complex ? [c.conversationIDKey, c.time] : null))
        .filter(Boolean)
    )

    const inboxBigChannelsToTeam = I.Map(
      conversations
        .map(
          c => (c.teamType === RPCChatTypes.commonTeamType.complex ? [c.conversationIDKey, c.teamname] : null)
        )
        .filter(Boolean)
    )

    const inboxBigChannels = I.Map(
      conversations
        .map(
          c =>
            c.teamType === RPCChatTypes.commonTeamType.complex && c.channelname
              ? [c.conversationIDKey, c.channelname]
              : null
        )
        .filter(Boolean)
    )

    const inboxMap = I.Map(conversations.map(c => [c.conversationIDKey, c]))

    const inboxIsEmpty = I.Map(conversations.map(c => [c.conversationIDKey, c.isEmpty]))

    yield Saga.all([
      Saga.put(ChatGen.createReplaceEntity({keyPath: ['inboxVersion'], entities: idToVersion})),
      Saga.put(
        ChatGen.createReplaceEntity({keyPath: ['inboxSmallTimestamps'], entities: inboxSmallTimestamps})
      ),
      Saga.put(ChatGen.createMergeEntity({keyPath: ['inboxBigChannels'], entities: inboxBigChannels})), // keep old names if we have them
      Saga.put(
        ChatGen.createReplaceEntity({keyPath: ['inboxBigChannelsToTeam'], entities: inboxBigChannelsToTeam})
      ),
      Saga.put(ChatGen.createReplaceEntity({keyPath: ['inboxIsEmpty'], entities: inboxIsEmpty})),
      Saga.put(ChatGen.createReplaceEntity({keyPath: ['inbox'], entities: inboxMap})),
      Saga.put(ChatGen.createDeleteEntity({keyPath: ['inboxVersion'], ids: toDelete})),
      Saga.put(ChatGen.createDeleteEntity({keyPath: ['inboxSmallTimestamps'], ids: toDelete})),
      Saga.put(ChatGen.createDeleteEntity({keyPath: ['inboxBigChannelsToTeam'], ids: toDelete})),
      Saga.put(ChatGen.createDeleteEntity({keyPath: ['inboxIsEmpty'], ids: toDelete})),
      Saga.put(ChatGen.createDeleteEntity({keyPath: ['inbox'], ids: toDelete})),
      Saga.put(ChatGen.createInboxStoreLoaded()),
    ])

    // Load the first visible simple and teams so we can get the channel names
    const toUnbox = conversations
      .filter(c => !c.teamname)
      .slice(0, 20)
      .concat(conversations.filter(c => c.teamname))
      .map(c => c.conversationIDKey)

    yield Saga.put(
      ChatGen.createUnboxConversations({conversationIDKeys: toUnbox, reason: 'reloading entire inbox'})
    )
  } finally {
    if (yield Saga.cancelled()) {
      yield Saga.put(ChatGen.createSetInboxGlobalUntrustedState({inboxGlobalUntrustedState: 'unloaded'}))
    }
  }
}

function* onGetInboxAndUnbox({
  payload: {conversationIDKeys},
}: ChatGen.GetInboxAndUnboxPayload): SagaGenerator<any, any> {
  yield Saga.put(ChatGen.createUnboxConversations({conversationIDKeys, reason: 'getInboxAndUnbox'}))
}

function _toSupersedeInfo(
  conversationIDKey: Constants.ConversationIDKey,
  supersedeData: Array<RPCChatTypes.ConversationMetadata>
): ?Constants.SupersedeInfo {
  const toConvert = supersedeData.find(
    s => s.idTriple.topicType === RPCChatTypes.commonTopicType.chat && s.finalizeInfo
  )

  const finalizeInfo = toConvert && toConvert.finalizeInfo

  return toConvert && finalizeInfo
    ? {
        conversationIDKey: Constants.conversationIDToKey(toConvert.conversationID),
        finalizeInfo,
      }
    : null
}

// Update an inbox item
function* _processConversation(c: RPCChatTypes.InboxUIItem): Generator<any, void, any> {
  const conversationIDKey = c.convID

  const isBigTeam = c.teamType === RPCChatTypes.commonTeamType.complex
  const isTeam = c.membersType === RPCChatTypes.commonConversationMembersType.team

  if (!isTeam) {
    const supersedes = _toSupersedeInfo(conversationIDKey, c.supersedes || [])
    if (supersedes) {
      yield Saga.put(
        ChatGen.createUpdateSupersedesState({supersedesState: I.Map({[conversationIDKey]: supersedes})})
      )
    }

    const supersededBy = _toSupersedeInfo(conversationIDKey, c.supersededBy || [])
    if (supersededBy) {
      yield Saga.put(
        ChatGen.createUpdateSupersededByState({supersededByState: I.Map({[conversationIDKey]: supersededBy})})
      )
    }

    if (c.finalizeInfo) {
      yield Saga.put(
        ChatGen.createUpdateFinalizedState({finalizedState: I.Map({[conversationIDKey]: c.finalizeInfo})})
      )
    }
  }

  const inboxState = _conversationLocalToInboxState(c)

  if (inboxState) {
    yield Saga.put(
      ChatGen.createReplaceEntity({
        keyPath: ['inboxUntrustedState'],
        entities: I.Map({[conversationIDKey]: 'unboxed'}),
      })
    )

    yield Saga.put(
      ChatGen.createReplaceEntity({
        keyPath: ['inboxVersion'],
        entities: I.Map({[conversationIDKey]: c.version}),
      })
    )
    if (isBigTeam) {
      // There's a bug where the untrusted inbox state for the channel is incorrect so we
      // instead make sure that the small team maps and the big team maps don't allow duplicates
      yield Saga.all([
        Saga.put(
          ChatGen.createReplaceEntity({
            keyPath: ['inboxBigChannels'],
            entities: I.Map({[conversationIDKey]: inboxState.channelname}),
          })
        ),
        Saga.put(
          ChatGen.createReplaceEntity({
            keyPath: ['inboxBigChannelsToTeam'],
            entities: I.Map({[conversationIDKey]: inboxState.teamname}),
          })
        ),
        Saga.put(
          ChatGen.createDeleteEntity({
            keyPath: ['inboxSmallTimestamps'],
            ids: I.List([conversationIDKey]),
          })
        ),
      ])
    } else {
      yield Saga.all([
        Saga.put(
          ChatGen.createReplaceEntity({
            keyPath: ['inboxSmallTimestamps'],
            entities: I.Map({[conversationIDKey]: inboxState.time}),
          })
        ),
        Saga.put(
          ChatGen.createDeleteEntity({keyPath: ['inboxBigChannels'], ids: I.List([conversationIDKey])})
        ),
        Saga.put(
          ChatGen.createDeleteEntity({
            keyPath: ['inboxBigChannelsToTeam'],
            ids: I.List([conversationIDKey]),
          })
        ),
      ])
    }
  }

  if (!isBigTeam && c && c.snippet) {
    const snippet = c.snippet
    yield Saga.put(
      ChatGen.createUpdateSnippet({
        conversationIDKey,
        snippet: new HiddenString(Constants.makeSnippet(snippet) || ''),
      })
    )
  }

  if (inboxState) {
    // We blocked it
    if (['blocked', 'reported'].includes(inboxState.status)) {
      yield Saga.put(
        ChatGen.createDeleteEntity({
          keyPath: ['inboxSmallTimestamps'],
          ids: I.List([inboxState.conversationIDKey]),
        })
      )
      yield Saga.put(
        ChatGen.createDeleteEntity({keyPath: ['inbox'], ids: I.List([inboxState.conversationIDKey])})
      )
    } else {
      yield Saga.put(
        ChatGen.createReplaceEntity({
          keyPath: ['inbox'],
          entities: I.Map({[inboxState.conversationIDKey]: inboxState}),
        })
      )
    }

    if (!isBigTeam) {
      // inbox loaded so rekeyInfo is now clear
      yield Saga.put(ChatGen.createClearRekey({conversationIDKey: inboxState.conversationIDKey}))
    }

    // Try and load messages if the updated item is the selected one
    const selectedConversation = yield Saga.select(Constants.getSelectedConversation)
    if (selectedConversation === inboxState.conversationIDKey) {
      // load validated selected
      yield Saga.put(
        ChatGen.createLoadMoreMessages({conversationIDKey: selectedConversation, onlyIfUnloaded: true})
      )
    }
  }
}

const _chatInboxToProcess = []

function* _chatInboxConversationSubSaga({conv}) {
  const pconv = JSON.parse(conv)
  _chatInboxToProcess.push(pconv)
  yield Saga.put(ChatGen.createUnboxMore())
  return EngineRpc.rpcResult()
}

function* _unboxMore(): SagaGenerator<any, any> {
  if (!_chatInboxToProcess.length) {
    return
  }

  // the most recent thing you asked for is likely what you want
  // (aka scrolling)
  const conv = _chatInboxToProcess.pop()
  if (conv) {
    yield Saga.spawn(_processConversation, conv)
  }

  if (_chatInboxToProcess.length) {
    yield Saga.call(Saga.delay, 100)
    yield Saga.put(ChatGen.createUnboxMore())
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

  yield Saga.put(
    ChatGen.createReplaceEntity({
      keyPath: ['inboxUntrustedState'],
      entities: I.Map({[conversationIDKey]: 'error'}),
    })
  )
  yield Saga.put(ChatGen.createUpdateSnippet({conversationIDKey, snippet: new HiddenString(error.message)}))
  yield Saga.put(
    ChatGen.createReplaceEntity({keyPath: ['inbox'], entities: I.Map({[conversationIDKey]: conversation})})
  )

  // Mark the conversation as read, to avoid a state where there's a
  // badged conversation that can't be unbadged by clicking on it.
  const {maxMsgid} = error.remoteConv.readerInfo
  const state: TypedState = yield Saga.select()
  const selectedConversation = Constants.getSelectedConversation(state)
  if (maxMsgid && selectedConversation === conversationIDKey) {
    try {
      yield Saga.call(RPCChatTypes.localMarkAsReadLocalRpcPromise, {
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
    case RPCChatTypes.localConversationErrorType.selfrekeyneeded: {
      yield Saga.put(ChatGen.createUpdateInboxRekeySelf({conversationIDKey}))
      break
    }
    case RPCChatTypes.localConversationErrorType.otherrekeyneeded: {
      const rekeyers = error.rekeyInfo.rekeyers
      yield Saga.put(ChatGen.createUpdateInboxRekeyOthers({conversationIDKey, rekeyers}))
      break
    }
    case RPCChatTypes.localConversationErrorType.transient: {
      // Just ignore these, it is a transient error
      break
    }
    case RPCChatTypes.localConversationErrorType.permanent: {
      // Let's show it as failed in the inbox
      break
    }
    default:
      yield Saga.put(ConfigGen.createGlobalError({globalError: error}))
  }

  return EngineRpc.rpcResult()
}

const unboxConversationsSagaMap = {
  'chat.1.chatUi.chatInboxConversation': _chatInboxConversationSubSaga,
  'chat.1.chatUi.chatInboxFailed': _chatInboxFailedSubSaga,
  'chat.1.chatUi.chatInboxUnverified': EngineRpc.passthroughResponseSaga,
}

// Loads the trusted inbox segments
function* unboxConversations(action: ChatGen.UnboxConversationsPayload): SagaGenerator<any, any> {
  let {conversationIDKeys, reason, force, forInboxSync} = action.payload

  const state: TypedState = yield Saga.select()
  const untrustedState = state.chat.inboxUntrustedState

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

  // Load new untrusted state
  yield Saga.put.resolve(
    ChatGen.createReplaceEntity({keyPath: ['inboxUntrustedState'], entities: I.Map(newUntrustedState)})
  )

  conversationIDKeys = newConvIDKeys
  if (!conversationIDKeys.length) {
    return
  }
  console.log(`unboxConversations: unboxing ${conversationIDKeys.length} convs, because: ${reason}`)

  // If we've been asked to unbox something and we don't have a selected thing, lets make it selected (on desktop)
  if (!isMobile) {
    const state: TypedState = yield Saga.select()
    const selected = Constants.getSelectedConversation(state)
    if (!selected) {
      yield Saga.put(
        ChatGen.createSelectConversation({conversationIDKey: conversationIDKeys[0], fromUser: false})
      )
    }
  }

  const loadInboxRpc = new EngineRpc.EngineRpcCall(
    unboxConversationsSagaMap,
    RPCChatTypes.localGetInboxNonblockLocalRpcChannelMap,
    'unboxConversations',
    {
      param: {
        identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
        skipUnverified: forInboxSync,
        query: {
          ..._getInboxQuery,
          convIDs: conversationIDKeys.map(Constants.keyToConversationID),
        },
      },
    }
  )

  try {
    yield Saga.call(loadInboxRpc.run, 30e3)
  } catch (error) {
    if (error instanceof RPCTimeoutError) {
      console.warn('timed out request for unboxConversations, bailing')
      yield Saga.put.resolve(
        ChatGen.createReplaceEntity({
          keyPath: ['inboxUntrustedState'],
          entities: I.Map(conversationIDKeys.map(c => [c, 'untrusted'])),
        })
      )
    } else {
      console.warn('Error in loadInboxRpc', error)
    }
  }
  if (forInboxSync) {
    yield Saga.put(ChatGen.createSetInboxSyncingState({inboxSyncingState: 'notSyncing'}))
  }
}

const parseNotifications = (
  notifications: RPCChatTypes.ConversationNotificationInfo
): ?Constants.NotificationsState => {
  if (!notifications || !notifications.settings) {
    return null
  }
  const {settings} = notifications
  return {
    channelWide: notifications.channelWide,
    desktop: {
      atmention: settings[RPCTypes.commonDeviceType.desktop.toString()][
        RPCChatTypes.commonNotificationKind.atmention.toString()
      ],
      generic: settings[RPCTypes.commonDeviceType.desktop.toString()][
        RPCChatTypes.commonNotificationKind.generic.toString()
      ],
    },
    mobile: {
      atmention: settings[RPCTypes.commonDeviceType.mobile.toString()][
        RPCChatTypes.commonNotificationKind.atmention.toString()
      ],
      generic: settings[RPCTypes.commonDeviceType.mobile.toString()][
        RPCChatTypes.commonNotificationKind.generic.toString()
      ],
    },
  }
}

// Convert server to our data type
function _conversationLocalToInboxState(c: ?RPCChatTypes.InboxUIItem): ?Constants.InboxState {
  if (
    !c ||
    c.visibility !== RPCTypes.commonTLFVisibility.private || // private chats only
    c.name.includes('#') // We don't support mixed reader/writers
  ) {
    return null
  }

  const conversationIDKey = c.convID

  let parts = I.List(c.participants || [])
  let fullNames = I.Map(c.fullNames || {})
  let teamname = null
  let channelname = null

  if (c.membersType === RPCChatTypes.commonConversationMembersType.team) {
    teamname = c.name
    channelname = c.channel
  }

  const notifications = c.notifications && parseNotifications(c.notifications)

  return Constants.makeInboxState({
    channelname,
    conversationIDKey,
    isEmpty: c.isEmpty,
    maxMsgID: c.maxMsgID,
    memberStatus: c.memberStatus,
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

function* filterSelectNext(action: ChatGen.SelectNextPayload): SagaGenerator<any, any> {
  const rows = action.payload.rows
  const direction = action.payload.direction

  const state: TypedState = yield Saga.select()
  const selected = Constants.getSelectedConversation(state)

  const idx = rows.findIndex(r => r.conversationIDKey === selected)
  let nextIdx
  if (idx === -1) {
    nextIdx = 0
  } else {
    nextIdx = Math.min(rows.length - 1, Math.max(0, idx + direction))
  }
  const r = rows[nextIdx]
  if (r && r.conversationIDKey) {
    yield Saga.put(
      ChatGen.createSelectConversation({conversationIDKey: r.conversationIDKey, fromUser: false})
    )
  }
}

function* _sendNotifications(action: ChatGen.AppendMessagesPayload): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const appFocused = Shared.focusedSelector(state)
  const selectedTab = Shared.routeSelector(state)
  const chatTabSelected = selectedTab === chatTab
  const convoIsSelected = action.payload.isSelected
  const svcDisplay = action.payload.svcShouldDisplayNotification

  console.log(
    'Deciding whether to notify new message:',
    svcDisplay,
    convoIsSelected,
    appFocused,
    chatTabSelected
  )
  // Only send if you're not looking at it and service wants us to
  if (svcDisplay && (!convoIsSelected || !appFocused || !chatTabSelected)) {
    const message = action.payload.messages.reverse().find(m => m.type === 'Text' || m.type === 'System')
    // Is this message part of a muted conversation? If so don't notify.
    const convo = Constants.getInbox(state, action.payload.conversationIDKey)
    if (convo && convo.get('status') !== 'muted') {
      if (message && (message.type === 'Text' || message.type === 'System')) {
        console.log('Sending Chat notification')
        const snippet = Constants.makeSnippet(Constants.serverMessageToMessageText(message))
        yield Saga.put((dispatch: Dispatch) => {
          NotifyPopup(message.author, {body: snippet}, -1, message.author, () => {
            dispatch(
              ChatGen.createSelectConversation({
                conversationIDKey: action.payload.conversationIDKey,
                fromUser: false,
              })
            )
            dispatch(switchTo([chatTab]))
            dispatch(showMainWindow())
          })
        })
      }
    }
  }
}

function* _markThreadsStale(action: ChatGen.MarkThreadsStalePayload): Saga.SagaGenerator<any, any> {
  // Load inbox items of any stale items so we get update on rekeyInfos, etc
  const {updates} = action.payload
  const convIDs = updates.map(u => Constants.conversationIDToKey(u.convID))
  yield Saga.put(
    ChatGen.createUnboxConversations({conversationIDKeys: convIDs, reason: 'thread stale', force: true})
  )

  const state: TypedState = yield Saga.select()

  // Selected is stale?
  const selectedConversation = Constants.getSelectedConversation(state)
  if (!selectedConversation) {
    return
  }
  yield Saga.put(ChatGen.createClearMessages({conversationIDKey: selectedConversation}))
  yield Saga.put(
    ChatGen.createLoadMoreMessages({conversationIDKey: selectedConversation, onlyIfUnloaded: false})
  )
}

function* _inboxSynced(action: ChatGen.InboxSyncedPayload): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const author = Selectors.usernameSelector(state)
  if (!author) {
    console.log('_inboxSynced with no logged in user')
    return
  }

  const {convs} = action.payload
  const items = Shared.makeInboxStateRecords(author, convs, I.Map())
  const latestMaxMsgID = convs.reduce((acc, c) => {
    acc[c.convID] = c.maxMsgID
    return acc
  }, {})

  yield Saga.put(
    ChatGen.createReplaceEntity({
      keyPath: ['inbox'],
      entities: I.Map(
        items.reduce((map, c) => {
          map[c.conversationIDKey] = c
          return map
        }, {})
      ),
    })
  )
  const convIDs = items.map(item => item.conversationIDKey)
  yield Saga.put(
    ChatGen.createUnboxConversations({
      conversationIDKeys: convIDs,
      reason: 'inbox syncing',
      force: true,
      forInboxSync: true,
    })
  )

  const selectedConversation = Constants.getSelectedConversation(state)
  if (!selectedConversation || convIDs.indexOf(selectedConversation) < 0) {
    return
  }

  const conversation = Constants.getSelectedConversationStates(state)
  if (conversation) {
    const inbox = Constants.getInbox(state, selectedConversation)
    const lastMessageIDWeAreShowing = Constants.lastMessageID(state, selectedConversation)

    // Check the data we are given first, then our state
    const knownMaxMessageID: ?number = latestMaxMsgID[selectedConversation] || (inbox ? inbox.maxMsgID : null)

    let numberOverride
    if (lastMessageIDWeAreShowing && knownMaxMessageID) {
      const lastRpcMessageIdWeAreShowing = Constants.messageIDToRpcMessageID(lastMessageIDWeAreShowing)

      // Check to see if we could possibly be asking for too many messages
      numberOverride = knownMaxMessageID - lastRpcMessageIdWeAreShowing
      if (numberOverride > tooManyMessagesToJustAppendOnStale) {
        console.log('Doing a full load due to too many old messages', numberOverride)
        yield Saga.all([
          Saga.put(ChatGen.createClearMessages({conversationIDKey: selectedConversation})),
          Saga.put(
            ChatGen.createLoadMoreMessages({conversationIDKey: selectedConversation, onlyIfUnloaded: false})
          ),
        ])
        return
      }
    }
    // It is VERY important to pass the exact number of things to request here. The pagination system will
    // return whatever number we ask for on newest messages due to its architecture so if we want only N
    // newer items we have to explictly ask for N or it will give us messages older than onlyNewerThan
    yield Saga.put(
      ChatGen.createLoadMoreMessages({
        conversationIDKey: selectedConversation,
        onlyIfUnloaded: false,
        fromUser: false,
        wantNewer: true,
        numberOverride,
      })
    )
  }
}
function* _badgeAppForChat(action: ChatGen.BadgeAppForChatPayload): Saga.SagaGenerator<any, any> {
  const {conversations} = action.payload
  let totals: {[key: string]: number} = {}
  let badges: {[key: string]: number} = {}

  conversations.map(c => Constants.ConversationBadgeStateRecord(c)).forEach(conv => {
    const total = conv.get('unreadMessages')
    if (total) {
      const badged = conv.get('badgeCounts')[
        `${isMobile ? RPCTypes.commonDeviceType.mobile : RPCTypes.commonDeviceType.desktop}`
      ]
      const conversationIDKey = Constants.conversationIDToKey(conv.get('convID'))
      totals[conversationIDKey] = total
      if (badged) {
        badges[conversationIDKey] = badged
      }
    }
  })

  badges = I.Map(badges)
  totals = I.Map(totals)

  const state: TypedState = yield Saga.select()

  const oldBadge = state.chat.inboxUnreadCountBadge
  const oldTotal = state.chat.inboxUnreadCountTotal
  if (!I.is(oldBadge, badges)) {
    yield Saga.put(
      ChatGen.createReplaceEntity({keyPath: [], entities: I.Map({inboxUnreadCountBadge: badges})})
    )
  }
  if (!I.is(oldTotal, totals)) {
    yield Saga.put(
      ChatGen.createReplaceEntity({keyPath: [], entities: I.Map({inboxUnreadCountTotal: totals})})
    )
  }
}

function _updateSnippet({payload: {snippet, conversationIDKey}}: ChatGen.UpdateSnippetPayload) {
  return Saga.put(
    ChatGen.createReplaceEntity({keyPath: ['inboxSnippet'], entities: I.Map({[conversationIDKey]: snippet})})
  )
}

function* _incomingMessage(action: ChatGen.IncomingMessagePayload): Saga.SagaGenerator<any, any> {
  switch (action.payload.activity.activityType) {
    case RPCChatTypes.notifyChatChatActivityType.setStatus:
      const setStatus: ?RPCChatTypes.SetStatusInfo = action.payload.activity.setStatus
      if (setStatus && setStatus.conv) {
        yield Saga.spawn(_processConversation, setStatus.conv)
      }
      break
    case RPCChatTypes.notifyChatChatActivityType.readMessage:
      if (action.payload.activity.readMessage) {
        const inboxUIItem: ?RPCChatTypes.InboxUIItem = action.payload.activity.readMessage.conv
        if (inboxUIItem) {
          yield Saga.spawn(_processConversation, inboxUIItem)
        }
      }
      break
    case RPCChatTypes.notifyChatChatActivityType.incomingMessage:
      const incomingMessage: ?RPCChatTypes.IncomingMessage = action.payload.activity.incomingMessage
      if (incomingMessage) {
        // If it's a public chat, the GUI (currently) wants no part of it. We
        // especially don't want to surface the conversation as if it were a
        // private one, which is what we were doing before this change.
        if (
          incomingMessage.conv &&
          incomingMessage.conv.visibility !== RPCTypes.commonTLFVisibility.private
        ) {
          return
        }

        const conversationIDKey = Constants.conversationIDToKey(incomingMessage.convID)
        if (incomingMessage.conv) {
          yield Saga.spawn(_processConversation, incomingMessage.conv)
        } else {
          // Sometimes (just for deletes?) we get an incomingMessage without
          // a conv object -- in that case, ask the service to give us an
          // updated one so that the snippet etc gets updated.
          yield Saga.put(
            ChatGen.createUnboxConversations({
              conversationIDKeys: [conversationIDKey],
              reason: 'no conv from incoming message',
              force: true,
            })
          )
        }
      }
      break
    case RPCChatTypes.notifyChatChatActivityType.teamtype:
      // Just reload everything if we get one of these
      yield Saga.put(ChatGen.createInboxStale({reason: 'team type changed'}))
      break
    case RPCChatTypes.notifyChatChatActivityType.newConversation:
      const newConv: ?RPCChatTypes.NewConversationInfo = action.payload.activity.newConversation
      if (newConv && newConv.conv) {
        yield Saga.spawn(_processConversation, newConv.conv)
        break
      }
      // Just reload everything if we get this with no InboxUIItem
      console.log('newConversation with no InboxUIItem')
      yield Saga.put(ChatGen.createInboxStale({reason: 'no inbox item for new conv message'}))
      break
    case RPCChatTypes.notifyChatChatActivityType.setAppNotificationSettings:
      if (action.payload.activity && action.payload.activity.setAppNotificationSettings) {
        const {convID, settings} = action.payload.activity.setAppNotificationSettings
        if (convID && settings) {
          const conversationIDKey = Constants.conversationIDToKey(convID)
          const notifications = parseNotifications(settings)
          if (notifications) {
            yield Saga.put(ChatGen.createUpdatedNotifications({conversationIDKey, notifications}))
          }
        }
      }
      break
    case RPCChatTypes.notifyChatChatActivityType.membersUpdate:
      const info = action.payload.activity && action.payload.activity.membersUpdate
      const convID = info && info.convID
      const conversationIDKey = Constants.conversationIDToKey(convID)

      yield Saga.put(
        ChatGen.createUnboxConversations({
          conversationIDKeys: [conversationIDKey],
          reason: 'Membership updated',
          force: true,
        })
      )
      break
  }
}

function _joinConversation(action: ChatGen.JoinConversationPayload) {
  const convID = Constants.keyToConversationID(action.payload.conversationIDKey)
  return Saga.call(RPCChatTypes.localJoinConversationByIDLocalRpcPromise, {param: {convID}})
}

function _previewChannel(action: ChatGen.PreviewChannelPayload) {
  const convID = Constants.keyToConversationID(action.payload.conversationIDKey)
  return Saga.call(RPCChatTypes.localPreviewConversationByIDLocalRpcPromise, {param: {convID}})
}

function* registerSagas(): SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(ChatGen.updateSnippet, _updateSnippet)
  yield Saga.safeTakeEvery(ChatGen.getInboxAndUnbox, onGetInboxAndUnbox)
  yield Saga.safeTakeEvery(ChatGen.selectNext, filterSelectNext)
  yield Saga.safeTakeLatest(ChatGen.inboxStale, onInboxStale)
  yield Saga.safeTakeLatest(ChatGen.loadInbox, onInboxLoad)
  yield Saga.safeTakeLatest(ChatGen.unboxMore, _unboxMore)
  yield Saga.safeTakeSerially(ChatGen.unboxConversations, unboxConversations)
  yield Saga.safeTakeEvery(ChatGen.appendMessages, _sendNotifications)
  yield Saga.safeTakeEvery(ChatGen.markThreadsStale, _markThreadsStale)
  yield Saga.safeTakeEvery(ChatGen.inboxSynced, _inboxSynced)
  yield Saga.safeTakeLatest(ChatGen.badgeAppForChat, _badgeAppForChat)
  yield Saga.safeTakeEvery(ChatGen.incomingMessage, _incomingMessage)
  yield Saga.safeTakeEveryPure(ChatGen.joinConversation, _joinConversation)
  yield Saga.safeTakeEveryPure(ChatGen.previewChannel, _previewChannel)
}

export {registerSagas}
