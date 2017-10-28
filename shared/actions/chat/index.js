// @flow
import * as Attachment from './attachment'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as SearchCreators from '../search/creators'
import * as Conversation from './conversation'
import * as Creators from './creators'
import * as EntityCreators from '../entities'
import * as I from 'immutable'
import * as Inbox from './inbox'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Selectors from '../../constants/selectors'
import * as SendMessages from './send-messages'
import * as Search from './search'
import * as Shared from './shared'
import engine from '../../engine'
import some from 'lodash/some'
import {NotifyPopup} from '../../native/notifications'
import {chatTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {navigateTo, switchTo} from '../route-tree'
import {openInKBFS} from '../kbfs'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {publicFolderWithUsers, privateFolderWithUsers, teamFolder} from '../../constants/config'
import {showMainWindow} from '../platform-specific'
import type {ChangedFocus, ChangedActive} from '../../constants/app'
import type {TypedState} from '../../constants/reducer'

const inSearchSelector = (state: TypedState) => state.chat.get('inSearch')

// How many messages we consider too many to just download when you are stale and we could possibly just append
const tooManyMessagesToJustAppendOnStale = 200

function* _incomingTyping(action: Constants.IncomingTyping): Saga.SagaGenerator<any, any> {
  // $FlowIssue
  for (const activity of action.payload.activity) {
    const conversationIDKey = Constants.conversationIDToKey(activity.convID)
    const typers = activity.typers || []
    const typing = typers.map(typer => typer.username)
    yield Saga.put(Creators.setTypers(conversationIDKey, typing))
  }
}

function* _setupChatHandlers(): Saga.SagaGenerator<any, any> {
  engine().setIncomingActionCreator('chat.1.NotifyChat.NewChatActivity', ({activity}) =>
    Creators.incomingMessage(activity)
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatTypingUpdate', ({typingUpdates}) =>
    Creators.incomingTyping(typingUpdates)
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatIdentifyUpdate', ({update}) => {
    const usernames = update.CanonicalName.split(',')
    const broken = (update.breaks.breaks || []).map(b => b.user.username)
    const userToBroken = usernames.reduce((map, name) => {
      map[name] = !!broken.includes(name)
      return map
    }, {})
    return Creators.updateBrokenTracker(userToBroken)
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatTLFFinalize', ({convID}) =>
    Creators.getInboxAndUnbox([Constants.conversationIDToKey(convID)])
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxStale', () =>
    Creators.inboxStale('service invoked')
  )

  engine().setIncomingActionCreator(
    'chat.1.NotifyChat.ChatTLFResolve',
    ({convID, resolveInfo: {newTLFName}}) => Creators.inboxStale('TLF resolve notification')
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatThreadsStale', ({updates}) => {
    if (updates) {
      return Creators.markThreadsStale(updates)
    }
    return null
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxSynced', ({syncRes}) => {
    switch (syncRes.syncType) {
      case ChatTypes.CommonSyncInboxResType.clear:
        return Creators.inboxStale('sync with clear result')
      case ChatTypes.CommonSyncInboxResType.current:
        return Creators.setInboxUntrustedState('loaded')
      case ChatTypes.CommonSyncInboxResType.incremental:
        return Creators.inboxSynced(syncRes.incremental.items)
    }
    return Creators.inboxStale('sync with unknown result')
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxSyncStarted', () => {
    return Creators.setInboxUntrustedState('loading')
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatJoinedConversation', () =>
    Creators.inboxStale('joined a conversation')
  )
  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatLeftConversation', () =>
    Creators.inboxStale('left a conversation')
  )
}

const inboxSelector = (state: TypedState) => state.entities.get('inbox')

function* _openTlfInChat(action: Constants.OpenTlfInChat): Saga.SagaGenerator<any, any> {
  const tlf = action.payload
  const me = yield Saga.select(Selectors.usernameSelector)
  const userlist = parseFolderNameToUsers(me, tlf)
  const users = userlist.map(u => u.username)
  if (some(userlist, 'readOnly')) {
    console.warn('Bug: openTlfToChat should never be called on a convo with readOnly members.')
    return
  }
  yield Saga.put(Creators.startConversation(users))
}

function* _startConversation(action: Constants.StartConversation): Saga.SagaGenerator<any, any> {
  const {users, forceImmediate, temporary} = action.payload
  const me = yield Saga.select(Selectors.usernameSelector)

  if (!users.includes(me)) {
    users.push(me)
    console.warn('Attempted to start a chat without the current user')
  }

  // not effecient but only happens when you start a new convo and not over and over
  const tlfName = users.sort().join(',')
  const inbox = yield Saga.select(inboxSelector)
  const existing = inbox.find(
    state =>
      state.get('membersType') === ChatTypes.CommonConversationMembersType.kbfs &&
      state.get('participants').sort().join(',') === tlfName
  )

  if (forceImmediate && existing) {
    const newID = yield Saga.call(Shared.startNewConversation, existing.get('conversationIDKey'))
    yield Saga.put(Creators.selectConversation(newID, false))
  } else if (existing) {
    // Select existing conversations
    yield Saga.put(Creators.selectConversation(existing.get('conversationIDKey'), false))
    yield Saga.put(switchTo([chatTab]))
  } else {
    // Make a pending conversation so it appears in the inbox
    const conversationIDKey = Constants.pendingConversationIDKey(tlfName)
    yield Saga.put(Creators.addPending(users, temporary))
    yield Saga.put(Creators.selectConversation(conversationIDKey, false))
    yield Saga.put(switchTo([chatTab]))
  }
}

function* _openFolder(): Saga.SagaGenerator<any, any> {
  const conversationIDKey = yield Saga.select(Constants.getSelectedConversation)

  const inbox = yield Saga.select(Constants.getInbox, conversationIDKey)
  if (inbox) {
    let path
    if (inbox.membersType === ChatTypes.CommonConversationMembersType.team) {
      path = teamFolder(inbox.teamname)
    } else {
      const helper = inbox.visibility === RPCTypes.CommonTLFVisibility.public
        ? publicFolderWithUsers
        : privateFolderWithUsers
      path = helper(inbox.get('participants').toArray())
    }
    yield Saga.put(openInKBFS(path))
  } else {
    throw new Error(`Can't find conversation path`)
  }
}

function* _updateMetadata(action: Constants.UpdateMetadata): Saga.SagaGenerator<any, any> {
  // Don't send sharing before signup values
  const metaData = yield Saga.select(Shared.metaDataSelector)
  const usernames = action.payload.users.filter(
    name =>
      metaData.getIn([name, 'fullname']) === undefined && name.indexOf('@') === -1 && name.indexOf('#') === -1
  )
  if (!usernames.length) {
    return
  }

  try {
    const results: any = yield Saga.call(RPCTypes.apiserverGetRpcPromise, {
      param: {
        endpoint: 'user/lookup',
        args: [{key: 'usernames', value: usernames.join(',')}, {key: 'fields', value: 'profile'}],
      },
    })

    const parsed = JSON.parse(results.body)
    const payload = {}
    usernames.forEach((username, idx) => {
      const record = parsed.them[idx]
      const fullname = (record && record.profile && record.profile.full_name) || ''
      payload[username] = Constants.makeMetaData({fullname})
    })

    yield Saga.put(Creators.updatedMetadata(payload))
  } catch (err) {
    if (err && err.code === RPCTypes.ConstantsStatusCode.scapinetworkerror) {
      // Ignore api errors due to offline
    } else {
      throw err
    }
  }
}

function* _selectConversation(action: Constants.SelectConversation): Saga.SagaGenerator<any, any> {
  const {conversationIDKey, fromUser} = action.payload

  // Always show this in the inbox
  if (conversationIDKey) {
    yield Saga.put(EntityCreators.mergeEntity(['inboxAlwaysShow'], I.Map({[conversationIDKey]: true})))
  }

  if (fromUser) {
    yield Saga.put(Creators.exitSearch(true))
  }

  // Load the inbox item always
  if (conversationIDKey) {
    yield Saga.put(Creators.getInboxAndUnbox([conversationIDKey]))
  }

  const oldConversationState = yield Saga.select(Shared.conversationStateSelector, conversationIDKey)
  if (oldConversationState && oldConversationState.get('isStale') && conversationIDKey) {
    yield Saga.put(Creators.clearMessages(conversationIDKey))
  }

  const inbox = yield Saga.select(Constants.getInbox, conversationIDKey)
  const inSearch = yield Saga.select(inSearchSelector)
  if (inbox && !inbox.teamname) {
    const participants = inbox.get('participants').toArray()
    yield Saga.put(Creators.updateMetadata(participants))
    // Update search but don't update the filter
    if (inSearch) {
      const me = yield Saga.select(Selectors.usernameSelector)
      yield Saga.put(SearchCreators.setUserInputItems('chatSearch', participants.filter(u => u !== me)))
    }
  }

  if (conversationIDKey) {
    yield Saga.put(Creators.loadMoreMessages(conversationIDKey, true, fromUser))
    yield Saga.put(navigateTo([conversationIDKey], [chatTab]))
  } else {
    yield Saga.put(navigateTo([chatTab]))
  }

  // Do this here because it's possible loadMoreMessages bails early
  // but there are still unread messages that need to be marked as read
  if (fromUser && conversationIDKey) {
    yield Saga.put(Creators.updateBadging(conversationIDKey))
    yield Saga.put(Creators.updateLatestMessage(conversationIDKey))
  }
}

function* _blockConversation(action: Constants.BlockConversation): Saga.SagaGenerator<any, any> {
  const {blocked, conversationIDKey, reportUser} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  if (blocked) {
    const status = reportUser
      ? ChatTypes.CommonConversationStatus.reported
      : ChatTypes.CommonConversationStatus.blocked
    const identifyBehavior: RPCTypes.TLFIdentifyBehavior = RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui
    yield Saga.call(ChatTypes.localSetConversationStatusLocalRpcPromise, {
      param: {conversationID, identifyBehavior, status},
    })
  }
}

function* _leaveConversation(action: Constants.LeaveConversation): Saga.SagaGenerator<any, any> {
  const {conversationIDKey} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  yield Saga.call(ChatTypes.localLeaveConversationLocalRpcPromise, {
    param: {convID: conversationID},
  })
}

function* _muteConversation(action: Constants.MuteConversation): Saga.SagaGenerator<any, any> {
  const {conversationIDKey, muted} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const status = muted ? ChatTypes.CommonConversationStatus.muted : ChatTypes.CommonConversationStatus.unfiled
  const identifyBehavior: RPCTypes.TLFIdentifyBehavior = RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui
  yield Saga.call(ChatTypes.localSetConversationStatusLocalRpcPromise, {
    param: {conversationID, identifyBehavior, status},
  })
}

function* _changedFocus(action: ChangedFocus): Saga.SagaGenerator<any, any> {
  // Update badging and the latest message due to the refocus.
  const {appFocused} = action.payload
  const conversationIDKey = yield Saga.select(Constants.getSelectedConversation)
  const selectedTab = yield Saga.select(Shared.routeSelector)
  const chatTabSelected = selectedTab === chatTab
  if (conversationIDKey && chatTabSelected) {
    if (appFocused) {
      yield Saga.put(Creators.updateBadging(conversationIDKey))
    } else {
      // Reset the orange line when focus leaves the app.
      yield Saga.put(Creators.updateLatestMessage(conversationIDKey))
    }
  }
}

function* _changedActive(action: ChangedActive): Saga.SagaGenerator<any, any> {
  // Update badging and the latest message due to changing active state.
  const {userActive} = action.payload
  const appFocused = yield Saga.select(Shared.focusedSelector)
  const conversationIDKey = yield Saga.select(Constants.getSelectedConversation)
  const selectedTab = yield Saga.select(Shared.routeSelector)
  const chatTabSelected = selectedTab === chatTab
  // Only do this if focus is retained - otherwise, focus changing logic prevails
  if (conversationIDKey && chatTabSelected && appFocused) {
    if (userActive) {
      yield Saga.put(Creators.updateBadging(conversationIDKey))
    } else {
      // Reset the orange line when becoming inactive
      yield Saga.put(Creators.updateLatestMessage(conversationIDKey))
    }
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

function _removeOutboxMessage(
  {payload: {conversationIDKey, outboxID}}: Constants.RemoveOutboxMessage,
  msgKeys: I.OrderedSet<Constants.MessageKey>
) {
  const nextMessages = msgKeys.filter(k => {
    const {messageID} = Constants.splitMessageIDKey(k)
    return messageID !== outboxID
  })

  if (nextMessages.equals(msgKeys)) {
    return
  }
  return Saga.put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
  )
}

function* _updateOutboxMessageToReal({
  payload: {oldMessageKey, newMessageKey},
}: Constants.OutboxMessageBecameReal) {
  const localMessageState = yield Saga.select(Constants.getLocalMessageStateFromMessageKey, oldMessageKey)
  const conversationIDKey = Constants.messageKeyConversationIDKey(newMessageKey)
  const currentMessages = yield Saga.select(Constants.getConversationMessages, conversationIDKey)
  const nextMessages = currentMessages.map(k => (k === oldMessageKey ? newMessageKey : k))
  yield Saga.all([
    Saga.put(
      EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
    ),
    Saga.put(
      EntityCreators.mergeEntity(
        [],
        I.Map({
          attachmentDownloadedPath: I.Map({[newMessageKey]: localMessageState.downloadedPath}),
          attachmentPreviewPath: I.Map({[newMessageKey]: localMessageState.previewPath}),
          attachmentPreviewProgress: I.Map({[newMessageKey]: localMessageState.previewProgress}),
          attachmentDownloadProgress: I.Map({[newMessageKey]: localMessageState.downloadProgress}),
          attachmentUploadProgress: I.Map({[newMessageKey]: localMessageState.uploadProgress}),
        })
      )
    ),
  ])
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

function* _openConversation({
  payload: {conversationIDKey},
}: Constants.OpenConversation): Saga.SagaGenerator<any, any> {
  yield Saga.put(Creators.selectConversation(conversationIDKey, false))
}

function* _updateTyping({
  payload: {conversationIDKey, typing},
}: Constants.UpdateTyping): Saga.SagaGenerator<any, any> {
  // Send we-are-typing info up to Gregor.
  if (!Constants.isPendingConversationIDKey(conversationIDKey)) {
    const conversationID = Constants.keyToConversationID(conversationIDKey)
    yield Saga.call(ChatTypes.localUpdateTypingRpcPromise, {
      param: {conversationID, typing},
    })
  }
}

const _setNotifications = function*(
  action:
    | Constants.SetNotifications
    | Constants.ToggleChannelWideNotifications
    | Constants.UpdatedNotifications
) {
  const {payload: {conversationIDKey}} = action

  // update the one in the store
  const old = yield Saga.select(s => s.entities.inbox.get(conversationIDKey))
  if (old) {
    let nextNotifications = {}

    if (action.type === 'chat:setNotifications') {
      const {payload: {deviceType, notifyType}} = action

      // This is the flip-side of the logic in the notifications container.
      if (old.notifications && old.notifications[deviceType]) {
        nextNotifications = {[deviceType]: {}}
        switch (notifyType) {
          case 'generic':
            nextNotifications[deviceType].generic = true
            nextNotifications[deviceType].atmention = true
            break
          case 'atmention':
            nextNotifications[deviceType].generic = false
            nextNotifications[deviceType].atmention = true
            break
          case 'never':
            nextNotifications[deviceType].generic = false
            nextNotifications[deviceType].atmention = false
            break
        }
      }
    } else if (action.type === 'chat:toggleChannelWideNotifications') {
      nextNotifications = {channelWide: !old.notifications.channelWide}
    } else if (action.type === 'chat:updatedNotifications') {
      nextNotifications = action.payload.notifications
    }

    yield Saga.put.resolve(
      EntityCreators.replaceEntity(
        ['inbox', conversationIDKey],
        old.set('notifications', {
          ...old.notifications,
          ...nextNotifications,
        })
      )
    )
  }

  // Send out the update if we made it
  if (action.type !== 'chat:updatedNotifications') {
    const inbox = yield Saga.select(Constants.getInbox, conversationIDKey)
    if (inbox && inbox.notifications) {
      const {notifications} = inbox
      const param = {
        convID: Constants.keyToConversationID(conversationIDKey),
        channelWide: notifications.channelWide,
        settings: [
          {
            deviceType: RPCTypes.CommonDeviceType.desktop,
            kind: ChatTypes.CommonNotificationKind.atmention,
            enabled: notifications.desktop.atmention,
          },
          {
            deviceType: RPCTypes.CommonDeviceType.desktop,
            kind: ChatTypes.CommonNotificationKind.generic,
            enabled: notifications.desktop.generic,
          },
          {
            deviceType: RPCTypes.CommonDeviceType.mobile,
            kind: ChatTypes.CommonNotificationKind.atmention,
            enabled: notifications.mobile.atmention,
          },
          {
            deviceType: RPCTypes.CommonDeviceType.mobile,
            kind: ChatTypes.CommonNotificationKind.generic,
            enabled: notifications.mobile.generic,
          },
        ],
      }
      yield Saga.call(ChatTypes.localSetAppNotificationSettingsLocalRpcPromise, {param})
    }
  }
}

function* chatSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.fork(Inbox.registerSagas)
  yield Saga.fork(SendMessages.registerSagas)
  yield Saga.fork(Attachment.registerSagas)
  yield Saga.fork(Conversation.registerSagas)
  yield Saga.fork(Search.registerSagas)

  yield Saga.safeTakeEvery('app:changedFocus', _changedFocus)
  yield Saga.safeTakeEvery('app:changedActive', _changedActive)
  yield Saga.safeTakeEvery('chat:appendMessages', _sendNotifications)
  yield Saga.safeTakeEveryPure('chat:updateSnippet', _updateSnippet)
  yield Saga.safeTakeEveryPure(
    'chat:removeOutboxMessage',
    _removeOutboxMessage,
    (s: TypedState, a: Constants.RemoveOutboxMessage) =>
      Constants.getConversationMessages(s, a.payload.conversationIDKey)
  )
  yield Saga.safeTakeEvery('chat:outboxMessageBecameReal', _updateOutboxMessageToReal)
  yield Saga.safeTakeEvery('chat:blockConversation', _blockConversation)
  yield Saga.safeTakeEvery('chat:incomingTyping', _incomingTyping)
  yield Saga.safeTakeEvery('chat:leaveConversation', _leaveConversation)
  yield Saga.safeTakeEvery('chat:markThreadsStale', _markThreadsStale)
  yield Saga.safeTakeEvery('chat:inboxSynced', _inboxSynced)
  yield Saga.safeTakeEvery('chat:muteConversation', _muteConversation)
  yield Saga.safeTakeEvery('chat:openConversation', _openConversation)
  yield Saga.safeTakeEvery('chat:openFolder', _openFolder)
  yield Saga.safeTakeEvery('chat:openTlfInChat', _openTlfInChat)
  yield Saga.safeTakeEvery('chat:setupChatHandlers', _setupChatHandlers)
  yield Saga.safeTakeEvery('chat:startConversation', _startConversation)
  yield Saga.safeTakeEvery('chat:updateMetadata', _updateMetadata)
  yield Saga.safeTakeEvery('chat:updateTyping', _updateTyping)
  yield Saga.safeTakeLatest('chat:badgeAppForChat', _badgeAppForChat)
  yield Saga.safeTakeLatest('chat:selectConversation', _selectConversation)
  yield Saga.safeTakeEvery(
    ['chat:setNotifications', 'chat:updatedNotifications', 'chat:toggleChannelWideNotifications'],
    _setNotifications
  )
}

export default chatSaga

export {badgeAppForChat, openTlfInChat, setupChatHandlers, startConversation} from './creators'
