// @flow
import * as Constants from '../constants/push'
import PushNotification from 'react-native-push-notification'

import {apiserverPostRpcPromise} from '../constants/types/flow-types'

import {call, put, select, fork, cancel} from 'redux-saga/effects'
import {takeEvery, takeLatest, delay} from 'redux-saga'

import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

import type {PushPermissionsPrompt, PushPermissionsRequest, PushPermissionsRequesting, PushToken, SavePushToken, TokenType, UpdatePushToken} from '../constants/push'

export function permissionsRequest (): PushPermissionsRequest {
  return {type: Constants.permissionsRequest, payload: undefined}
}

export function permissionsRequesting (enabled: boolean): PushPermissionsRequesting {
  return {type: Constants.permissionsRequesting, payload: enabled}
}

export function permissionsPrompt (enabled: boolean): PushPermissionsPrompt {
  return {type: Constants.permissionsPrompt, payload: enabled}
}

export function pushToken (token: string, tokenType: TokenType): PushToken {
  return {type: Constants.pushToken, payload: {token, tokenType}}
}

export function updatePushToken (token: string, tokenType: TokenType): UpdatePushToken {
  return {type: Constants.updatePushToken, payload: {token, tokenType}}
}

export function savePushToken (): SavePushToken {
  return {type: Constants.savePushToken, payload: undefined}
}

function * pushTokenSaga (token: string, tokenType: TokenType): SagaGenerator<any, any> {
  yield put(updatePushToken(token, tokenType))
  yield put(savePushToken())
}

function * savePushTokenSaga (): SagaGenerator<any, any> {
  const pushSelector = (state: TypedState) => state.push
  const {token, tokenType} = ((yield select(pushSelector)): any)

  const extendedConfig = yield select(state => state.config.extendedConfig)

  if (!extendedConfig || !extendedConfig.defaultDeviceID) {
    throw new Error('No device available for saving push token')
  }
  const deviceID = extendedConfig.defaultDeviceID
  if (!token) {
    throw new Error('No push token available to save')
  }

  const result = yield call(apiserverPostRpcPromise, {
    param: {
      endpoint: 'device/push_token',
      args: [
        {key: 'push_token', value: token},
        {key: 'device_id', value: deviceID},
        {key: 'token_type', value: tokenType},
      ],
    },
  })
}

function * permissionsRequestSaga (): SagaGenerator<any, any> {
  try {
    yield put({type: Constants.permissionsRequesting, payload: true})

    console.log('Requesting permissions')
    const permissions = yield call(() => { return PushNotification.requestPermissions() })
    // TODO(gabriel): Set permissions we have in state, might need it at some point?
  } finally {
    yield put({type: Constants.permissionsRequesting, payload: false})
    yield put({type: Constants.permissionsPrompt, payload: false})
  }
}

function * pushSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.permissionsRequest, permissionsRequestSaga),
    takeLatest(Constants.pushToken, pushTokenSaga),
    takeLatest(Constants.savePushToken, savePushTokenSaga),
  ]
}

export default pushSaga
