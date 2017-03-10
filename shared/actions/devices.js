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
import {replaceEntity} from './entities'

import type {DeviceDetail} from '../constants/types/flow-types'
import type {Load, Loaded, Revoke, ShowRevokePage, PaperKeyMake, Waiting} from '../constants/devices'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'

type IncomingDisplayPaperKeyPhrase = {params: {phrase: string}, response: {result: () => void}}

isMobile && module.hot && module.hot.accept(() => {
  console.log('accepted update in actions/devices')
})

const load: () => Load = () => ({payload: undefined, type: 'devices:load'})
const loaded: (deviceIDs: Array<string>) => Loaded = deviceIDs => ({payload: {deviceIDs}, type: 'devices:loaded'})
const paperKeyMake: () => PaperKeyMake = () => ({payload: undefined, type: 'devices:paperKeyMake'})
const revoke: (deviceID: string) => Revoke = deviceID => ({payload: {deviceID}, type: 'devices:revoke'})
const setWaiting: (waiting: boolean) => Waiting = waiting => ({payload: {waiting}, type: 'devices:waiting'})
const showRevokePage: (deviceID: string) => ShowRevokePage = deviceID => ({payload: {deviceID}, type: 'devices:showRevokePage'})

const _loggedInSelector = (state: TypedState) => state.config.loggedIn

function * _deviceShowRevokePageSaga (action: ShowRevokePage): SagaGenerator<any, any> {
  const {deviceID} = action.payload
  let endangeredTLFs = {endangeredTLFs: []}
  try {
    endangeredTLFs = yield call(rekeyGetRevokeWarningRpcPromise, {param: {targetDevice: deviceID}})
  } catch (e) {
    console.warn('Error getting endangered TLFs:', e)
  }
  yield put(navigateTo([devicesTab,
    {props: {deviceID, endangeredTLFs}, selected: 'devicePage'},
    {props: {deviceID, endangeredTLFs}, selected: 'revokeDevice'},
  ]))
}

function _sortDevices (a: DeviceDetail, b: DeviceDetail) {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.device.name.localeCompare(b.device.name)
}

function * _deviceListSaga (): SagaGenerator<any, any> {
  const loggedIn = yield select(_loggedInSelector)
  if (!loggedIn) {
    return
  }

  yield put(setWaiting(true))

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

    yield put(replaceEntity(['devices'], entities))
    yield put(loaded(deviceIDs))
    yield put(setWaiting(false))
  } catch (e) {
    throw new Error("Can't load devices")
  } finally {
    yield put(setWaiting(false))
  }
}

function * _deviceRevokedSaga (action: Revoke): SagaGenerator<any, any> {
  // Record our current route, only navigate away later if it's unchanged.
  const beforeRouteState = yield select(state => state.routeTree.routeState)

  // Revoking the current device uses the "deprovision" RPC instead.
  const {deviceID} = action.payload

  const device = yield select(state => state.entities.getIn(['devices', deviceID]))

  if (!device) {
    throw new Error("Can't find device to remove")
  }

  const currentDevice = device.currentDevice
  const name = device.name

  if (currentDevice) {
    try {
      const username = yield select(state => state.config && state.config.username)
      if (!username) {
        throw new Error('No username in device remove')
      }
      yield put(setWaiting(true))
      yield call(loginDeprovisionRpcPromise, {param: {doRevoke: true, username}})
      yield put(navigateTo([loginTab]))
      yield put(setRevokedSelf(name))
    } catch (e) {
      throw new Error("Can't remove current device")
    } finally {
      yield put(setWaiting(false))
    }
  } else {
    // Not the current device.
    try {
      yield put(setWaiting(true))
      yield call(revokeRevokeDeviceRpcPromise, {param: {deviceID, force: false}})
    } catch (e) {
      throw new Error("Can't remove device")
    } finally {
      yield put(setWaiting(false))
    }
  }

  yield put(load())

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
  const channelConfig = singleFixedChannelConfig(['keybase.1.loginUi.promptRevokePaperKeys', 'keybase.1.loginUi.displayPaperKeyPhrase'])

  const generatePaperKeyChanMap = ((yield call(_generatePaperKey, channelConfig)): any)
  try {
    yield put(setWaiting(true))
    yield fork(_handlePromptRevokePaperKeys, generatePaperKeyChanMap)
    const displayPaperKeyPhrase: IncomingDisplayPaperKeyPhrase = ((yield takeFromChannelMap(generatePaperKeyChanMap, 'keybase.1.loginUi.displayPaperKeyPhrase')): any)
    displayPaperKeyPhrase.response.result()
    yield put(setWaiting(false))

    const paperKey = new HiddenString(displayPaperKeyPhrase.params.phrase)
    yield put(navigateTo([devicesTab, {props: {paperKey}, selected: 'genPaperKey'}]))
  } catch (e) {
    closeChannelMap(generatePaperKeyChanMap)
    throw new Error('error in generating paper key')
  }
}

function * deviceSaga (): SagaGenerator<any, any> {
  yield [
    safeTakeLatest('devices:load', _deviceListSaga),
    safeTakeEvery('devices:revoke', _deviceRevokedSaga),
    safeTakeEvery('devices:paperKeyMake', _devicePaperKeySaga),
    safeTakeEvery('devices:showRevokePage', _deviceShowRevokePageSaga),
  ]
}

export default deviceSaga

export {
  load,
  paperKeyMake,
  revoke,
  showRevokePage,
}
