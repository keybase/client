// @flow
import logger from '../logger'
import * as ChatGen from './chat-gen'
import * as PushGen from './push-gen'
import * as ChatTypes from '../constants/types/rpc-chat-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import {isMobile} from '../constants/platform'
import {chatTab} from '../constants/tabs'
import {switchTo} from './route-tree'
import {createShowUserProfile} from './profile-gen'
import {
  requestPushPermissions,
  configurePush,
  displayNewMessageNotification,
  clearAllNotifications,
  setNoPushPermissions,
} from './platform-specific'

import type {TypedState} from '../constants/reducer'

const pushSelector = ({push: {token, tokenType}}: TypedState) => ({token, tokenType})
const deviceIDSelector = ({config: {deviceID}}: TypedState) => deviceID

function permissionsNoSaga() {
  return Saga.sequentially([
    Saga.call(setNoPushPermissions),
    Saga.put(PushGen.createPermissionsRequesting({requesting: false})),
    Saga.put(PushGen.createPermissionsPrompt({prompt: false})),
  ])
}

function* permissionsRequestSaga(): Saga.SagaGenerator<any, any> {
  try {
    yield Saga.put(PushGen.createPermissionsRequesting({requesting: true}))

    logger.info('Requesting permissions')
    const permissions = yield Saga.call(requestPushPermissions)
    logger.info('Permissions:', permissions)
    // TODO(gabriel): Set permissions we have in store, might want it at some point?
  } finally {
    yield Saga.put(PushGen.createPermissionsRequesting({requesting: false}))
    yield Saga.put(PushGen.createPermissionsPrompt({prompt: false}))
  }
}

function* pushNotificationSaga(notification: PushGen.NotificationPayload): Saga.SagaGenerator<any, any> {
  logger.info('Push notification:', notification)
  const payload = notification.payload.notification
  if (payload) {
    // Handle types that are not from user interaction
    if (payload.type === 'chat.newmessageSilent') {
      logger.info('Push notification: silent notification received')
      try {
        const unboxRes = yield Saga.call(ChatTypes.localUnboxMobilePushNotificationRpcPromise, {
          convID: payload.c || '',
          // $FlowIssue payload.t isn't ConversationMembersType
          membersType: typeof payload.t === 'string' ? parseInt(payload.t) : payload.t,
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
    } else if (payload.type === 'chat.readmessage') {
      logger.info('Push notification: read message notification received')
      const b = typeof payload.b === 'string' ? parseInt(payload.b) : payload.b
      if (b === 0) {
        clearAllNotifications()
      }
    }

    // Handle types from user interaction
    if (payload.userInteraction) {
      if (payload.type === 'chat.newmessage') {
        const {convID} = payload
        // Check for conversation ID so we know where to navigate to
        if (!convID) {
          logger.error('Push chat notification payload missing conversation ID')
          return
        }
        yield Saga.call(RPCTypes.appStateUpdateAppStateRpcPromise, {
          state: RPCTypes.appStateAppState.foreground,
        })
        yield Saga.put(ChatGen.createSelectConversation({conversationIDKey: convID, fromUser: true}))
        yield Saga.put(switchTo([chatTab]))
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
    const chan = yield Saga.call(configurePush)

    while (true) {
      const action = yield Saga.take(chan)
      yield Saga.put(action)
    }
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

function* pushSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(PushGen.permissionsRequest, permissionsRequestSaga)
  yield Saga.safeTakeLatestPure(PushGen.permissionsNo, permissionsNoSaga)
  yield Saga.safeTakeLatestPure(PushGen.pushToken, pushTokenSaga)
  yield Saga.safeTakeLatest(PushGen.savePushToken, savePushTokenSaga)
  yield Saga.safeTakeLatest(PushGen.configurePush, configurePushSaga)
  yield Saga.safeTakeEvery(PushGen.notification, pushNotificationSaga)
}

export default pushSaga

export {deletePushTokenSaga}
