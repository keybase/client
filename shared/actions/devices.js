// @flow
import * as Constants from '../constants/devices'
import * as Types from '../constants/types/devices'
import * as I from 'immutable'
import * as LoginGen from './login-gen'
import * as DevicesGen from './devices-gen'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import HiddenString from '../util/hidden-string'
import keyBy from 'lodash/keyBy'
import {isMobile} from '../constants/platform'
import {navigateTo} from './route-tree'
import {replaceEntity} from './entities'
import {type TypedState} from '../constants/reducer'
import {loginTab} from '../constants/tabs'

isMobile &&
  module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in actions/devices')
  })

function* _deviceShowRevokePageSaga(action: DevicesGen.ShowRevokePagePayload): Saga.SagaGenerator<any, any> {
  const {deviceID} = action.payload
  let endangeredTLFs = {endangeredTLFs: []}
  try {
    const state: TypedState = yield Saga.select()
    const actingDevice = state.config.deviceID
    if (actingDevice) {
      endangeredTLFs = yield Saga.call(RPCTypes.rekeyGetRevokeWarningRpcPromise, {
        targetDevice: deviceID,
        actingDevice,
      })
    }
  } catch (e) {
    console.warn('Error getting endangered TLFs:', e)
  }
  yield Saga.put(
    navigateTo([
      ...Constants.devicesTabLocation,
      {props: {deviceID, endangeredTLFs}, selected: 'devicePage'},
      {props: {deviceID, endangeredTLFs}, selected: 'revokeDevice'},
    ])
  )
}

function _sortRecords(a: Types.DeviceDetail, b: Types.DeviceDetail) {
  if (a.currentDevice) return -1
  if (b.currentDevice) return 1
  return a.name.localeCompare(b.name)
}

function* _deviceListSaga(): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const loggedIn = state.config.loggedIn
  if (!loggedIn) {
    return
  }

  yield Saga.put(DevicesGen.createSetWaiting({waiting: true}))

  try {
    const result = yield Saga.call(RPCTypes.deviceDeviceHistoryListRpcPromise)
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
        // $ForceType avdl typed as string
        type: r.device.type,
      })
    })

    const deviceIDs = records.sort(_sortRecords).map(r => r.deviceID)
    const entities = keyBy(records, 'deviceID')

    yield Saga.put(replaceEntity(['devices'], I.Map(entities)))
    yield Saga.put(DevicesGen.createLoaded({deviceIDs}))
  } catch (e) {
    throw new Error("Can't load devices")
  } finally {
    yield Saga.put(DevicesGen.createSetWaiting({waiting: false}))
  }
}

function* _deviceRevokedSaga(action: DevicesGen.RevokePayload): Saga.SagaGenerator<any, any> {
  let state: TypedState = yield Saga.select()
  // Record our current route, only navigate away later if it's unchanged.
  const beforeRouteState = state.routeTree.routeState

  // Revoking the current device uses the "deprovision" RPC instead.
  const {deviceID} = action.payload
  const device = state.entities.getIn(['devices', deviceID])

  if (!device) {
    throw new Error("Can't find device to remove")
  }

  const currentDevice = device.currentDevice
  const name = device.name

  if (currentDevice) {
    try {
      const username = state.config ? state.config.username : null
      if (!username) {
        throw new Error('No username in device remove')
      }
      yield Saga.put(DevicesGen.createSetWaiting({waiting: true}))
      yield Saga.call(RPCTypes.loginDeprovisionRpcPromise, {doRevoke: true, username})
      yield Saga.put(navigateTo([loginTab]))
      yield Saga.put(LoginGen.createSetRevokedSelf({revoked: name}))
    } catch (e) {
      throw new Error("Can't remove current device")
    } finally {
      yield Saga.put(DevicesGen.createSetWaiting({waiting: false}))
    }
  } else {
    // Not the current device.
    try {
      yield Saga.put(DevicesGen.createSetWaiting({waiting: true}))
      yield Saga.call(RPCTypes.revokeRevokeDeviceRpcPromise, {
        deviceID,
        forceSelf: false,
        forceLast: false,
      })
    } catch (e) {
      throw new Error("Can't remove device")
    } finally {
      yield Saga.put(DevicesGen.createSetWaiting({waiting: false}))
    }
  }

  yield Saga.put(DevicesGen.createLoad())

  state = yield Saga.select()
  const afterRouteState = state.routeTree.routeState
  if (I.is(beforeRouteState, afterRouteState)) {
    yield Saga.put(navigateTo([...Constants.devicesTabLocation]))
  }
}

function* _devicePaperKeySaga(): Saga.SagaGenerator<any, any> {
  let channelMap
  try {
    yield Saga.put(DevicesGen.createSetWaiting({waiting: true}))
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
        yield Saga.put(DevicesGen.createSetWaiting({waiting: false}))
        const paperKey = new HiddenString(incoming['keybase.1.loginUi.displayPaperKeyPhrase'].params.phrase)
        yield Saga.put(
          navigateTo([...Constants.devicesTabLocation, {props: {paperKey}, selected: 'genPaperKey'}])
        )
        break
      }
    }
  } catch (e) {
    channelMap && channelMap.close()
    throw new Error(`Error in generating paper key ${e}`)
  } finally {
    yield Saga.put(DevicesGen.createSetWaiting({waiting: false}))
  }
}

function* deviceSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(DevicesGen.load, _deviceListSaga)
  yield Saga.safeTakeEvery(DevicesGen.revoke, _deviceRevokedSaga)
  yield Saga.safeTakeEvery(DevicesGen.paperKeyMake, _devicePaperKeySaga)
  yield Saga.safeTakeEvery(DevicesGen.showRevokePage, _deviceShowRevokePageSaga)
}

export default deviceSaga
