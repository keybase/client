// @flow
import * as Constants from '../../constants/push'
import * as Creators from './creators'
import {isMobile} from '../../constants/platform'
import {apiserverDeleteRpcPromise, apiserverPostRpcPromise} from '../../constants/types/flow-types'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import {call, put, take, select} from 'redux-saga/effects'
import {chatTab} from '../../constants/tabs'
import {navigateTo} from '../route-tree'
import {safeTakeEvery, safeTakeLatest} from '../../util/saga'

import type {SagaGenerator} from '../../constants/types/saga'
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

function* permissionsNoSaga(): SagaGenerator<any, any> {
  yield call(setNoPushPermissions)
  yield put({type: Constants.permissionsRequesting, payload: false})
  yield put({type: Constants.permissionsPrompt, payload: false})
}

function* permissionsRequestSaga(): SagaGenerator<any, any> {
  try {
    yield put({type: Constants.permissionsRequesting, payload: true})

    console.log('Requesting permissions')
    const permissions = yield call(requestPushPermissions)
    console.log('Permissions:', permissions)
    // TODO(gabriel): Set permissions we have in store, might want it at some point?
  } finally {
    yield put({type: Constants.permissionsRequesting, payload: false})
    yield put({type: Constants.permissionsPrompt, payload: false})
  }
}

function* pushNotificationSaga(notification: Constants.PushNotification): SagaGenerator<any, any> {
  console.warn('Push notification:', notification)
  const payload = notification.payload
  if (payload && payload.userInteraction) {
    if (payload.type === 'chat.newmessageSilent') {
      console.info('Push notification: silent notification received')
      try {
        const unboxRes = yield call(ChatTypes.localUnboxMobilePushNotificationRpcPromise, {
          param: {
            convID: payload.c,
            membersType: payload.t,
            payload: payload.m,
            pushIDs: payload.p,
          },
        })
        yield call(displayNewMessageNotification, unboxRes, payload.c, payload.b, payload.d)
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
      yield put(navigateTo([chatTab, convID]))
    } else if (payload.type === 'follow') {
      const {username} = payload
      if (!username) {
        console.error('Follow notification payload missing username', JSON.stringify(payload))
        return
      }
      console.info('Push notification: follow received, follower= ', username)
      yield put(showUserProfile(username))
    } else {
      console.error('Push notification payload missing or unknown type')
    }
  }
}

function* pushTokenSaga(action: Constants.PushToken): SagaGenerator<any, any> {
  const {token, tokenType} = action.payload
  yield put(Creators.updatePushToken(token, tokenType))
  yield put(Creators.savePushToken())
}

function* savePushTokenSaga(): SagaGenerator<any, any> {
  try {
    const {token, tokenType} = (yield select(pushSelector): any)
    const deviceID = (yield select(deviceIDSelector): any)
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

    yield call(apiserverPostRpcPromise, {
      param: {
        endpoint: 'device/push_token',
        args: args,
      },
    })
  } catch (err) {
    console.warn('Error trying to save push token:', err)
  }
}

function* configurePushSaga(): SagaGenerator<any, any> {
  if (isMobile) {
    const chan = yield call(configurePush)

    while (true) {
      const action = yield take(chan)
      yield put(action)
    }
  }
}

function* deletePushTokenSaga(): SagaGenerator<any, any> {
  try {
    const {tokenType} = (yield select(pushSelector): any)
    if (!tokenType) {
      // No push token to remove.
      console.log('Not deleting push token -- none to remove')
      return
    }

    const deviceID = (yield select(deviceIDSelector): any)
    if (!deviceID) {
      throw new Error('No device id available for saving push token')
    }

    const args = [{key: 'device_id', value: deviceID}, {key: 'token_type', value: tokenType}]

    yield call(apiserverDeleteRpcPromise, {
      param: {
        endpoint: 'device/push_token',
        args: args,
      },
    })
  } catch (err) {
    console.warn('Error trying to delete push token:', err)
  }
}

function* pushSaga(): SagaGenerator<any, any> {
  yield safeTakeLatest(Constants.permissionsRequest, permissionsRequestSaga)
  yield safeTakeLatest(Constants.permissionsNo, permissionsNoSaga)
  yield safeTakeLatest(Constants.pushToken, pushTokenSaga)
  yield safeTakeLatest(Constants.savePushToken, savePushTokenSaga)
  yield safeTakeLatest(Constants.configurePush, configurePushSaga)
  yield safeTakeEvery(Constants.pushNotification, pushNotificationSaga)
}

export default pushSaga

export {deletePushTokenSaga}
