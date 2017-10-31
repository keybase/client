// @flow
// Actions that have to do with managing a thread.
// Mute, block, starting a new one, selecting one
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as ChatGen from '../../actions/chat-gen'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as SearchCreators from '../search/creators'
import * as Selectors from '../../constants/selectors'
import * as Shared from './shared'
import {chatTab} from '../../constants/tabs'
import {navigateTo, switchTo} from '../route-tree'
import {type SagaGenerator} from '../../constants/types/saga'
import {type TypedState} from '../../constants/reducer'

const inSearchSelector = (state: TypedState) => state.chat.get('inSearch')
const inboxSelector = (state: TypedState) => state.chat.get('inbox')

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
    yield Saga.put(ChatGen.createSelectConversation({conversationIDKey: newID}))
  } else if (existing) {
    // Select existing conversations
    yield Saga.put(
      ChatGen.createSelectConversation({
        conversationIDKey: existing.get('conversationIDKey'),
      })
    )
    yield Saga.put(switchTo([chatTab]))
  } else {
    // Make a pending conversation so it appears in the inbox
    const conversationIDKey = Constants.pendingConversationIDKey(tlfName)
    yield Saga.put(ChatGen.createAddPending({participants: users, temporary}))
    yield Saga.put(ChatGen.createSelectConversation({conversationIDKey}))
    yield Saga.put(switchTo([chatTab]))
  }
}

function* _selectConversation(action: ChatGen.SelectConversationPayload): Saga.SagaGenerator<any, any> {
  const {conversationIDKey, fromUser} = action.payload

  // Always show this in the inbox
  if (conversationIDKey) {
    yield Saga.put(
      ChatGen.createMergeEntity({keyPath: ['inboxAlwaysShow'], entities: I.Map({[conversationIDKey]: true})})
    )
  }

  if (fromUser) {
    yield Saga.put(ChatGen.createExitSearch({skipSelectPreviousConversation: true}))
  }

  // Load the inbox item always
  if (conversationIDKey) {
    yield Saga.put(ChatGen.createGetInboxAndUnbox({conversationIDKeys: [conversationIDKey]}))
  }

  const oldConversationState = yield Saga.select(Shared.conversationStateSelector, conversationIDKey)
  if (oldConversationState && oldConversationState.get('isStale') && conversationIDKey) {
    yield Saga.put(ChatGen.createClearMessages({conversationIDKey}))
  }

  const inbox = yield Saga.select(Constants.getInbox, conversationIDKey)
  const inSearch = yield Saga.select(inSearchSelector)
  if (inbox && !inbox.teamname) {
    const participants = inbox.get('participants').toArray()
    yield Saga.put(ChatGen.createUpdateMetadata({users: participants}))
    // Update search but don't update the filter
    if (inSearch) {
      const me = yield Saga.select(Selectors.usernameSelector)
      yield Saga.put(SearchCreators.setUserInputItems('chatSearch', participants.filter(u => u !== me)))
    }
  }

  if (conversationIDKey) {
    yield Saga.put(ChatGen.createLoadMoreMessages({conversationIDKey, onlyIfUnloaded: true, fromUser}))
    yield Saga.put(navigateTo([conversationIDKey], [chatTab]))
  } else {
    yield Saga.put(navigateTo([chatTab]))
  }

  // Do this here because it's possible loadMoreMessages bails early
  // but there are still unread messages that need to be marked as read
  if (fromUser && conversationIDKey) {
    yield Saga.put(ChatGen.createUpdateBadging({conversationIDKey}))
    yield Saga.put(ChatGen.createUpdateLatestMessage({conversationIDKey}))
  }
}

const _setNotifications = function*(
  action:
    | ChatGen.SetNotificationsPayload
    | ChatGen.ToggleChannelWideNotificationsPayload
    | ChatGen.UpdatedNotificationsPayload
) {
  const {payload: {conversationIDKey}} = action

  // update the one in the store
  const old = yield Saga.select(s => s.inbox.get(conversationIDKey))
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
      ChatGen.createReplaceEntity({
        keyPath: ['inbox', conversationIDKey],
        entities: old.set('notifications', {
          ...old.notifications,
          ...nextNotifications,
        }),
      })
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

function* _blockConversation(action: ChatGen.BlockConversationPayload): Saga.SagaGenerator<any, any> {
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

function* _leaveConversation(action: ChatGen.LeaveConversationPayload): Saga.SagaGenerator<any, any> {
  const {conversationIDKey} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  yield Saga.call(ChatTypes.localLeaveConversationLocalRpcPromise, {
    param: {convID: conversationID},
  })
}

function* _muteConversation(action: ChatGen.MuteConversationPayload): Saga.SagaGenerator<any, any> {
  const {conversationIDKey, muted} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const status = muted ? ChatTypes.CommonConversationStatus.muted : ChatTypes.CommonConversationStatus.unfiled
  const identifyBehavior: RPCTypes.TLFIdentifyBehavior = RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui
  yield Saga.call(ChatTypes.localSetConversationStatusLocalRpcPromise, {
    param: {conversationID, identifyBehavior, status},
  })
}

function* registerSagas(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('chat:leaveConversation', _leaveConversation)
  yield Saga.safeTakeEvery('chat:muteConversation', _muteConversation)
  yield Saga.safeTakeEvery('chat:startConversation', _startConversation)
  yield Saga.safeTakeLatest('chat:selectConversation', _selectConversation)
  yield Saga.safeTakeEvery(
    ['chat:setNotifications', 'chat:updatedNotifications', 'chat:toggleChannelWideNotifications'],
    _setNotifications
  )
  yield Saga.safeTakeEvery('chat:blockConversation', _blockConversation)
}

export {registerSagas}
