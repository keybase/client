// @flow
import * as Constants from '../constants/devices'
import * as Types from '../constants/types/devices'
import * as I from 'immutable'
// import * as LoginGen from './login-gen'
import * as DevicesGen from './devices-gen'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'
import HiddenString from '../util/hidden-string'
import {navigateTo} from './route-tree'
import {type TypedState} from '../constants/reducer'
// import {loginTab} from '../constants/tabs'

function getEndangeredTlfs(action: DevicesGen.ShowRevokePagePayload, state: TypedState) {
  const actingDevice = state.config.deviceID
  if (actingDevice) {
    return Saga.call(RPCTypes.rekeyGetRevokeWarningRpcPromise, {
      actingDevice,
      targetDevice: action.payload.deviceID,
    })
  }
}

function convertEndangeredTlfs(tlfs: RPCTypes.RevokeWarning) {
  return Saga.put(
    DevicesGen.createEndangeredTLFsLoaded({
      tlfs: (tlfs.endangeredTLFs || []).map(t => t.name),
    })
  )
}

function saveEndangeredTlfs(action: DevicesGen.EndangeredTLFsLoadedPayload) {
  return Saga.put(
    DevicesGen.createReplaceEntity({
      entities: I.Map([['idToEndangeredTLFs', I.Set(action.payload.tlfs)]]),
      keyPath: [],
    })
  )
}

function showRevokePage(action: DevicesGen.ShowRevokePagePayload) {
  const {deviceID} = action.payload
  return Saga.put(
    navigateTo([
      ...Constants.devicesTabLocation,
      {props: {deviceID}, selected: 'devicePage'},
      {props: {deviceID}, selected: 'revokeDevice'},
    ])
  )
}

function changeWaiting(
  action:
    | DevicesGen.DevicesLoadPayload
    | DevicesGen.DevicesLoadedPayload
    | DevicesGen.EndangeredTLFsLoadPayload
    | DevicesGen.EndangeredTLFsLoadedPayload
) {
  let waiting
  switch (action.type) {
    case DevicesGen.devicesLoad:
    case DevicesGen.endangeredTLFsLoad:
      waiting = true
      break
    default:
      waiting = false
  }
  return Saga.put(DevicesGen.createSetWaiting({waiting}))
}

function saveWaiting(action: DevicesGen.SetWaitingPayload) {
  return Saga.put(
    DevicesGen.createReplaceEntity({
      entities: I.Map([['waiting', action.payload.waiting]]),
      keyPath: [],
    })
  )
}

function convertDeviceList(results: Array<RPCTypes.DeviceDetail>) {
  const idToDetail = results.reduce((map: {[key: string]: Types.DeviceDetail}, d: RPCTypes.DeviceDetail) => {
    const detail = Constants.makeDeviceDetail({
      created: d.device.cTime,
      currentDevice: d.currentDevice,
      deviceID: d.device.deviceID,
      lastUsed: d.device.lastUsedTime,
      name: d.device.name,
      provisionedAt: d.provisionedAt,
      provisionerName: d.provisioner ? d.provisioner.name : '',
      revokedAt: d.revokedAt,
      revokedByName: d.revokedByDevice ? d.revokedByDevice.name : null,
      // $ForceType avdl typed as string
      type: d.device.type,
    })
    map[d.device.deviceID] = detail
    return map
  }, {})
  return Saga.put(DevicesGen.createDevicesLoaded({idToDetail}))
}

function saveDeviceList(action: DevicesGen.DevicesLoadedPayload) {
  return Saga.put(
    DevicesGen.createReplaceEntity({
      entities: I.Map([['idToDetail', I.Map(action.payload.idToDetail)]]),
      keyPath: [],
    })
  )
}

function getDeviceList(action: DevicesGen.DevicesLoadPayload, state: TypedState) {
  if (!state.config.loggedIn) {
    return []
  } else {
    return Saga.call(RPCTypes.deviceDeviceHistoryListRpcPromise)
  }
}

// function* _deviceRevokedSaga(action: DevicesGen.RevokePayload): Saga.SagaGenerator<any, any> {
// let state: TypedState = yield Saga.select()
// // Record our current route, only navigate away later if it's unchanged.
// const beforeRouteState = state.routeTree.routeState
// // Revoking the current device uses the "deprovision" RPC instead.
// const {deviceID} = action.payload
// const device = state.entities.getIn(['devices', deviceID])
// if (!device) {
// throw new Error("Can't find device to remove")
// }
// const currentDevice = device.currentDevice
// const name = device.name
// if (currentDevice) {
// try {
// const username = state.config ? state.config.username : null
// if (!username) {
// throw new Error('No username in device remove')
// }
// yield Saga.put(DevicesGen.createSetWaiting({waiting: true}))
// yield Saga.call(RPCTypes.loginDeprovisionRpcPromise, {doRevoke: true, username})
// yield Saga.put(navigateTo([loginTab]))
// yield Saga.put(LoginGen.createSetRevokedSelf({revoked: name}))
// } catch (e) {
// throw new Error("Can't remove current device")
// } finally {
// yield Saga.put(DevicesGen.createSetWaiting({waiting: false}))
// }
// } else {
// // Not the current device.
// try {
// yield Saga.put(DevicesGen.createSetWaiting({waiting: true}))
// yield Saga.call(RPCTypes.revokeRevokeDeviceRpcPromise, {
// deviceID,
// forceSelf: false,
// forceLast: false,
// })
// } catch (e) {
// throw new Error("Can't remove device")
// } finally {
// yield Saga.put(DevicesGen.createSetWaiting({waiting: false}))
// }
// }
// yield Saga.put(DevicesGen.createLoad())
// state = yield Saga.select()
// const afterRouteState = state.routeTree.routeState
// if (I.is(beforeRouteState, afterRouteState)) {
// yield Saga.put(navigateTo([...Constants.devicesTabLocation]))
// }
// }

// function* _devicePaperKeySaga(): Saga.SagaGenerator<any, any> {
// let channelMap
// try {
// yield Saga.put(DevicesGen.createSetWaiting({waiting: true}))
// channelMap = RPCTypes.loginPaperKeyRpcChannelMap(
// ['keybase.1.loginUi.promptRevokePaperKeys', 'keybase.1.loginUi.displayPaperKeyPhrase'],
// {}
// )

// while (true) {
// const incoming = yield channelMap.race()

// if (incoming['keybase.1.loginUi.promptRevokePaperKeys']) {
// incoming['keybase.1.loginUi.promptRevokePaperKeys'].response.result(false)
// } else if (incoming['keybase.1.loginUi.displayPaperKeyPhrase']) {
// incoming['keybase.1.loginUi.displayPaperKeyPhrase'].response.result()
// yield Saga.put(DevicesGen.createSetWaiting({waiting: false}))
// const paperKey = new HiddenString(incoming['keybase.1.loginUi.displayPaperKeyPhrase'].params.phrase)
// yield Saga.put(
// navigateTo([...Constants.devicesTabLocation, {props: {paperKey}, selected: 'genPaperKey'}])
// )
// break
// }
// }
// } catch (e) {
// channelMap && channelMap.close()
// throw new Error(`Error in generating paper key ${e}`)
// } finally {
// yield Saga.put(DevicesGen.createSetWaiting({waiting: false}))
// }
// }

function* deviceSaga(): Saga.SagaGenerator<any, any> {
  // Load devices
  yield Saga.safeTakeLatestPure(DevicesGen.devicesLoad, getDeviceList, convertDeviceList)
  yield Saga.safeTakeEveryPure(DevicesGen.devicesLoaded, saveDeviceList)

  // Waiting states
  yield Saga.safeTakeEveryPure(
    [
      DevicesGen.devicesLoad,
      DevicesGen.devicesLoaded,
      DevicesGen.endangeredTLFsLoad,
      DevicesGen.endangeredTLFsLoaded,
    ],
    changeWaiting
  )
  yield Saga.safeTakeEveryPure(DevicesGen.setWaiting, saveWaiting)

  // Revoke page
  yield Saga.safeTakeEveryPure(DevicesGen.showRevokePage, getEndangeredTlfs, convertEndangeredTlfs)
  yield Saga.safeTakeEveryPure(DevicesGen.showRevokePage, showRevokePage)
  yield Saga.safeTakeEveryPure(DevicesGen.endangeredTLFsLoaded, saveEndangeredTlfs)

  // TODO
  // yield Saga.safeTakeEvery(DevicesGen.revoke, _deviceRevokedSaga)
  // yield Saga.safeTakeEvery(DevicesGen.paperKeyMake, _devicePaperKeySaga)
}

export default deviceSaga
