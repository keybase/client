// @flow
import * as Constants from '../constants/devices'
import * as I from 'immutable'
import * as LoginGen from './login-gen'
import * as RPCTypes from '../constants/types/flow-types'
import HiddenString from '../util/hidden-string'
import keyBy from 'lodash/keyBy'
import {call, put, select} from 'redux-saga/effects'
import {devicesTab as settingsDevicesTab} from '../constants/settings'
import {devicesTab, loginTab, settingsTab} from '../constants/tabs'
import {isMobile} from '../constants/platform'
import {navigateTo} from './route-tree'
import {replaceEntity} from './entities'
import {safeTakeEvery, safeTakeLatest} from '../util/saga'
import {type SagaGenerator} from '../constants/types/saga'
import {type TypedState} from '../constants/reducer'

isMobile &&
  module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in actions/devices')
  })

const load: () => Constants.Load = () => ({payload: undefined, type: 'devices:load'})
const loaded: (deviceIDs: Array<string>) => Constants.Loaded = deviceIDs => ({
  payload: {deviceIDs},
  type: 'devices:loaded',
})
const paperKeyMake: () => Constants.PaperKeyMake = () => ({payload: undefined, type: 'devices:paperKeyMake'})
const revoke: (deviceID: string) => Constants.Revoke = deviceID => ({
  payload: {deviceID},
  type: 'devices:revoke',
})
const setWaiting: (waiting: boolean) => Constants.Waiting = waiting => ({
  payload: {waiting},
  type: 'devices:waiting',
})
const showRevokePage: (deviceID: string) => Constants.ShowRevokePage = deviceID => ({
  payload: {deviceID},
  type: 'devices:showRevokePage',
})

const _loggedInSelector = (state: TypedState) => state.config.loggedIn

const devicesTabLocation = isMobile ? [settingsTab, settingsDevicesTab] : [devicesTab]

function* _deviceShowRevokePageSaga(action: Constants.ShowRevokePage): SagaGenerator<any, any> {
  const {deviceID} = action.payload
  let endangeredTLFs = {endangeredTLFs: []}
  try {
    const state: TypedState = yield select()
    const actingDevice = state.config.deviceID
    if (actingDevice) {
      endangeredTLFs = yield call(RPCTypes.rekeyGetRevokeWarningRpcPromise, {
        param: {targetDevice: deviceID, actingDevice},
      })
    }
  } catch (e) {
    console.warn('Error getting endangered TLFs:', e)
  }
  yield put(
    navigateTo([
      ...devicesTabLocation,
      {props: {deviceID, endangeredTLFs}, selected: 'devicePage'},
      {props: {deviceID, endangeredTLFs}, selected: 'revokeDevice'},
    ])
  )
}

function _sortRecords(a: Constants.DeviceDetail, b: Constants.DeviceDetail) {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.name.localeCompare(b.name)
}

function* _deviceListSaga(): SagaGenerator<any, any> {
  const loggedIn = yield select(_loggedInSelector)
  if (!loggedIn) {
    return
  }

  yield put(setWaiting(true))

  try {
    const result = yield call(RPCTypes.deviceDeviceHistoryListRpcPromise)
    const records = result.map((r: RPCTypes.DeviceDetail) => {
      return Constants.makeDeviceDetail({
        created: r.device.cTime,
        currentDevice: r.currentDevice,
        deviceID: r.device.deviceID,
        lastUsed: r.device.lastUsedTime,
        name: r.device.name,
        provisionedAt: r.provisionedAt,
        provisionerName: r.provisioner ? r.provisioner.name : '',
        revokedAt: r.revokedAt,
        revokedByName: r.revokedByDevice ? r.revokedByDevice.name : null,
        type: r.device.type,
      })
    })

    const deviceIDs = records.sort(_sortRecords).map(r => r.deviceID)
    const entities = keyBy(records, 'deviceID')

    yield put(replaceEntity(['devices'], I.Map(entities)))
    yield put(loaded(deviceIDs))
  } catch (e) {
    throw new Error("Can't load devices")
  } finally {
    yield put(setWaiting(false))
  }
}

function* _deviceRevokedSaga(action: Constants.Revoke): SagaGenerator<any, any> {
  // Record our current route, only navigate away later if it's unchanged.
  const beforeRouteState = yield select((state: TypedState) => state.routeTree.routeState)

  // Revoking the current device uses the "deprovision" RPC instead.
  const {deviceID} = action.payload

  const device = yield select((state: TypedState) => state.entities.getIn(['devices', deviceID]))

  if (!device) {
    throw new Error("Can't find device to remove")
  }

  const currentDevice = device.currentDevice
  const name = device.name

  if (currentDevice) {
    try {
      const username = yield select((state: TypedState) => state.config && state.config.username)
      if (!username) {
        throw new Error('No username in device remove')
      }
      yield put(setWaiting(true))
      yield call(RPCTypes.loginDeprovisionRpcPromise, {param: {doRevoke: true, username}})
      yield put(navigateTo([loginTab]))
      yield put(LoginGen.createSetRevokedSelf({revoked: name}))
    } catch (e) {
      throw new Error("Can't remove current device")
    } finally {
      yield put(setWaiting(false))
    }
  } else {
    // Not the current device.
    try {
      yield put(setWaiting(true))
      yield call(RPCTypes.revokeRevokeDeviceRpcPromise, {
        param: {deviceID, forceSelf: false, forceLast: false},
      })
    } catch (e) {
      throw new Error("Can't remove device")
    } finally {
      yield put(setWaiting(false))
    }
  }

  yield put(load())

  const afterRouteState = yield select((state: TypedState) => state.routeTree.routeState)
  if (I.is(beforeRouteState, afterRouteState)) {
    yield put(navigateTo([...devicesTabLocation]))
  }
}

function* _devicePaperKeySaga(): SagaGenerator<any, any> {
  let channelMap
  try {
    yield put(setWaiting(true))
    channelMap = RPCTypes.loginPaperKeyRpcChannelMap(
      ['keybase.1.loginUi.promptRevokePaperKeys', 'keybase.1.loginUi.displayPaperKeyPhrase'],
      {}
    )

    while (true) {
      const incoming = yield channelMap.race()

      if (incoming['keybase.1.loginUi.promptRevokePaperKeys']) {
        incoming['keybase.1.loginUi.promptRevokePaperKeys'].response.result(false)
      } else if (incoming['keybase.1.loginUi.displayPaperKeyPhrase']) {
        incoming['keybase.1.loginUi.displayPaperKeyPhrase'].response.result()
        yield put(setWaiting(false))
        const paperKey = new HiddenString(incoming['keybase.1.loginUi.displayPaperKeyPhrase'].params.phrase)
        yield put(navigateTo([...devicesTabLocation, {props: {paperKey}, selected: 'genPaperKey'}]))
        break
      }
    }
  } catch (e) {
    channelMap && channelMap.close()
    throw new Error(`Error in generating paper key ${e}`)
  } finally {
    yield put(setWaiting(false))
  }
}

function* deviceSaga(): SagaGenerator<any, any> {
  yield safeTakeLatest('devices:load', _deviceListSaga)
  yield safeTakeEvery('devices:revoke', _deviceRevokedSaga)
  yield safeTakeEvery('devices:paperKeyMake', _devicePaperKeySaga)
  yield safeTakeEvery('devices:showRevokePage', _deviceShowRevokePageSaga)
}

export default deviceSaga

export {load, paperKeyMake, revoke, setWaiting, showRevokePage, devicesTabLocation}
