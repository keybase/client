// @flow
import * as Constants from '../constants/devices'
import {isMobile} from '../constants/platform'
import HiddenString from '../util/hidden-string'
import {is} from 'immutable'
import {call, put, select, fork} from 'redux-saga/effects'
import {deviceDeviceHistoryListRpcPromise, loginDeprovisionRpcPromise, loginPaperKeyRpcChannelMap, revokeRevokeDeviceRpcPromise, rekeyGetRevokeWarningRpcPromise} from '../constants/types/flow-types'
import {devicesTab, loginTab} from '../constants/tabs'
import {navigateTo, navigateAppend} from './route-tree'
import {safeTakeEvery, safeTakeLatest, singleFixedChannelConfig, closeChannelMap, takeFromChannelMap, effectOnChannelMap} from '../util/saga'
import {setRevokedSelf} from './login'

import type {DeviceRemoved, GeneratePaperKey, IncomingDisplayPaperKeyPhrase, LoadDevices, LoadingDevices, PaperKeyLoaded, PaperKeyLoading, RemoveDevice, ShowDevices, ShowRemovePage} from '../constants/devices'
import type {Device} from '../constants/types/more'
import type {SagaGenerator} from '../constants/types/saga'

isMobile && module.hot && module.hot.accept(() => {
  console.log('accepted update in actions/devices')
})

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
  let endangeredTLFs = {endangeredTLFs: []}
  try {
    endangeredTLFs = yield call(rekeyGetRevokeWarningRpcPromise, {param: {targetDevice: device.deviceID}})
  } catch (e) {
    console.warn('Error getting endangered TLFs:', e)
  }
  yield put(navigateAppend([{selected: 'removeDevice', device, endangeredTLFs}], [devicesTab, 'devicePage']))
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
  const beforeRouteState = yield select(state => state.routeTree.routeState)

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
      yield put(navigateTo([loginTab]))
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

  const afterRouteState = yield select(state => state.routeTree.routeState)
  if (is(beforeRouteState, afterRouteState)) {
    yield put(navigateTo([devicesTab]))
  }
}

function _generatePaperKey (channelConfig) {
  return loginPaperKeyRpcChannelMap(channelConfig, {})
}

function * _handlePromptRevokePaperKeys (chanMap): SagaGenerator<any, any> {
  yield effectOnChannelMap(c => safeTakeEvery(c, ({response}) => response.result(false)), chanMap, 'keybase.1.loginUi.promptRevokePaperKeys')
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
    safeTakeLatest(Constants.loadDevices, _deviceListSaga),
    safeTakeEvery(Constants.removeDevice, _deviceRemoveSaga),
    safeTakeEvery(Constants.generatePaperKey, _devicePaperKeySaga),
    safeTakeEvery(Constants.showRemovePage, _deviceShowRemovePageSaga),
  ]
}

export default deviceSaga
