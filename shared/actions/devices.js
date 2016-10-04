// @flow
import * as Constants from '../constants/devices'
import HiddenString from '../util/hidden-string'
import {Map, is} from 'immutable'
import {devicesTab, loginTab} from '../constants/tabs'

import {navigateTo, navigateUp, switchTab} from './router'
import {setRevokedSelf} from './login'
import {buffers, eventChannel, END, takeEvery, takeLatest} from 'redux-saga'
import {call, put, select, take} from 'redux-saga/effects'
import {
  deviceDeviceHistoryListRpcPromise,
  loginDeprovisionRpcPromise,
  loginPaperKeyRpc,
  revokeRevokeDeviceRpcPromise,
} from '../constants/types/flow-types'

import type {
  DeviceRemoved,
  GeneratePaperKey,
  IncomingDisplayPaperKeyPhrase,
  LoadDevices,
  LoadingDevices,
  PaperKeyLoaded,
  PaperKeyLoading,
  RemoveDevice,
  ShowDevices,
} from '../constants/devices'
import type {SagaGenerator} from '../constants/types/saga'

export function loadDevices (): LoadDevices {
  return {type: Constants.loadDevices, payload: undefined}
}

export function loadingDevices (): LoadingDevices {
  return {type: Constants.loadingDevices, payload: undefined}
}

export function removeDevice (deviceID: string, name: string, currentDevice: boolean): RemoveDevice {
  return {type: Constants.removeDevice, payload: {deviceID, name, currentDevice}}
}

export function generatePaperKey (): GeneratePaperKey {
  return {type: Constants.generatePaperKey, payload: undefined}
}

function * _deviceListSaga (): SagaGenerator<any, any> {
  yield put(loadingDevices())
  try {
    const devices = yield call(deviceDeviceHistoryListRpcPromise)
    yield put(({
      type: Constants.showDevices,
      payload: devices,
    }: ShowDevices))
  } catch (e) {
    yield put(({
      type: Constants.showDevices,
      payload: {errorText: e.desc + e.name, errorObj: e},
      error: true,
    }: ShowDevices))
  }
}

function * _deviceRemoveSaga (removeAction: RemoveDevice): SagaGenerator<any, any> {
  // Record our current route, only navigate away later if it's unchanged.
  const activeTab = yield select(state => state.router && state.router.get('activeTab'))
  const beforeUri = yield select(state => state.router.get('tabs').get(activeTab).get('uri'))

  // Revoking the current device uses the "deprovision" RPC instead.
  const {currentDevice, name, deviceID} = removeAction.payload
  if (currentDevice) {
    try {
      const username = yield select(state => state.config && state.config.username)
      if (!username) {
        const error = {errorText: 'No username in removeDevice'}
        console.warn(error)
        yield put(({
          type: Constants.deviceRemoved,
          payload: error,
          error: true,
        }: DeviceRemoved))
      }
      yield call(loginDeprovisionRpcPromise, {param: {username, doRevoke: true}})
      yield put(navigateTo([], loginTab))
      yield put(switchTab(loginTab))
      yield put(setRevokedSelf(name))
      yield put(({
        type: Constants.deviceRemoved,
        payload: undefined,
      }: DeviceRemoved))
    } catch (e) {
      console.warn('Error removing the current device:', e)
      yield put(({
        type: Constants.deviceRemoved,
        payload: {errorText: e.desc + e.name, errorObj: e},
        error: true,
      }: DeviceRemoved))
    }
  } else {
    // Not the current device.
    try {
      yield call(revokeRevokeDeviceRpcPromise, {
        param: {deviceID, force: false},
      })
      yield put(({
        type: Constants.deviceRemoved,
        payload: undefined,
      }: DeviceRemoved))
    } catch (e) {
      console.warn('Error removing a device:', e)
      yield put(({
        type: Constants.deviceRemoved,
        payload: {errorText: e.desc + e.name, errorObj: e},
        error: true,
      }: DeviceRemoved))
    }
  }
  yield put(loadDevices())

  const afterUri = yield select(state => state.router.get('tabs').get(activeTab).get('uri'))
  if (is(beforeUri, afterUri)) {
    yield put(navigateUp(devicesTab, Map({path: 'root'})))
  }
}

function _generatePaperKey () {
  return eventChannel(emit => {
    loginPaperKeyRpc({
      incomingCallMap: {
        'keybase.1.loginUi.promptRevokePaperKeys': (param, response) => {
          // We only pretend to support this RPC.
          response.result(false)
        },
        'keybase.1.loginUi.displayPaperKeyPhrase': ({phrase: paperKey}, response) => {
          emit(({
            type: 'keybase.1.loginUi.displayPaperKeyPhrase',
            payload: {params: {paperKey: new HiddenString(paperKey)}, response},
          }: IncomingDisplayPaperKeyPhrase))
        },
      },
      callback: (error) => {
        emit({
          type: 'finished',
          payload: {error},
        })
        emit(END)
      },
    })

    // TODO(MM) this is the unsubscribe function, not sure what we can do here,
    // maybe cancel ongoing rpc requests?
    return () => {}
  }, buffers.fixed())
}

function * _devicePaperKeySaga (): SagaGenerator<any, any> {
  yield put(({
    type: Constants.paperKeyLoading,
    payload: undefined,
  }: PaperKeyLoading))

  const generatePaperKeyChan = yield call(_generatePaperKey)
  try {
    const displayPaperKeyPhrase:
    ?IncomingDisplayPaperKeyPhrase = yield take(generatePaperKeyChan, 'keybase.1.loginUi.displayPaperKeyPhrase')
    if (!displayPaperKeyPhrase) {
      const error = {errorText: 'no displayPaperKeyPhrase response'}
      console.warn(error.errorText)
      yield put(({
        type: Constants.paperKeyLoaded,
        payload: error,
        error: true,
      }: PaperKeyLoaded))
      return
    }
    yield put(({
      type: Constants.paperKeyLoaded,
      payload: displayPaperKeyPhrase.payload.params.paperKey,
    }: PaperKeyLoaded))
    displayPaperKeyPhrase.payload.response.result()
  } catch (e) {
    generatePaperKeyChan && generatePaperKeyChan.close()
    console.warn('error in generating paper key', e)
    yield put(({
      type: Constants.paperKeyLoaded,
      payload: {errorText: e.desc + e.name, errorObj: e},
      error: true,
    }: PaperKeyLoaded))
  }
}

function * deviceSaga (): SagaGenerator<any, any> {
  yield [
    takeLatest(Constants.loadDevices, _deviceListSaga),
    takeEvery(Constants.removeDevice, _deviceRemoveSaga),
    takeEvery(Constants.generatePaperKey, _devicePaperKeySaga),
  ]
}

export default deviceSaga
