// @flow
import logger from '../logger'
import * as Constants from '../constants/push'
import * as AppGen from './app-gen'
import * as Chat2Gen from './chat2-gen'
import * as PushGen from './push-gen'
import * as WaitingGen from './waiting-gen'
import * as ChatTypes from '../constants/types/chat2'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import {isMobile, isIOS} from '../constants/platform'
import {chatTab} from '../constants/tabs'
import {switchTo} from './route-tree'
import {createShowUserProfile} from './profile-gen'
import {
  checkPermissions,
  requestPushPermissions,
  configurePush,
  displayNewMessageNotification,
  clearAllNotifications,
  getShownPushPrompt,
  openAppSettings,
} from './platform-specific'

import type {TypedState} from '../constants/reducer'

const pushSelector = ({push: {token, tokenType}}: TypedState) => ({token, tokenType})
const deviceIDSelector = ({config: {deviceID}}: TypedState) => deviceID

function permissionsNoSaga() {
  return Saga.sequentially([
    Saga.put(PushGen.createPermissionsRequesting({requesting: false})),
    Saga.put(PushGen.createPermissionsPrompt({prompt: false})),
  ])
}

function* permissionsRequestSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.permissionsRequestingWaitingKey}))
  if (isIOS) {
    const shownPushPrompt = yield Saga.call(getShownPushPrompt)
    if (shownPushPrompt) {
      // we've already shown the prompt, take them to settings
      openAppSettings()
      yield Saga.all([
        Saga.put(PushGen.createPermissionsRequesting({requesting: false})),
        Saga.put(PushGen.createPermissionsPrompt({prompt: false})),
      ])
      return
    }
  }
  try {
    logger.info('Requesting permissions')
    const permissions = yield Saga.call(requestPushPermissions)
    logger.info('Permissions:', permissions)
    if (permissions.alert || permissions.badge) {
      logger.info('Badge or alert push permissions are enabled')
      yield Saga.put(PushGen.createSetHasPermissions({hasPermissions: true}))
    } else {
      logger.info('Badge or alert push permissions are disabled')
      yield Saga.put(PushGen.createSetHasPermissions({hasPermissions: false}))
    }
    // TODO(gabriel): Set permissions we have in store, might want it at some point?
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.permissionsRequestingWaitingKey}))
    yield Saga.put(PushGen.createPermissionsPrompt({prompt: false}))
  }
}

// we set this flag when we handle a push so additional pushes don't cause our logic to be weird
// given a session (being in the foreground) we only want to handle one push
let handledPushThisSession = false
const resetHandledPush = () => {
  handledPushThisSession = false
}

function* pushNotificationSaga(notification: PushGen.NotificationPayload): Saga.SagaGenerator<any, any> {
  const payload = notification.payload.notification
  if (!payload) {
    return
  }
  logger.info(`Push notification of type ${payload.type ? payload.type : 'unknown'} received.`)

  const membersType: RPCChatTypes.ConversationMembersType =
    // $ForceType
    typeof payload.t === 'string' ? parseInt(payload.t) : payload.t
  switch (payload.type) {
    case 'chat.readmessage':
      try {
        logger.info('Push notification: read message notification received')
        const b = typeof payload.b === 'string' ? parseInt(payload.b) : payload.b
        if (b === 0) {
          clearAllNotifications()
        }
      } catch (err) {
        logger.error('failed to handle readmessage push', err)
      }
      break
    case 'chat.newmessageSilent_2':
      try {
        logger.info('Push notification: silent notification received, displayPlaintext: ', payload.d)
        const unboxRes = yield Saga.call(RPCChatTypes.localUnboxMobilePushNotificationRpcPromise, {
          convID: payload.c || '',
          membersType,
          payload: payload.m || '',
          pushIDs: typeof payload.p === 'string' ? JSON.parse(payload.p) : payload.p,
          shouldAck: true,
        })
        if (!payload.d) {
          // If the user doesn't have plaintext notifications set, don't
          // display the message
          break
        }
        if (payload.x && payload.x > 0) {
          const num = payload.x
          const ageMS = Date.now() - num * 1000
          if (ageMS > 15000) {
            logger.info('Push notification: silent notification is stale:', ageMS)
            break
          }
        }
        if (unboxRes) {
          yield Saga.call(displayNewMessageNotification, unboxRes, payload.c, payload.b, payload.d, payload.s)
        }
      } catch (err) {
        logger.error('failed to unbox silent notification', err)
      }
      break
    case 'chat.newmessage':
      if (!payload.userInteraction) {
        // ignore it
        break
      }
      // If a boxed message is attached to the notification, unbox.
      if (payload.m) {
        logger.info('Push notification: unboxing notification message')
        yield Saga.call(RPCChatTypes.localUnboxMobilePushNotificationRpcPromise, {
          convID: payload.convID || '',
          membersType,
          payload: payload.m || '',
          shouldAck: false,
        })
      }
      try {
        const {convID} = payload
        // Check for conversation ID so we know where to navigate to
        if (!convID) {
          logger.error('Push chat notification payload missing conversation ID')
          break
        }
        if (handledPushThisSession) {
          break
        }
        handledPushThisSession = true
        const conversationIDKey = ChatTypes.stringToConversationIDKey(convID)
        yield Saga.put(
          Chat2Gen.createSelectConversation({
            conversationIDKey,
            reason: 'push',
          })
        )
        yield Saga.put(Chat2Gen.createSetLoading({key: `pushLoad:${conversationIDKey}`, loading: true}))
        yield Saga.put(switchTo([chatTab, 'conversation']))
      } catch (err) {
        logger.error('failed to handle new message push', err)
      }
      break
    case 'follow':
      if (!payload.userInteraction) {
        // ignore it
        break
      }
      try {
        const {username} = payload
        if (!username) {
          logger.error('Follow notification payload missing username', JSON.stringify(payload))
          break
        }
        logger.info('Push notification: follow received, follower= ', username)
        yield Saga.put(createShowUserProfile({username}))
      } catch (err) {
        logger.error('failed to handle follow push', err)
      }
      break
    default:
      logger.error('Push notification payload missing or unknown type')
  }
}

function pushTokenSaga(action: PushGen.PushTokenPayload) {
  const {token, tokenType} = action.payload
  return Saga.sequentially([
    Saga.put(PushGen.createUpdatePushToken({token, tokenType})),
    Saga.put(PushGen.createSavePushToken()),
  ])
}

function* savePushTokenSaga(): Saga.SagaGenerator<any, any> {
  try {
    const state: TypedState = yield Saga.select()
    const {token, tokenType} = pushSelector(state)
    const deviceID = deviceIDSelector(state)
    if (!deviceID) {
      throw new Error('No device available for saving push token')
    }
    if (!token) {
      throw new Error('No push token available to save')
    }

    const args = [
      {key: 'push_token', value: token},
      {key: 'device_id', value: deviceID},
      {key: 'token_type', value: tokenType || ''},
    ]

    yield Saga.call(RPCTypes.apiserverPostRpcPromise, {
      args,
      endpoint: 'device/push_token',
    })
  } catch (err) {
    logger.warn('Error trying to save push token:', err)
  }
}

function* configurePushSaga(): Saga.SagaGenerator<any, any> {
  if (isMobile) {
    if (isIOS) {
      yield Saga.put(PushGen.createCheckIOSPush())
    }
    const chan = yield Saga.call(configurePush)
    while (true) {
      const action = yield Saga.take(chan)
      yield Saga.put(action)
    }
  }
}

function* checkIOSPushSaga(): Saga.SagaGenerator<any, any> {
  const permissions = yield Saga.call(checkPermissions)
  logger.debug('Got push notification permissions:', JSON.stringify(permissions, null, 2))
  const shownPushPrompt = yield Saga.call(getShownPushPrompt)
  logger.debug(
    shownPushPrompt
      ? 'We have requested push permissions before'
      : 'We have not requested push permissions before'
  )
  if (!permissions.alert && !permissions.badge) {
    logger.info('Badge and alert permissions are disabled; showing prompt')
    yield Saga.all([
      Saga.put(PushGen.createSetHasPermissions({hasPermissions: false})),
      Saga.put(
        PushGen.createPermissionsPrompt({
          prompt: true,
        })
      ),
    ])
  } else {
    // badge or alert permissions are enabled
    logger.info('Badge or alert permissions are enabled. Getting token.')
    yield Saga.all([
      Saga.put(PushGen.createSetHasPermissions({hasPermissions: true})),
      Saga.call(requestPushPermissions),
    ])
  }
}

function* deletePushTokenSaga(): Saga.SagaGenerator<any, any> {
  try {
    const state: TypedState = yield Saga.select()
    const {tokenType} = pushSelector(state)
    if (!tokenType) {
      // No push token to remove.
      logger.info('Not deleting push token -- none to remove')
      return
    }

    const deviceID = deviceIDSelector(state)
    if (!deviceID) {
      throw new Error('No device id available for saving push token')
    }

    const args = [{key: 'device_id', value: deviceID}, {key: 'token_type', value: tokenType}]

    yield Saga.call(RPCTypes.apiserverDeleteRpcPromise, {
      endpoint: 'device/push_token',
      args: args,
    })
  } catch (err) {
    logger.warn('Error trying to delete push token:', err)
  }
}

function* mobileAppStateSaga(action: AppGen.MobileAppStatePayload) {
  const nextAppState = action.payload.nextAppState
  if (isIOS && nextAppState === 'active') {
    console.log('Checking push permissions')
    const permissions = yield Saga.call(checkPermissions)
    if (permissions.alert || permissions.badge) {
      logger.info('Found push permissions ENABLED on app focus')
      const state: TypedState = yield Saga.select()
      const hasPermissions = state.push.hasPermissions
      if (!hasPermissions) {
        logger.info('Had no permissions before, requesting permissions to get token')
        yield Saga.call(requestPushPermissions)
      }
      yield Saga.put(PushGen.createSetHasPermissions({hasPermissions: true}))
    } else {
      logger.info('Found push permissions DISABLED on app focus')
      yield Saga.put(PushGen.createSetHasPermissions({hasPermissions: false}))
    }
  }
}

function* pushSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(PushGen.permissionsRequest, permissionsRequestSaga)
  yield Saga.safeTakeLatestPure(PushGen.permissionsNo, permissionsNoSaga)
  yield Saga.safeTakeLatestPure(PushGen.pushToken, pushTokenSaga)
  yield Saga.safeTakeLatest(PushGen.savePushToken, savePushTokenSaga)
  yield Saga.safeTakeLatest(PushGen.configurePush, configurePushSaga)
  yield Saga.safeTakeEvery(PushGen.checkIOSPush, checkIOSPushSaga)
  yield Saga.safeTakeEvery(PushGen.notification, pushNotificationSaga)
  yield Saga.safeTakeEveryPure(AppGen.mobileAppState, resetHandledPush)
  yield Saga.safeTakeEvery(AppGen.mobileAppState, mobileAppStateSaga)
}

export default pushSaga

export {deletePushTokenSaga}
