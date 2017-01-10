// @flow
import * as Constants from '../constants/push'
import {apiserverPostRpcPromise} from '../constants/types/flow-types'
import {call, put, select, takeEvery, takeLatest} from 'redux-saga/effects'

import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

import type {PushNotification, PushNotificationAction, PushPermissionsPromptAction, PushPermissionsRequestAction, PushPermissionsRequestingAction, PushTokenAction, SavePushTokenAction, TokenType, UpdatePushTokenAction} from '../constants/push'

// $FlowIssue
import {requestPushPermissions} from './platform.specific'

export function permissionsRequest (): PushPermissionsRequestAction {
  return {type: Constants.permissionsRequest, payload: undefined}
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

export function pushToken (token: string, tokenType: TokenType): PushTokenAction {
  return {type: Constants.pushToken, payload: {token, tokenType}}
}

export function savePushToken (): SavePushTokenAction {
  return {type: Constants.savePushToken, payload: undefined}
}

export function updatePushToken (token: string, tokenType: TokenType): UpdatePushTokenAction {
  return {type: Constants.updatePushToken, payload: {token, tokenType}}
}

function * permissionsRequestSaga (): SagaGenerator<any, any> {
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

function * pushNotificationSaga (notification: PushNotification): SagaGenerator<any, any> {
  // TODO: Handle push notifications
  console.warn('Push notification:', notification)
}

function * pushTokenSaga (action: PushTokenAction): SagaGenerator<any, any> {
  const {token, tokenType} = action.payload
  yield put(updatePushToken(token, tokenType))
  yield put(savePushToken())
}

function * savePushTokenSaga (): SagaGenerator<any, any> {
  try {
    const pushSelector = ({push: {token, tokenType}}: TypedState) => ({token, tokenType})
    const {token, tokenType} = ((yield select(pushSelector)): any)

    const extendedConfigSelector = ({config: {extendedConfig}}: TypedState) => extendedConfig
    const extendedConfig = ((yield select(extendedConfigSelector)): any)

    if (!extendedConfig || !extendedConfig.defaultDeviceID) {
      throw new Error('No device available for saving push token:', extendedConfig)
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

function * pushSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.permissionsRequest, permissionsRequestSaga),
    takeLatest(Constants.pushToken, pushTokenSaga),
    takeLatest(Constants.savePushToken, savePushTokenSaga),
    takeEvery(Constants.pushNotification, pushNotificationSaga),
  ]
}

export default pushSaga
