// @flow
import * as Constants from '../../constants/push'
import * as Creators from './creators'
import * as Shared from '../chat/shared'
import {isMobile} from '../../constants/platform'
import {
  apiserverDeleteRpcPromise,
  apiserverPostRpcPromise,
  appStateUpdateAppStateRpc,
  AppStateAppState,
} from '../../constants/types/flow-types'
import {call, put, take, select} from 'redux-saga/effects'
import {chatTab} from '../../constants/tabs'
import {navigateTo} from '../route-tree'
import {safeTakeEvery, safeTakeLatest} from '../../util/saga'
import {setLaunchedViaPush} from '../config'

import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

import {requestPushPermissions, configurePush} from '../platform-specific'
import {onUserClick} from '../profile'

const pushSelector = ({push: {token, tokenType}}: TypedState) => ({token, tokenType})

const deviceIDSelector = ({config: {deviceID}}: TypedState) => deviceID

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
    // If we have received a silent notification, then just bail out of here, the service will
    // wake up and do what it needs to do.
    if (payload.data && payload.data.silent) {
      console.info('Push notification: silent notification received')
      const appFocused = yield select(Shared.focusedSelector)
      if (!appFocused) {
        console.info('Push notification: sending state update to service')
        yield call(appStateUpdateAppStateRpc, {
          param: {
            state: AppStateAppState.backgroundactive,
          },
        })
      }
      return
    }

    // Check for conversation ID so we know where to navigate to
    const convID = payload.data ? payload.data.convID : payload.convID
    const type = payload.type
    if (convID) {
      // Record that we're going to a push notification conversation, in order
      // to avoid racing with restoring a saved initial tab.
      yield put(setLaunchedViaPush(true))
      yield put(navigateTo([chatTab, convID]))
      return
    } else if (type === 'follow') {
      const username = payload.username
      if (!username) {
        console.error('Follow notification payload missing username', JSON.stringify(payload))
        return
      }
      console.info('Push notification: follow received, follower= ', username)
      // Record that we're going to a push notification conversation, in order
      // to avoid racing with restoring a saved initial tab.
      yield put(setLaunchedViaPush(true))
      yield put(onUserClick(username))
      return
    }
    console.error('Push notification payload missing conversation ID or follow type')
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

export function* deletePushTokenSaga(): SagaGenerator<any, any> {
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
  yield safeTakeLatest(Constants.pushToken, pushTokenSaga)
  yield safeTakeLatest(Constants.savePushToken, savePushTokenSaga)
  yield safeTakeLatest(Constants.configurePush, configurePushSaga)
  yield safeTakeEvery(Constants.pushNotification, pushNotificationSaga)
}

export default pushSaga
