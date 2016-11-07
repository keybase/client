// @flow
import * as Constants from '../constants/push'

// $FlowIssue tell flow about this module
import * as PushNotifications from 'react-native-push-notification'

import {apiserverPostRpcPromise} from '../constants/types/flow-types'

import {call, put, select} from 'redux-saga/effects'
import {takeEvery, takeLatest} from 'redux-saga'

import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

import type {PushNotification, PushNotificationAction, PushPermissionsPromptAction, PushPermissionsRequestAction, PushPermissionsRequestingAction, PushTokenAction, SavePushTokenAction, TokenType, UpdatePushTokenAction} from '../constants/push'

export function permissionsRequest (): PushPermissionsRequestAction {
  return {type: Constants.permissionsRequest, payload: undefined}
}

function * permissionsRequestSaga (): SagaGenerator<any, any> {
  try {
    yield put({type: Constants.permissionsRequesting, payload: true})

    console.log('Requesting permissions')
    const permissions = yield call(() => { return PushNotifications.requestPermissions() })
    console.log('Permissions:', permissions)
    // TODO(gabriel): Set permissions we have in store, might want it at some point?
  } finally {
    yield put({type: Constants.permissionsRequesting, payload: false})
    yield put({type: Constants.permissionsPrompt, payload: false})
  }
}

export function permissionsRequesting (enabled: boolean): PushPermissionsRequestingAction {
  return {type: Constants.permissionsRequesting, payload: enabled}
}

export function permissionsPrompt (enabled: boolean): PushPermissionsPromptAction {
  return {type: Constants.permissionsPrompt, payload: enabled}
}

export function pushNotification (notification: PushNotification): PushNotificationAction {
  return {type: Constants.pushNotification, payload: notification}
}

function * pushNotificationSaga (notification: PushNotification): SagaGenerator<any, any> {
  console.warn('Push notification:', notification)
}

export function pushToken (token: string, tokenType: TokenType): PushTokenAction {
  return {type: Constants.pushToken, payload: {token, tokenType}}
}

function * pushTokenSaga (action: PushTokenAction): SagaGenerator<any, any> {
  const {token, tokenType} = action.payload
  yield put(updatePushToken(token, tokenType))
  yield put(savePushToken())
}

export function savePushToken (): SavePushTokenAction {
  return {type: Constants.savePushToken, payload: undefined}
}

function * savePushTokenSaga (): SagaGenerator<any, any> {
  try {
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

export function updatePushToken (token: string, tokenType: TokenType): UpdatePushTokenAction {
  return {type: Constants.updatePushToken, payload: {token, tokenType}}
}

function * pushSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.permissionsRequest, permissionsRequestSaga),
    takeLatest(Constants.pushToken, pushTokenSaga),
    takeLatest(Constants.savePushToken, savePushTokenSaga),
    takeEvery(Constants.pushNotification, pushNotificationSaga),
  ]
}

export default pushSaga
