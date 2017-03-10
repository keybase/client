// @flow
import * as I from 'immutable'
import HiddenString from '../util/hidden-string'
import {DeviceDetailRecord} from '../constants/devices'
import {call, put, select, fork} from 'redux-saga/effects'
import {deviceDeviceHistoryListRpcPromise, loginDeprovisionRpcPromise, loginPaperKeyRpcChannelMap, revokeRevokeDeviceRpcPromise, rekeyGetRevokeWarningRpcPromise} from '../constants/types/flow-types'
import {devicesTab, loginTab} from '../constants/tabs'
import {isMobile} from '../constants/platform'
import {navigateTo} from './route-tree'
import {safeTakeEvery, safeTakeLatest, singleFixedChannelConfig, closeChannelMap, takeFromChannelMap, effectOnChannelMap} from '../util/saga'
import {setRevokedSelf} from './login'

import type {DeviceDetail} from '../constants/types/flow-types'
import type {DeviceRemoved, GeneratePaperKey, IncomingDisplayPaperKeyPhrase, LoadDevices, LoadingDevices, PaperKeyLoaded, PaperKeyLoading, RemoveDevice, LoadedDevices, ShowRemovePage} from '../constants/devices'
import type {Device} from '../constants/types/more'
import type {Replace} from '../constants/entities'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

isMobile && module.hot && module.hot.accept(() => {
  console.log('accepted update in actions/devices')
})

export function loadDevices (): LoadDevices {
  return {payload: undefined, type: 'devices:loadDevices'}
}

export function loadingDevices (): LoadingDevices {
  return {payload: undefined, type: 'devices:loadingDevices'}
}

export function removeDevice (deviceID: string, name: string, currentDevice: boolean): RemoveDevice {
  return {payload: {currentDevice, deviceID, name}, type: 'devices:removeDevice'}
}

export function showRemovePage (device: Device): ShowRemovePage {
  return {payload: {device}, type: 'devices:showRemovePage'}
}

export function generatePaperKey (): GeneratePaperKey {
  return {payload: undefined, type: 'devices:generatePaperKey'}
}

function * _deviceShowRemovePageSaga (showRemovePageAction: ShowRemovePage): SagaGenerator<any, any> {
  const device = showRemovePageAction.payload.device
  let endangeredTLFs = {endangeredTLFs: []}
  try {
    endangeredTLFs = yield call(rekeyGetRevokeWarningRpcPromise, {param: {targetDevice: device.deviceID}})
  } catch (e) {
    console.warn('Error getting endangered TLFs:', e)
  }
  yield put(navigateTo([devicesTab,
    {props: {device, endangeredTLFs}, selected: 'devicePage'},
    {props: {device, endangeredTLFs}, selected: 'removeDevice'},
  ]))
}

const _waitingSelector = (state: TypedState) => state.devices.get('waitingForServer')
const _loggedInSelector = (state: TypedState) => state.config.loggedIn

function _sortDevices (a: DeviceDetail, b: DeviceDetail) {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.device.name.localeCompare(b.device.name)
}

function * _deviceListSaga (): SagaGenerator<any, any> {
  const waitingForServer = yield select(_waitingSelector)
  if (waitingForServer) {
    return
  }
  const loggedIn = yield select(_loggedInSelector)
  if (!loggedIn) {
    return
  }

  yield put(loadingDevices())
  try {
    const result = yield call(deviceDeviceHistoryListRpcPromise)
    const entities = result.reduce((map, d: DeviceDetail) => {
      map[d.device.deviceID] = new DeviceDetailRecord({
        created: d.device.cTime,
        currentDevice: d.currentDevice,
        deviceID: d.device.deviceID,
        lastUsed: d.device.lastUsedTime,
        name: d.device.name,
        provisionedAt: d.provisionedAt,
        revokedAt: d.revokedAt,
        revokedBy: d.revokedByDevice,
        type: d.device.type,
      })
      return map
    }, {})

    const deviceIDs = result
      .sort(_sortDevices)
      .map(d => d.device.deviceID)

    yield put(({payload: {entities, keyPath: ['devices']}, type: 'entity:replace'}: Replace))
    yield put(({payload: {deviceIDs}, type: 'devices:loadedDevices'}: LoadedDevices))
  } catch (e) {
    throw new Error("Can't load devices")
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
        throw new Error('No username in device remove')
      }
      yield call(loginDeprovisionRpcPromise, {param: {doRevoke: true, username}})
      yield put(navigateTo([loginTab]))
      yield put(setRevokedSelf(name))
      yield put(({
        payload: undefined,
        type: 'devices:deviceRemoved',
      }: DeviceRemoved))
    } catch (e) {
      throw new Error("Can't remove current device")
    }
  } else {
    // Not the current device.
    try {
      yield call(revokeRevokeDeviceRpcPromise, {
        param: {deviceID, force: false},
      })
      yield put(({
        payload: undefined,
        type: 'devices:deviceRemoved',
      }: DeviceRemoved))
    } catch (e) {
      throw new Error("Can't remove device")
    }
  }
  yield put(loadDevices())

  const afterRouteState = yield select(state => state.routeTree.routeState)
  if (I.is(beforeRouteState, afterRouteState)) {
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
    payload: undefined,
    type: 'devices:paperKeyLoading',
  }: PaperKeyLoading))

  const channelConfig = singleFixedChannelConfig(['keybase.1.loginUi.promptRevokePaperKeys', 'keybase.1.loginUi.displayPaperKeyPhrase'])

  const generatePaperKeyChanMap = ((yield call(_generatePaperKey, channelConfig)): any)
  try {
    yield fork(_handlePromptRevokePaperKeys, generatePaperKeyChanMap)
    const displayPaperKeyPhrase: IncomingDisplayPaperKeyPhrase = ((yield takeFromChannelMap(generatePaperKeyChanMap, 'keybase.1.loginUi.displayPaperKeyPhrase')): any)
    yield put(({
      payload: {paperKey: new HiddenString(displayPaperKeyPhrase.params.phrase)},
      type: 'devices:paperKeyLoaded',
    }: PaperKeyLoaded))
    displayPaperKeyPhrase.response.result()
  } catch (e) {
    closeChannelMap(generatePaperKeyChanMap)
    throw new Error('error in generating paper key')
  }
}

function * deviceSaga (): SagaGenerator<any, any> {
  yield [
    safeTakeLatest('devices:loadDevices', _deviceListSaga),
    safeTakeEvery('devices:removeDevice', _deviceRemoveSaga),
    safeTakeEvery('devices:generatePaperKey', _devicePaperKeySaga),
    safeTakeEvery('devices:showRemovePage', _deviceShowRemovePageSaga),
  ]
}

export default deviceSaga
