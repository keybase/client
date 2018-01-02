// @flow
// Actions that have to do with managing a thread.
// Mute, block, starting a new one, selecting one
import logger from '../../logger'
import * as Constants from '../../constants/chat'
import * as ChatGen from '../../actions/chat-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as I from 'immutable'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
// import * as SearchGen from '../search-gen'
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
    const inSearch = state.chat2.isSearching
    if (inSearch) {
      yield Saga.put(Chat2Gen.createSetSearching({searching: false}))
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
      state.get('membersType') === RPCChatTypes.commonConversationMembersType.kbfs &&
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
    yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey: newID[0]}))
  } else if (existing) {
    // Select existing conversations
    yield Saga.put(
      Chat2Gen.createSelectConversation({
        conversationIDKey: existing.get('conversationIDKey'),
      })
    )
    yield Saga.put(switchTo([chatTab]))
  } else {
    // Make a pending conversation so it appears in the inbox
    const conversationIDKey = Constants.pendingConversationIDKey(tlfName)
    yield Saga.put(ChatGen.createAddPending({participants: users, temporary}))
    yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey}))
    yield Saga.put(switchTo([chatTab]))
  }
}

// function* _selectConversation(action: ChatGen.SelectConversationPayload): Saga.SagaGenerator<any, any> {
// const {conversationIDKey, fromUser} = action.payload

// logger.info(`selectConversation: selecting: ${conversationIDKey || ''}`)
// // Always show this in the inbox
// if (conversationIDKey) {
// yield Saga.put(
// ChatGen.createMergeEntity({keyPath: ['inboxAlwaysShow'], entities: I.Map({[conversationIDKey]: true})})
// )
// }

// if (fromUser) {
// yield Saga.put(ChatGen.createExitSearch({skipSelectPreviousConversation: true}))
// }

// // Load the inbox item always
// if (conversationIDKey) {
// yield Saga.put(ChatGen.createGetInboxAndUnbox({conversationIDKeys: [conversationIDKey]}))
// }

// const state: TypedState = yield Saga.select()
// let oldConversationState
// if (conversationIDKey) {
// oldConversationState = Shared.conversationStateSelector(state, conversationIDKey)
// }
// if (oldConversationState && oldConversationState.get('isStale') && conversationIDKey) {
// logger.info(`selectConversation: clearing because stale: ${conversationIDKey || ''}`)
// yield Saga.put(ChatGen.createClearMessages({conversationIDKey}))
// }

// const inbox = Constants.getInbox(state, conversationIDKey)
// const inSearch = state.chat.get('inSearch')
// if (inbox && !inbox.teamname) {
// const participants = inbox.get('participants').toArray()
// yield Saga.put(ChatGen.createUpdateMetadata({users: participants}))
// // Update search but don't update the filter
// if (inSearch) {
// const me = Selectors.usernameSelector(state)
// yield Saga.put(
// SearchGen.createSetUserInputItems({
// searchKey: 'chatSearch',
// searchResults: participants.filter(u => u !== me),
// })
// )
// }
// }

// if (conversationIDKey) {
// logger.info(`selectConversation: starting load more messages: ${conversationIDKey || ''}`)
// yield Saga.put(ChatGen.createLoadMoreMessages({conversationIDKey, onlyIfUnloaded: true, fromUser}))
// yield Saga.put(navigateTo([conversationIDKey], [chatTab]))
// } else {
// yield Saga.put(navigateTo([chatTab]))
// }

// // Do this here because it's possible loadMoreMessages bails early
// // but there are still unread messages that need to be marked as read
// if (fromUser && conversationIDKey) {
// yield Saga.put(ChatGen.createUpdateBadging({conversationIDKey}))
// yield Saga.put(ChatGen.createUpdateLatestMessage({conversationIDKey}))
// }
// }

const _openTeamConversation = function*(action: ChatGen.OpenTeamConversationPayload) {
  // TODO handle channels you're not a member of, or small teams you've never opened the chat for.
  const {payload: {teamname, channelname}} = action
  const findMeta = meta => meta.teamname === teamname && meta.channelname === channelname
  let state = yield Saga.select()
  let conversation = state.chat2.metaMap.find(findMeta)

  // Load inbox if we can't find it
  if (!conversation) {
    yield Saga.put(Chat2Gen.createInboxRefresh())
    yield Saga.take(Chat2Gen.metasReceived)
    state = yield Saga.select()
  }

  conversation = state.chat2.metaMap.find(findMeta)
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
            kind: RPCChatTypes.commonNotificationKind.atmention,
            enabled: notifications.desktop.atmention,
          },
          {
            deviceType: RPCTypes.commonDeviceType.desktop,
            kind: RPCChatTypes.commonNotificationKind.generic,
            enabled: notifications.desktop.generic,
          },
          {
            deviceType: RPCTypes.commonDeviceType.mobile,
            kind: RPCChatTypes.commonNotificationKind.atmention,
            enabled: notifications.mobile.atmention,
          },
          {
            deviceType: RPCTypes.commonDeviceType.mobile,
            kind: RPCChatTypes.commonNotificationKind.generic,
            enabled: notifications.mobile.generic,
          },
        ],
      }
      yield Saga.call(RPCChatTypes.localSetAppNotificationSettingsLocalRpcPromise, param)
    }
  }
}

function _blockConversation(action: ChatGen.BlockConversationPayload) {
  const {blocked, conversationIDKey, reportUser} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  if (blocked) {
    const status = reportUser
      ? RPCChatTypes.commonConversationStatus.reported
      : RPCChatTypes.commonConversationStatus.blocked
    const identifyBehavior: RPCTypes.TLFIdentifyBehavior = RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui
    return Saga.call(RPCChatTypes.localSetConversationStatusLocalRpcPromise, {
      conversationID,
      identifyBehavior,
      status,
    })
  }
}

function _leaveConversation(action: ChatGen.LeaveConversationPayload) {
  const {conversationIDKey} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  return Saga.call(RPCChatTypes.localLeaveConversationLocalRpcPromise, {
    convID: conversationID,
  })
}

function _muteConversation(action: ChatGen.MuteConversationPayload) {
  const {conversationIDKey, muted} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const status = muted
    ? RPCChatTypes.commonConversationStatus.muted
    : RPCChatTypes.commonConversationStatus.unfiled
  const identifyBehavior: RPCTypes.TLFIdentifyBehavior = RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui
  return Saga.call(RPCChatTypes.localSetConversationStatusLocalRpcPromise, {
    conversationID,
    identifyBehavior,
    status,
  })
}

// from inbox, doesn't really belong there
function _joinConversation(action: ChatGen.JoinConversationPayload) {
  const convID = Constants.keyToConversationID(action.payload.conversationIDKey)
  return Saga.call(RPCChatTypes.localJoinConversationByIDLocalRpcPromise, {
    convID,
  })
}

function _previewChannel(action: ChatGen.PreviewChannelPayload) {
  const convID = Constants.keyToConversationID(action.payload.conversationIDKey)
  return Saga.sequentially([
    Saga.call(RPCChatTypes.localPreviewConversationByIDLocalRpcPromise, {convID}),
    Saga.put(
      Chat2Gen.createSelectConversation({conversationIDKey: action.payload.conversationIDKey, fromUser: true})
    ),
  ])
}

function _resetChatWithoutThem(action: ChatGen.ResetChatWithoutThemPayload, state: TypedState) {
  const participants = state.chat.getIn(['inbox', action.payload.conversationIDKey, 'participants'], I.List())
  const withoutReset = participants.filter(u => u !== action.payload.username).toArray()
  if (withoutReset.length) {
    return Saga.put(
      ChatGen.createStartConversation({
        users: withoutReset,
      })
    )
  }
}

const _resetLetThemIn = (action: ChatGen.ResetLetThemInPayload) =>
  Saga.call(RPCChatTypes.localAddTeamMemberAfterResetRpcPromise, {
    convID: Constants.keyToConversationID(action.payload.conversationIDKey),
    username: action.payload.username,
  })

function* registerSagas(): SagaGenerator<any, any> {
  // TODO
  // yield Saga.safeTakeEveryPure(ChatGen.leaveConversation, _leaveConversation)
  // yield Saga.safeTakeEveryPure(ChatGen.muteConversation, _muteConversation)
  // yield Saga.safeTakeEvery(ChatGen.startConversation, _startConversation)
  // yield Saga.safeTakeEvery(
  // [ChatGen.setNotifications, ChatGen.updatedNotifications, ChatGen.toggleChannelWideNotifications],
  // _setNotifications
  // )
  // yield Saga.safeTakeEveryPure(ChatGen.blockConversation, _blockConversation)
  // yield Saga.safeTakeLatest(ChatGen.openTeamConversation, _openTeamConversation)
  // yield Saga.safeTakeEveryPure(ChatGen.joinConversation, _joinConversation)
  // yield Saga.safeTakeEveryPure(ChatGen.previewChannel, _previewChannel)
  // yield Saga.safeTakeEveryPure(ChatGen.resetChatWithoutThem, _resetChatWithoutThem)
  // yield Saga.safeTakeEveryPure(ChatGen.resetLetThemIn, _resetLetThemIn)
}

export {registerSagas}
