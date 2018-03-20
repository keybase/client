// @flow
import logger from '../logger'
import * as AppGen from './app-gen'
import * as Chat2Gen from './chat2-gen'
import * as PushGen from './push-gen'
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
  setShownPushPrompt,
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
  yield Saga.put(PushGen.createPermissionsRequesting({requesting: true}))
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
    if (isIOS) {
      yield Saga.call(setShownPushPrompt)
    }
    if (permissions.alert || permissions.badge) {
      logger.info('Badge or alert push permissions are enabled')
      yield Saga.put(PushGen.createSetHasPermissions({hasPermissions: true}))
    } else {
      logger.info('Badge or alert push permissions are disabled')
      yield Saga.put(PushGen.createSetHasPermissions({hasPermissions: false}))
    }
    // TODO(gabriel): Set permissions we have in store, might want it at some point?
  } finally {
    yield Saga.put(PushGen.createPermissionsRequesting({requesting: false}))
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
  logger.info('Push notification:', notification)
  const payload = notification.payload.notification
  if (payload) {
    // Handle types that are not from user interaction
    if (payload.type === 'chat.newmessageSilent_2') {
      logger.info('Push notification: silent notification received')
      try {
        const membersType: RPCChatTypes.ConversationMembersType =
          // $ForceType
          typeof payload.t === 'string' ? parseInt(payload.t) : payload.t
        const unboxRes = yield Saga.call(RPCChatTypes.localUnboxMobilePushNotificationRpcPromise, {
          convID: payload.c || '',
          membersType,
          payload: payload.m || '',
          pushIDs: typeof payload.p === 'string' ? JSON.parse(payload.p) : payload.p,
        })
        if (payload.x && payload.x > 0) {
          const num = payload.x
          const ageMS = Date.now() - num * 1000
          if (ageMS > 15000) {
            logger.info('Push notification: silent notification is stale:', ageMS)
            return
          }
        }
        if (unboxRes) {
          yield Saga.call(displayNewMessageNotification, unboxRes, payload.c, payload.b, payload.d)
        }
      } catch (err) {
        logger.info('failed to unbox silent notification', err)
      }
      return
    } else if (payload.type === 'chat.readmessage') {
      logger.info('Push notification: read message notification received')
      const b = typeof payload.b === 'string' ? parseInt(payload.b) : payload.b
      if (b === 0) {
        clearAllNotifications()
      }
    }

    // Handle types from user interaction
    if (payload.userInteraction) {
      // There can be a race where the notification that our app is foregrounded is very late compared to the push
      // which makes our handling incorrect. Instead we can only ever handle this if we're in the foreground so lets
      // just tell the app that's so
      yield Saga.put(AppGen.createMobileAppState({nextAppState: 'active'}))

      if (payload.type === 'chat.newmessage') {
        const {convID} = payload
        // Check for conversation ID so we know where to navigate to
        if (!convID) {
          logger.error('Push chat notification payload missing conversation ID')
          return
        }
        // Short term hack: this just ensures that the service definitely knows we are now in the
        // foreground for the GetThreadLocal call coming from selectConversation.
        yield Saga.call(RPCTypes.appStateUpdateAppStateRpcPromise, {
          state: RPCTypes.appStateAppState.foreground,
        })
        if (handledPushThisSession) {
          return
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
      } else if (payload.type === 'follow') {
        const {username} = payload
        if (!username) {
          logger.error('Follow notification payload missing username', JSON.stringify(payload))
          return
        }
        logger.info('Push notification: follow received, follower= ', username)
        yield Saga.put(createShowUserProfile({username}))
      } else {
        logger.error('Push notification payload missing or unknown type')
      }
    }
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
  if (!shownPushPrompt && (permissions.alert || permissions.sound || permissions.badge)) {
    // we've definitely already prompted, set it in local storage
    // to handle previous users who have notifications on
    logger.debug('We missed setting shownPushPrompt in local storage, setting now')
    yield Saga.call(setShownPushPrompt)
  }
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
