// @flow
import * as Constants from '../constants/devices'
import HiddenString from '../util/hidden-string'
import {Map, is} from 'immutable'
import {devicesTab, loginTab} from '../constants/tabs'

import {navigateTo, navigateUp, routeAppend, switchTab} from './router'
import {setRevokedSelf} from './login'
import {takeEvery, takeLatest} from 'redux-saga'
import {call, put, select, fork} from 'redux-saga/effects'
import {singleFixedChannelConfig, closeChannelMap, takeFromChannelMap, effectOnChannelMap} from '../util/saga'
import {
  deviceDeviceHistoryListRpcPromise,
  loginDeprovisionRpcPromise,
  loginPaperKeyRpcChannelMap,
  revokeRevokeDeviceRpcPromise,
  rekeyGetRevokeWarningRpcPromise,
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
  ShowRemovePage,
} from '../constants/devices'
import type {Device} from '../constants/types/more'
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

export function showRemovePage (device: Device): ShowRemovePage {
  return {type: Constants.showRemovePage, payload: {device}}
}

export function generatePaperKey (): GeneratePaperKey {
  return {type: Constants.generatePaperKey, payload: undefined}
}

function * _deviceShowRemovePageSaga (showRemovePageAction: ShowRemovePage): SagaGenerator<any, any> {
  const device = showRemovePageAction.payload.device
  console.warn('device is')
  console.warn(device)
  const endangeredTLFs = yield call(rekeyGetRevokeWarningRpcPromise, {param: {targetDevice: device.deviceID}})
  console.warn('endangered tlfs are')
  console.warn(endangeredTLFs)
  yield put(routeAppend({path: 'removeDevice', device, endangeredTLFs}))
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

function _generatePaperKey (channelConfig) {
  return loginPaperKeyRpcChannelMap(channelConfig, {})
}

function * _handlePromptRevokePaperKeys (chanMap): SagaGenerator<any, any> {
  yield effectOnChannelMap(c => takeEvery(c, ({response}) => response.result(false)), chanMap, 'keybase.1.loginUi.promptRevokePaperKeys')
}

function * _devicePaperKeySaga (): SagaGenerator<any, any> {
  yield put(({
    type: Constants.paperKeyLoading,
    payload: undefined,
  }: PaperKeyLoading))

  const channelConfig = singleFixedChannelConfig(['keybase.1.loginUi.promptRevokePaperKeys', 'keybase.1.loginUi.displayPaperKeyPhrase'])

  const generatePaperKeyChanMap = ((yield call(_generatePaperKey, channelConfig)): any)
  try {
    yield fork(_handlePromptRevokePaperKeys, generatePaperKeyChanMap)
    const displayPaperKeyPhrase:
      ?IncomingDisplayPaperKeyPhrase = ((yield takeFromChannelMap(generatePaperKeyChanMap, 'keybase.1.loginUi.displayPaperKeyPhrase')): any)
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
      payload: new HiddenString(displayPaperKeyPhrase.params.phrase),
    }: PaperKeyLoaded))
    displayPaperKeyPhrase.response.result()
  } catch (e) {
    closeChannelMap(generatePaperKeyChanMap)
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
    takeEvery(Constants.showRemovePage, _deviceShowRemovePageSaga),
  ]
}

export default deviceSaga
