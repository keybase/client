// @flow
// Actions that have to do with managing a thread.
// Mute, block, starting a new one, selecting one
import logger from '../../logger'
import * as ChatTypes from '../../constants/types/rpc-chat-gen'
import * as Constants from '../../constants/chat'
import * as ChatGen from '../../actions/chat-gen'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as SearchGen from '../search-gen'
import * as Selectors from '../../constants/selectors'
import * as Shared from './shared'
import uniq from 'lodash/uniq'
import {chatTab} from '../../constants/tabs'
import {navigateTo, switchTo} from '../route-tree'
import {type SagaGenerator} from '../../constants/types/saga'
import {type TypedState} from '../../constants/reducer'

function* _startConversation(action: ChatGen.StartConversationPayload): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  if (!action.payload.forSearch) {
    const inSearch = state.chat.get('inSearch')
    if (inSearch) {
      yield Saga.put(ChatGen.createExitSearch({skipSelectPreviousConversation: true}))
    }
  }

  const users = uniq(action.payload.users)
  const temporary = action.payload.temporary || false
  const forceImmediate = action.payload.forceImmediate || false
  const me = Selectors.usernameSelector(state)

  if (!me) {
    logger.warn('start convo loggedout?')
    return
  }

  if (!users.includes(me)) {
    users.push(me)
    logger.warn('Attempted to start a chat without the current user')
  }

  // not effecient but only happens when you start a new convo and not over and over
  const tlfName = users.sort().join(',')
  const inbox = state.chat.get('inbox')
  const existing = inbox.find(
    state =>
      state.get('membersType') === ChatTypes.commonConversationMembersType.kbfs &&
      state
        .get('participants')
        .sort()
        .join(',') === tlfName
  )

  if (forceImmediate && existing) {
    const newID = yield Saga.call(Shared.startNewConversation, existing.get('conversationIDKey'))
    if (!newID[0]) {
      throw new Error('Unable to get new conversation ID')
    }
    yield Saga.put(ChatGen.createSelectConversation({conversationIDKey: newID[0]}))
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

  logger.info(`selectConversation: selecting: ${conversationIDKey || ''}`)
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

  const state: TypedState = yield Saga.select()
  let oldConversationState
  if (conversationIDKey) {
    oldConversationState = Shared.conversationStateSelector(state, conversationIDKey)
  }
  if (oldConversationState && oldConversationState.get('isStale') && conversationIDKey) {
    logger.info(`selectConversation: clearing because stale: ${conversationIDKey || ''}`)
    yield Saga.put(ChatGen.createClearMessages({conversationIDKey}))
  }

  const inbox = Constants.getInbox(state, conversationIDKey)
  const inSearch = state.chat.get('inSearch')
  if (inbox && !inbox.teamname) {
    const participants = inbox.get('participants').toArray()
    yield Saga.put(ChatGen.createUpdateMetadata({users: participants}))
    // Update search but don't update the filter
    if (inSearch) {
      const me = Selectors.usernameSelector(state)
      yield Saga.put(
        SearchGen.createSetUserInputItems({
          searchKey: 'chatSearch',
          searchResults: participants.filter(u => u !== me),
        })
      )
    }
  }

  if (conversationIDKey) {
    logger.info(`selectConversation: starting load more messages: ${conversationIDKey || ''}`)
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

function _selectOrPreviewConversation(action: ChatGen.SelectOrPreviewConversationPayload, state: TypedState) {
  const {conversationIDKey, previousPath} = action.payload

  const inbox = state.chat.getIn(['inbox', conversationIDKey])
  if (inbox) {
    logger.info(`selectOrPreviewConversation: selecting: ${conversationIDKey}`)
    return Saga.put(ChatGen.createSelectConversation({conversationIDKey, fromUser: true}))
  } else {
    logger.info(`selectOrPreviewConversation: previewing: ${conversationIDKey}`)
    return Saga.sequentially([
      Saga.put(ChatGen.createPreviewChannel({conversationIDKey})),
      Saga.put(navigateTo([chatTab, {selected: conversationIDKey, props: {previousPath}}])),
    ])
  }
}

const _openTeamConversation = function*(action: ChatGen.OpenTeamConversationPayload) {
  // TODO handle channels you're not a member of, or small teams you've never opened the chat for.
  const {payload: {teamname, channelname}} = action
  let state = yield Saga.select()
  if (state.chat.inboxGlobalUntrustedState === 'unloaded') {
    yield Saga.put(ChatGen.createInboxStale({reason: 'Navigating to team channel'}))
    yield Saga.take(ChatGen.inboxStoreLoaded)
    state = yield Saga.select()
  }
  const conversation = state.chat.inbox.find(
    value => value.teamname === teamname && value.channelname === channelname
  )
  if (conversation) {
    const {conversationIDKey} = conversation
    yield Saga.put(navigateTo([chatTab, conversationIDKey]))
  } else {
    logger.info(`Unable to find conversationID for ${teamname}#${channelname}`)
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
  let state = yield Saga.select()
  const old = state.chat.inbox.get(conversationIDKey)
  if (old) {
    let nextNotifications = {}

    if (action.type === ChatGen.setNotifications) {
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
    } else if (action.type === ChatGen.toggleChannelWideNotifications) {
      nextNotifications = {channelWide: !old.notifications.channelWide}
    } else if (action.type === ChatGen.updatedNotifications) {
      nextNotifications = action.payload.notifications
    }

    yield Saga.put(
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
  if (action.type !== ChatGen.updatedNotifications) {
    state = yield Saga.select()
    const inbox = Constants.getInbox(state, conversationIDKey)
    if (inbox && inbox.notifications) {
      const {notifications} = inbox
      const param = {
        convID: Constants.keyToConversationID(conversationIDKey),
        channelWide: notifications.channelWide,
        settings: [
          {
            deviceType: RPCTypes.commonDeviceType.desktop,
            kind: ChatTypes.commonNotificationKind.atmention,
            enabled: notifications.desktop.atmention,
          },
          {
            deviceType: RPCTypes.commonDeviceType.desktop,
            kind: ChatTypes.commonNotificationKind.generic,
            enabled: notifications.desktop.generic,
          },
          {
            deviceType: RPCTypes.commonDeviceType.mobile,
            kind: ChatTypes.commonNotificationKind.atmention,
            enabled: notifications.mobile.atmention,
          },
          {
            deviceType: RPCTypes.commonDeviceType.mobile,
            kind: ChatTypes.commonNotificationKind.generic,
            enabled: notifications.mobile.generic,
          },
        ],
      }
      yield Saga.put(ChatGen.createSetNotificationSaveState({conversationIDKey, saveState: 'saving'}))
      // TODO: Ideally, we'd handle and update the UI for any errors
      // that happen for this RPC.
      yield Saga.call(ChatTypes.localSetAppNotificationSettingsLocalRpcPromise, param)
      yield Saga.put(ChatGen.createSetNotificationSaveState({conversationIDKey, saveState: 'saved'}))
    }
  }
}

function _setNotificationSaveState(action: ChatGen.SetNotificationSaveStatePayload) {
  const {conversationIDKey, saveState} = action.payload
  return Saga.put(
    ChatGen.createMergeEntity({
      keyPath: ['inbox', conversationIDKey],
      entities: I.Map({
        notificationSaveState: saveState,
      }),
    })
  )
}

function _blockConversation(action: ChatGen.BlockConversationPayload) {
  const {blocked, conversationIDKey, reportUser} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  if (blocked) {
    const status = reportUser
      ? ChatTypes.commonConversationStatus.reported
      : ChatTypes.commonConversationStatus.blocked
    const identifyBehavior: RPCTypes.TLFIdentifyBehavior = RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui
    return Saga.call(ChatTypes.localSetConversationStatusLocalRpcPromise, {
      conversationID,
      identifyBehavior,
      status,
    })
  }
}

function _leaveConversation(action: ChatGen.LeaveConversationPayload) {
  const {conversationIDKey} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  return Saga.call(ChatTypes.localLeaveConversationLocalRpcPromise, {
    convID: conversationID,
  })
}

function _muteConversation(action: ChatGen.MuteConversationPayload) {
  const {conversationIDKey, muted} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const status = muted ? ChatTypes.commonConversationStatus.muted : ChatTypes.commonConversationStatus.unfiled
  const identifyBehavior: RPCTypes.TLFIdentifyBehavior = RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui
  return Saga.call(ChatTypes.localSetConversationStatusLocalRpcPromise, {
    conversationID,
    identifyBehavior,
    status,
  })
}

function* registerSagas(): SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(ChatGen.leaveConversation, _leaveConversation)
  yield Saga.safeTakeEveryPure(ChatGen.muteConversation, _muteConversation)
  yield Saga.safeTakeEvery(ChatGen.startConversation, _startConversation)
  yield Saga.safeTakeLatest(ChatGen.selectConversation, _selectConversation)
  yield Saga.safeTakeLatestPure(ChatGen.selectOrPreviewConversation, _selectOrPreviewConversation)
  yield Saga.safeTakeEvery(
    [ChatGen.setNotifications, ChatGen.updatedNotifications, ChatGen.toggleChannelWideNotifications],
    _setNotifications
  )
  yield Saga.safeTakeLatestPure(ChatGen.setNotificationSaveState, _setNotificationSaveState)
  yield Saga.safeTakeEveryPure(ChatGen.blockConversation, _blockConversation)
  yield Saga.safeTakeLatest(ChatGen.openTeamConversation, _openTeamConversation)
}

export {registerSagas}
