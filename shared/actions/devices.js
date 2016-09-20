// @flow
import * as Constants from '../constants/devices'
import HiddenString from '../util/hidden-string'
import {Map} from 'immutable'
import {devicesTab, loginTab} from '../constants/tabs'
import {loginDeprovisionRpcPromise, revokeRevokeDeviceRpcPromise, deviceDeviceHistoryListRpcPromise, loginPaperKeyRpc} from '../constants/types/flow-types'
import {navigateTo, navigateUp, switchTab} from './router'
import {setRevokedSelf} from './login'
import {buffers, eventChannel, END, takeLatest, takeEvery} from 'redux-saga'
import type {SagaGenerator} from '../constants/types/saga'
import type {GeneratePaperKey, IncomingDisplayPaperKeyPhrase, LoadDevices, LoadingDevices, ShowDevices, RemoveDevice} from '../constants/devices'
import {call, put, take, select} from 'redux-saga/effects'

export function loadDevices (): LoadDevices {
  console.log('in loadDevices')
  return {type: Constants.loadDevices, payload: undefined}
}

export function loadingDevices (): LoadingDevices {
  return {type: Constants.loadingDevices, payload: undefined}
}

export function removeDevice (deviceID: string, name: string, currentDevice: boolean): RemoveDevice {
  return {
    type: Constants.removeDevice,
    payload: {
      deviceID: deviceID, name: name, currentDevice: currentDevice,
    },
  }
}

export function generatePaperKey (): GeneratePaperKey {
  return {type: Constants.generatePaperKey, payload: undefined}
}

function * _deviceListSaga (): SagaGenerator<any, any> {
  console.log('in _deviceListSaga')
  yield put(loadingDevices())
  try {
    const devices = yield call(deviceDeviceHistoryListRpcPromise)
    const showDevicesAction: ShowDevices = {
      type: Constants.showDevices,
      payload: devices,
      error: false,
    }
    yield put(showDevicesAction)
  } catch (e) {
    const showDevicesWithErrorAction: ShowDevices = {
      type: Constants.showDevices,
      payload: e,
      error: true,
    }
    yield put(showDevicesWithErrorAction)
  }
}

function * _deviceRemoveSaga (action: RemoveDevice): SagaGenerator<any, any> {
  if (action.payload.currentDevice) {
    try {
      // Revoking the current device uses the "deprovision" RPC instead.
      const username = yield select(state => state.config && state.config.username)
      if (!username) {
        console.warn('No username in removeDevice')
        return
      }
      yield call(loginDeprovisionRpcPromise, {param: {username, doRevoke: true}})
      yield put({
        type: Constants.deviceRemoved,
        payload: null,
        error: false,
      })
      yield put(loadDevices())
      yield put(setRevokedSelf(action.payload.name))
      yield put(navigateTo([], loginTab))
      yield put(switchTab(loginTab))
    } catch (e) {
      console.warn('Error removing the current device:', e)
      yield put({
        type: Constants.deviceRemoved,
        payload: e,
        error: true,
      })
    }
  } else {
    // Not the current device.
    try {
      console.warn('calling revoke')
      console.warn(action.payload.deviceID)
      yield call(revokeRevokeDeviceRpcPromise, {
        param: {
          deviceID: action.payload.deviceID,
          force: false,
        },
      })
      yield put({
        type: Constants.deviceRemoved,
        payload: null,
        error: false,
      })
    } catch (e) {
      console.warn('Error removing a device:', e)
      yield put({
        type: Constants.deviceRemoved,
        payload: e,
        error: true,
      })
    }
  }
  yield put(loadDevices())
  yield put(navigateUp(devicesTab, Map({path: 'root'})))
}

function _generatePaperKey () {
  return eventChannel(emit => {
    loginPaperKeyRpc({
      incomingCallMap: {
        'keybase.1.loginUi.promptRevokePaperKeys': (param, response) => {
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
  yield put({
    type: Constants.paperKeyLoading,
    payload: null,
  })
  const generatePaperKeyChan = yield call(_generatePaperKey)
  try {
    const displayPaperKeyPhrase:
    ?IncomingDisplayPaperKeyPhrase = yield take(generatePaperKeyChan, 'keybase.1.loginUi.displayPaperKeyPhrase')
    if (!displayPaperKeyPhrase) {
      console.warn('no displayPaperKeyPhrase response')
      yield put({
        type: Constants.paperKeyLoaded,
        error: true,
      })
      return
    }
    yield put({
      type: Constants.paperKeyLoaded,
      payload: displayPaperKeyPhrase.payload.params.paperKey,
    })
    displayPaperKeyPhrase.payload.response.result()
  } catch (e) {
    generatePaperKeyChan && generatePaperKeyChan.close()
    console.warn('error in generating paper key', e)
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
