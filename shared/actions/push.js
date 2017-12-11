// @flow
import * as PushGen from './push-gen'
import * as ChatTypes from '../constants/types/flow-types-chat'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/flow-types'
import {isMobile} from '../constants/platform'
import {chatTab} from '../constants/tabs'
import {navigateTo} from './route-tree'
import {createShowUserProfile} from './profile-gen'
import {
  requestPushPermissions,
  configurePush,
  displayNewMessageNotification,
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

    console.log('Requesting permissions')
    const permissions = yield Saga.call(requestPushPermissions)
    console.log('Permissions:', permissions)
    // TODO(gabriel): Set permissions we have in store, might want it at some point?
  } finally {
    yield Saga.put(PushGen.createPermissionsRequesting({requesting: false}))
    yield Saga.put(PushGen.createPermissionsPrompt({prompt: false}))
  }
}

function* pushNotificationSaga(notification: PushGen.NotificationPayload): Saga.SagaGenerator<any, any> {
  console.log('Push notification:', notification)
  const payload = notification.payload.notification
  if (payload && payload.userInteraction) {
    if (payload.type === 'chat.newmessageSilent') {
      console.info('Push notification: silent notification received')
      try {
        const unboxRes = yield Saga.call(ChatTypes.localUnboxMobilePushNotificationRpcPromise, {
          convID: payload.c || '',
          // $FlowIssue payload.t isn't ConversationMembersType
          membersType: payload.t,
          payload: payload.m || '',
          pushIDs: payload.p,
        })
        if (payload.x && payload.x > 0) {
          const num = payload.x
          const ageMS = Date.now() - num * 1000
          if (ageMS > 15000) {
            console.info('Push notification: silent notification is stale:', ageMS)
            return
          }
        }
        if (unboxRes) {
          yield Saga.call(displayNewMessageNotification, unboxRes, payload.c, payload.b, payload.d)
        }
      } catch (err) {
        console.info('failed to unbox silent notification', err)
      }
    } else if (payload.type === 'chat.newmessage') {
      const {convID} = payload
      // Check for conversation ID so we know where to navigate to
      if (!convID) {
        console.error('Push chat notification payload missing conversation ID')
        return
      }
      yield Saga.put(navigateTo([chatTab, convID]))
    } else if (payload.type === 'follow') {
      const {username} = payload
      if (!username) {
        console.error('Follow notification payload missing username', JSON.stringify(payload))
        return
      }
      console.info('Push notification: follow received, follower= ', username)
      yield Saga.put(createShowUserProfile({username}))
    } else {
      console.error('Push notification payload missing or unknown type')
    }
  }
}

function pushTokenSaga(action: PushGen.PushTokenPayload) {
  const {token, tokenType} = action.payload
  return Saga.all([
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
    console.warn('Error trying to save push token:', err)
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
      console.log('Not deleting push token -- none to remove')
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
    console.warn('Error trying to delete push token:', err)
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
