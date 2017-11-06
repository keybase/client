// @flow
import * as Constants from '../../constants/push'
import * as Creators from './creators'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Saga from '../../util/saga'
import {isMobile} from '../../constants/platform'
import {apiserverDeleteRpcPromise, apiserverPostRpcPromise} from '../../constants/types/flow-types'
import {chatTab} from '../../constants/tabs'
import {navigateTo} from '../route-tree'
import {safeTakeEvery, safeTakeLatest} from '../../util/saga'

import type {TypedState} from '../../constants/reducer'

import {showUserProfile} from '../profile'
import {
  requestPushPermissions,
  configurePush,
  displayNewMessageNotification,
  setNoPushPermissions,
} from '../platform-specific'

const pushSelector = ({push: {token, tokenType}}: TypedState) => ({token, tokenType})
const deviceIDSelector = ({config: {deviceID}}: TypedState) => deviceID

function* permissionsNoSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.call(setNoPushPermissions)
  yield Saga.put({type: Constants.permissionsRequesting, payload: false})
  yield Saga.put({type: Constants.permissionsPrompt, payload: false})
}

function* permissionsRequestSaga(): Saga.SagaGenerator<any, any> {
  try {
    yield Saga.put({type: Constants.permissionsRequesting, payload: true})

    console.log('Requesting permissions')
    const permissions = yield Saga.call(requestPushPermissions)
    console.log('Permissions:', permissions)
    // TODO(gabriel): Set permissions we have in store, might want it at some point?
  } finally {
    yield Saga.put({type: Constants.permissionsRequesting, payload: false})
    yield Saga.put({type: Constants.permissionsPrompt, payload: false})
  }
}

function* pushNotificationSaga(notification: Constants.PushNotification): Saga.SagaGenerator<any, any> {
  console.log('Push notification:', notification)
  const payload = notification.payload
  if (payload && payload.userInteraction) {
    if (payload.type === 'chat.newmessageSilent') {
      console.info('Push notification: silent notification received')
      try {
        const unboxRes = yield Saga.call(ChatTypes.localUnboxMobilePushNotificationRpcPromise, {
          // $FlowIssue wants all these to be non null
          param: {
            convID: payload.c,
            membersType: payload.t,
            payload: payload.m,
            pushIDs: payload.p,
          },
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
      yield Saga.put(showUserProfile(username))
    } else {
      console.error('Push notification payload missing or unknown type')
    }
  }
}

function* pushTokenSaga(action: Constants.PushToken): Saga.SagaGenerator<any, any> {
  const {token, tokenType} = action.payload
  yield Saga.put(Creators.updatePushToken(token, tokenType))
  yield Saga.put(Creators.savePushToken())
}

function* savePushTokenSaga(): Saga.SagaGenerator<any, any> {
  try {
    const {token, tokenType} = (yield Saga.select(pushSelector): any)
    const deviceID = (yield Saga.select(deviceIDSelector): any)
    if (!deviceID) {
      throw new Error('No device available for saving push token')
    }
    if (!token) {
      throw new Error('No push token available to save')
    }

    const args = [
      {key: 'push_token', value: token},
      {key: 'device_id', value: deviceID},
      {key: 'token_type', value: tokenType},
    ]

    yield Saga.call(apiserverPostRpcPromise, {
      param: {
        endpoint: 'device/push_token',
        args: args,
      },
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
    const {tokenType} = (yield Saga.select(pushSelector): any)
    if (!tokenType) {
      // No push token to remove.
      console.log('Not deleting push token -- none to remove')
      return
    }

    const deviceID = (yield Saga.select(deviceIDSelector): any)
    if (!deviceID) {
      throw new Error('No device id available for saving push token')
    }

    const args = [{key: 'device_id', value: deviceID}, {key: 'token_type', value: tokenType}]

    yield Saga.call(apiserverDeleteRpcPromise, {
      param: {
        endpoint: 'device/push_token',
        args: args,
      },
    })
  } catch (err) {
    console.warn('Error trying to delete push token:', err)
  }
}

function* pushSaga(): Saga.SagaGenerator<any, any> {
  yield safeTakeLatest(Constants.permissionsRequest, permissionsRequestSaga)
  yield safeTakeLatest(Constants.permissionsNo, permissionsNoSaga)
  yield safeTakeLatest(Constants.pushToken, pushTokenSaga)
  yield safeTakeLatest(Constants.savePushToken, savePushTokenSaga)
  yield safeTakeLatest(Constants.configurePush, configurePushSaga)
  yield safeTakeEvery(Constants.pushNotification, pushNotificationSaga)
}

export default pushSaga

export {deletePushTokenSaga}
