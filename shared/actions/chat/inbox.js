// @flow
// Actions that have to do with the inbox.
// Loading, unboxing, filtering, stale, out of sync, badging
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as EngineRpc from '../engine/helper'
import * as EntityCreators from '../entities'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Selectors from '../../constants/selectors'
import * as Shared from './shared'
import HiddenString from '../../util/hidden-string'
import {NotifyPopup} from '../../native/notifications'
import {RPCTimeoutError} from '../../util/errors'
import {chatTab} from '../../constants/tabs'
import {globalError} from '../../constants/config'
import {isMobile} from '../../constants/platform'
import {showMainWindow} from '../platform-specific'
import {switchTo} from '../route-tree'
import {type SagaGenerator} from '../../constants/types/saga'
import {unsafeUnwrap} from '../../constants/types/more'

// How many messages we consider too many to just download when you are stale and we could possibly just append
const tooManyMessagesToJustAppendOnStale = 200

// Common props for getting the inbox
const _getInboxQuery = {
  computeActiveList: true,
  readOnly: false,
  status: Object.keys(ChatTypes.CommonConversationStatus)
    .filter(k => !['ignored', 'blocked', 'reported'].includes(k))
    .map(k => ChatTypes.CommonConversationStatus[k]),
  tlfVisibility: RPCTypes.CommonTLFVisibility.private,
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
    yield Saga.put(Creators.updateFinalizedState(finalizedState))
  }
}

function* onInboxLoad(): SagaGenerator<any, any> {
  yield Saga.put(Creators.inboxStale('random inbox load from view layer'))
}

// Loads the untrusted inbox only
function* onInboxStale(param: Constants.InboxStale): SagaGenerator<any, any> {
  console.log('onInboxStale: running because of: ' + param.payload.reason)
  try {
    yield Saga.put(Creators.setInboxUntrustedState('loading'))

    const loadInboxChanMap = ChatTypes.localGetInboxNonblockLocalRpcChannelMap(
      ['chat.1.chatUi.chatInboxUnverified', 'finished'],
      {
        param: {
          identifyBehavior: RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui,
          maxUnbox: 0,
          query: _getInboxQuery,
          skipUnverified: false,
        },
      }
    )

    const incoming = yield loadInboxChanMap.race()

    if (incoming.finished) {
      yield Saga.put(Creators.setInboxUntrustedState('loaded'))
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
    yield Saga.call(_updateFinalized, inbox)

    const idToVersion = I.Map((inbox.items || []).map(c => [c.convID, c.version]))

    const author = yield Saga.select(Selectors.usernameSelector)
    const snippets = (inbox.items || []).reduce((map, c) => {
      // If we don't have metaData ignore it
      if (c.localMetadata) {
        map[c.convID] = new HiddenString(Constants.makeSnippet(c.localMetadata.snippet) || '')
      }
      return map
    }, {})

    const oldInbox = yield Saga.select(s => s.entities.get('inbox'))
    const toDelete = oldInbox.keySeq().toSet().subtract((inbox.items || []).map(c => c.convID))
    const conversations = Shared.makeInboxStateRecords(author, inbox.items || [], oldInbox)
    yield Saga.put(EntityCreators.replaceEntity(['convIDToSnippet'], I.Map(snippets)))
    yield Saga.put(Creators.setInboxUntrustedState('loaded'))
    yield Saga.put(
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

    yield Saga.all([
      Saga.put(EntityCreators.replaceEntity(['inboxVersion'], idToVersion)),
      Saga.put(EntityCreators.replaceEntity(['inboxSmallTimestamps'], inboxSmallTimestamps)),
      Saga.put(EntityCreators.mergeEntity(['inboxBigChannels'], inboxBigChannels)), // keep old names if we have them
      Saga.put(EntityCreators.replaceEntity(['inboxBigChannelsToTeam'], inboxBigChannelsToTeam)),
      Saga.put(EntityCreators.replaceEntity(['inboxIsEmpty'], inboxIsEmpty)),
      Saga.put(EntityCreators.replaceEntity(['inbox'], inboxMap)),
      Saga.put(EntityCreators.deleteEntity(['inboxVersion'], toDelete)),
      Saga.put(EntityCreators.deleteEntity(['inboxSmallTimestamps'], toDelete)),
      Saga.put(EntityCreators.deleteEntity(['inboxBigChannelsToTeam'], toDelete)),
      Saga.put(EntityCreators.deleteEntity(['inboxIsEmpty'], toDelete)),
      Saga.put(EntityCreators.deleteEntity(['inbox'], toDelete)),
    ])

    // Load the first visible simple and teams so we can get the channel names
    const toUnbox = conversations
      .filter(c => !c.teamname)
      .slice(0, 20)
      .concat(conversations.filter(c => c.teamname))
      .map(c => c.conversationIDKey)

    yield Saga.put(Creators.unboxConversations(toUnbox, 'reloading entire inbox'))
  } finally {
    if (yield Saga.cancelled()) {
      yield Saga.put(Creators.setInboxUntrustedState('unloaded'))
    }
  }
}

function* onGetInboxAndUnbox({
  payload: {conversationIDKeys},
}: Constants.GetInboxAndUnbox): SagaGenerator<any, any> {
  yield Saga.put(Creators.unboxConversations(conversationIDKeys, 'getInboxAndUnbox'))
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
      yield Saga.put(Creators.updateSupersedesState(I.Map({[conversationIDKey]: supersedes})))
    }

    const supersededBy = _toSupersedeInfo(conversationIDKey, c.supersededBy || [])
    if (supersededBy) {
      yield Saga.put(Creators.updateSupersededByState(I.Map({[conversationIDKey]: supersededBy})))
    }

    if (c.finalizeInfo) {
      yield Saga.put(Creators.updateFinalizedState(I.Map({[conversationIDKey]: c.finalizeInfo})))
    }
  }

  const inboxState = _conversationLocalToInboxState(c)

  if (inboxState) {
    yield Saga.put(
      EntityCreators.replaceEntity(['inboxUntrustedState'], I.Map({[conversationIDKey]: 'unboxed'}))
    )

    yield Saga.put(EntityCreators.replaceEntity(['inboxVersion'], I.Map({[conversationIDKey]: c.version})))
    if (isBigTeam) {
      // There's a bug where the untrusted inbox state for the channel is incorrect so we
      // instead make sure that the small team maps and the big team maps don't allow duplicates
      yield Saga.all([
        Saga.put(
          EntityCreators.replaceEntity(
            ['inboxBigChannels'],
            I.Map({[conversationIDKey]: inboxState.channelname})
          )
        ),
        Saga.put(
          EntityCreators.replaceEntity(
            ['inboxBigChannelsToTeam'],
            I.Map({[conversationIDKey]: inboxState.teamname})
          )
        ),
        Saga.put(EntityCreators.deleteEntity(['inboxSmallTimestamps'], I.List([conversationIDKey]))),
      ])
    } else {
      yield Saga.all([
        Saga.put(
          EntityCreators.replaceEntity(
            ['inboxSmallTimestamps'],
            I.Map({[conversationIDKey]: inboxState.time})
          )
        ),
        Saga.put(EntityCreators.deleteEntity(['inboxBigChannels'], I.List([conversationIDKey]))),
        Saga.put(EntityCreators.deleteEntity(['inboxBigChannelsToTeam'], I.List([conversationIDKey]))),
      ])
    }
  }

  if (!isBigTeam && c && c.snippet) {
    const snippet = c.snippet
    yield Saga.put(
      Creators.updateSnippet(conversationIDKey, new HiddenString(Constants.makeSnippet(snippet) || ''))
    )
  }

  if (inboxState) {
    // We blocked it
    if (['blocked', 'reported'].includes(inboxState.status)) {
      yield Saga.put(
        EntityCreators.deleteEntity(['inboxSmallTimestamps'], I.List([inboxState.conversationIDKey]))
      )
      yield Saga.put(EntityCreators.deleteEntity(['inbox'], I.List([inboxState.conversationIDKey])))
    } else {
      yield Saga.put(
        EntityCreators.replaceEntity(['inbox'], I.Map({[inboxState.conversationIDKey]: inboxState}))
      )
    }

    if (!isBigTeam) {
      // inbox loaded so rekeyInfo is now clear
      yield Saga.put(Creators.clearRekey(inboxState.conversationIDKey))
    }

    // Try and load messages if the updated item is the selected one
    const selectedConversation = yield Saga.select(Constants.getSelectedConversation)
    if (selectedConversation === inboxState.conversationIDKey) {
      // load validated selected
      yield Saga.put(Creators.loadMoreMessages(selectedConversation, true))
    }
  }
}

const _chatInboxToProcess = []

function* _chatInboxConversationSubSaga({conv}) {
  const pconv = JSON.parse(conv)
  _chatInboxToProcess.push(pconv)
  yield Saga.put(Creators.unboxMore())
  return EngineRpc.rpcResult()
}

function* unboxMore(): SagaGenerator<any, any> {
  if (!_chatInboxToProcess.length) {
    return
  }

  // the most recent thing you asked for is likely what you want
  // (aka scrolling)
  const conv = _chatInboxToProcess.pop()
  yield Saga.spawn(processConversation, conv)

  if (_chatInboxToProcess.length) {
    yield Saga.call(Saga.delay, 100)
    yield Saga.put(Creators.unboxMore())
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

  yield Saga.put(EntityCreators.replaceEntity(['inboxUntrustedState'], I.Map({[conversationIDKey]: 'error'})))
  yield Saga.put(Creators.updateSnippet(conversationIDKey, new HiddenString(error.message)))
  yield Saga.put(EntityCreators.replaceEntity(['inbox'], I.Map({[conversationIDKey]: conversation})))

  // Mark the conversation as read, to avoid a state where there's a
  // badged conversation that can't be unbadged by clicking on it.
  const {maxMsgid} = error.remoteConv.readerInfo
  const selectedConversation = yield Saga.select(Constants.getSelectedConversation)
  if (maxMsgid && selectedConversation === conversationIDKey) {
    try {
      yield Saga.call(ChatTypes.localMarkAsReadLocalRpcPromise, {
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
      yield Saga.put(Creators.updateInboxRekeySelf(conversationIDKey))
      break
    }
    case ChatTypes.LocalConversationErrorType.otherrekeyneeded: {
      const rekeyers = error.rekeyInfo.rekeyers
      yield Saga.put(Creators.updateInboxRekeyOthers(conversationIDKey, rekeyers))
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
      yield Saga.put({
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

  const untrustedState = yield Saga.select(state => state.entities.inboxUntrustedState)
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
  yield Saga.put.resolve(EntityCreators.replaceEntity(['inboxUntrustedState'], I.Map(newUntrustedState)))

  conversationIDKeys = newConvIDKeys
  if (!conversationIDKeys.length) {
    return
  }
  console.log(`unboxConversations: unboxing ${conversationIDKeys.length} convs, because: ${reason}`)

  // If we've been asked to unbox something and we don't have a selected thing, lets make it selected (on desktop)
  if (!isMobile) {
    const selected = yield Saga.select(Constants.getSelectedConversation)
    if (!selected) {
      yield Saga.put(Creators.selectConversation(conversationIDKeys[0], false))
    }
  }

  const loadInboxRpc = new EngineRpc.EngineRpcCall(
    unboxConversationsSagaMap,
    ChatTypes.localGetInboxNonblockLocalRpcChannelMap,
    'unboxConversations',
    {
      param: {
        identifyBehavior: RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui,
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
    yield Saga.put(Creators.setInboxUntrustedState('loaded'))
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
      atmention: settings[RPCTypes.CommonDeviceType.desktop.toString()][
        ChatTypes.CommonNotificationKind.atmention.toString()
      ],
      generic: settings[RPCTypes.CommonDeviceType.desktop.toString()][
        ChatTypes.CommonNotificationKind.generic.toString()
      ],
    },
    mobile: {
      atmention: settings[RPCTypes.CommonDeviceType.mobile.toString()][
        ChatTypes.CommonNotificationKind.atmention.toString()
      ],
      generic: settings[RPCTypes.CommonDeviceType.mobile.toString()][
        ChatTypes.CommonNotificationKind.generic.toString()
      ],
    },
  }
}

// Convert server to our data type
function _conversationLocalToInboxState(c: ?ChatTypes.InboxUIItem): ?Constants.InboxState {
  if (
    !c ||
    c.visibility !== RPCTypes.CommonTLFVisibility.private || // private chats only
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

  const selected = yield Saga.select(Constants.getSelectedConversation)

  const idx = rows.findIndex(r => r.conversationIDKey === selected)
  let nextIdx
  if (idx === -1) {
    nextIdx = 0
  } else {
    nextIdx = Math.min(rows.length - 1, Math.max(0, idx + direction))
  }
  const r = rows[nextIdx]
  if (r && r.conversationIDKey) {
    yield Saga.put(Creators.selectConversation(r.conversationIDKey, false))
  }
}

function* _sendNotifications(action: Constants.AppendMessages): Saga.SagaGenerator<any, any> {
  const appFocused = yield Saga.select(Shared.focusedSelector)
  const selectedTab = yield Saga.select(Shared.routeSelector)
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
    const me = yield Saga.select(Selectors.usernameSelector)
    const message = action.payload.messages.reverse().find(m => m.type === 'Text' && m.author !== me)
    // Is this message part of a muted conversation? If so don't notify.
    const convo = yield Saga.select(Constants.getInbox, action.payload.conversationIDKey)
    if (convo && convo.get('status') !== 'muted') {
      if (message && message.type === 'Text') {
        console.log('Sending Chat notification')
        const snippet = Constants.makeSnippet(Constants.serverMessageToMessageText(message))
        yield Saga.put((dispatch: Dispatch) => {
          NotifyPopup(message.author, {body: snippet}, -1, message.author, () => {
            dispatch(Creators.selectConversation(action.payload.conversationIDKey, false))
            dispatch(switchTo([chatTab]))
            dispatch(showMainWindow())
          })
        })
      }
    }
  }
}

function* _markThreadsStale(action: Constants.MarkThreadsStale): Saga.SagaGenerator<any, any> {
  // Load inbox items of any stale items so we get update on rekeyInfos, etc
  const {updates} = action.payload
  const convIDs = updates.map(u => Constants.conversationIDToKey(u.convID))
  yield Saga.put(Creators.unboxConversations(convIDs, 'thread stale', true))

  // Selected is stale?
  const selectedConversation = yield Saga.select(Constants.getSelectedConversation)
  if (!selectedConversation) {
    return
  }
  yield Saga.put(Creators.clearMessages(selectedConversation))
  yield Saga.put(Creators.loadMoreMessages(selectedConversation, false))
}

function* _inboxSynced(action: Constants.InboxSynced): Saga.SagaGenerator<any, any> {
  const {convs} = action.payload
  const author = yield Saga.select(Selectors.usernameSelector)
  const items = Shared.makeInboxStateRecords(author, convs, I.Map())

  yield Saga.put(
    EntityCreators.replaceEntity(
      ['inbox'],
      I.Map(
        items.reduce((map, c) => {
          map[c.conversationIDKey] = c
          return map
        }, {})
      )
    )
  )
  const convIDs = items.map(item => item.conversationIDKey)
  yield Saga.put(Creators.unboxConversations(convIDs, 'inbox syncing', true, true))

  const selectedConversation = yield Saga.select(Constants.getSelectedConversation)
  if (!selectedConversation || convIDs.indexOf(selectedConversation) < 0) {
    return
  }

  const conversation = yield Saga.select(Constants.getSelectedConversationStates)
  if (conversation) {
    const inbox = yield Saga.select(Constants.getInbox, selectedConversation)

    const messageKeys = yield Saga.select(Constants.getConversationMessages, selectedConversation)
    const lastMessageKey = messageKeys.last()
    let numberOverride
    if (lastMessageKey) {
      const lastMessage = yield Saga.select(Constants.getMessageFromMessageKey, lastMessageKey)
      // Check to see if we could possibly be asking for too many messages
      if (lastMessage && lastMessage.rawMessageID && inbox && inbox.maxMsgID) {
        numberOverride = inbox.maxMsgID - lastMessage.rawMessageID

        if (numberOverride > tooManyMessagesToJustAppendOnStale) {
          console.log(
            'Doing a full load due to too many old messages',
            inbox.maxMsgID - lastMessage.rawMessageID
          )
          yield Saga.all([
            Saga.put(Creators.clearMessages(selectedConversation)),
            yield Saga.put(Creators.loadMoreMessages(selectedConversation, false)),
          ])
          return
        }
      }
    }
    // It is VERY important to pass the exact number of things to request here. The pagination system will
    // return whatever number we ask for on newest messages due to its architecture so if we want only N
    // newer items we have to explictly ask for N or it will give us messages older than onyNewerThan
    yield Saga.put(Creators.loadMoreMessages(selectedConversation, false, false, true, numberOverride))
  }
}
function* _badgeAppForChat(action: Constants.BadgeAppForChat): Saga.SagaGenerator<any, any> {
  const conversations = action.payload
  let totals: {[key: string]: number} = {}
  let badges: {[key: string]: number} = {}

  conversations.forEach(conv => {
    const total = conv.get('unreadMessages')
    if (total) {
      const badged = conv.get('badgeCounts')[
        `${isMobile ? RPCTypes.CommonDeviceType.mobile : RPCTypes.CommonDeviceType.desktop}`
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

  const oldBadge = yield Saga.select(s => s.entities.inboxUnreadCountBadge)
  const oldTotal = yield Saga.select(s => s.entities.inboxUnreadCountTotal)
  if (!I.is(oldBadge, badges)) {
    yield Saga.put(EntityCreators.replaceEntity([], I.Map({inboxUnreadCountBadge: badges})))
  }
  if (!I.is(oldTotal, totals)) {
    yield Saga.put(EntityCreators.replaceEntity([], I.Map({inboxUnreadCountTotal: totals})))
  }
}

function _updateSnippet({payload: {snippet, conversationIDKey}}: Constants.UpdateSnippet) {
  return Saga.put(EntityCreators.replaceEntity(['convIDToSnippet'], I.Map({[conversationIDKey]: snippet})))
}

function* registerSagas(): SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure('chat:updateSnippet', _updateSnippet)
  yield Saga.safeTakeEvery('chat:getInboxAndUnbox', onGetInboxAndUnbox)
  yield Saga.safeTakeEvery('chat:inboxFilterSelectNext', filterSelectNext)
  yield Saga.safeTakeLatest('chat:inboxStale', onInboxStale)
  yield Saga.safeTakeLatest('chat:loadInbox', onInboxLoad)
  yield Saga.safeTakeLatest('chat:unboxMore', unboxMore)
  yield Saga.safeTakeSerially('chat:unboxConversations', unboxConversations)
  yield Saga.safeTakeEvery('chat:appendMessages', _sendNotifications)
  yield Saga.safeTakeEvery('chat:markThreadsStale', _markThreadsStale)
  yield Saga.safeTakeEvery('chat:inboxSynced', _inboxSynced)
  yield Saga.safeTakeLatest('chat:badgeAppForChat', _badgeAppForChat)
}

export {
  registerSagas,
  // TODO remove these as raw things to call, replace with actions
  parseNotifications,
  processConversation,
}
