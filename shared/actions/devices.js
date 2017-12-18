// @flow
import * as Constants from '../constants/devices'
import * as DevicesGen from './devices-gen'
import * as I from 'immutable'
import * as LoginGen from './login-gen'
import * as RPCTypes from '../constants/types/flow-types'
import * as RouteActions from './route-tree'
import * as RouteTree from '../route-tree'
import * as Saga from '../util/saga'
import * as Types from '../constants/types/devices'
import * as WaitingGen from './waiting-gen'
import HiddenString from '../util/hidden-string'
import {loginTab} from '../constants/tabs'
import {type TypedState} from '../constants/reducer'

const requestEndangeredTLFsLoad = (action: DevicesGen.ShowRevokePagePayload) =>
  Saga.put(
    DevicesGen.createEndangeredTLFsLoad({
      deviceID: action.payload.deviceID,
    })
  )

const rpcEndangeredTlfs = (action: DevicesGen.ShowRevokePagePayload, state: TypedState) =>
  state.config.deviceID
    ? Saga.call(RPCTypes.rekeyGetRevokeWarningRpcPromise, {
        actingDevice: state.config.deviceID,
        targetDevice: action.payload.deviceID,
      })
    : null

const dispatchEndangeredTLFsLoaded = (
  tlfs: RPCTypes.RevokeWarning,
  action: DevicesGen.ShowRevokePagePayload
) =>
  Saga.put(
    DevicesGen.createEndangeredTLFsLoaded({
      deviceID: action.payload.deviceID,
      tlfs: (tlfs.endangeredTLFs || []).map(t => t.name),
    })
  )

const showRevokePage = (action: DevicesGen.ShowRevokePagePayload) =>
  Saga.put(
    RouteActions.navigateTo([
      ...Constants.devicesTabLocation,
      {props: {deviceID: action.payload.deviceID}, selected: 'devicePage'},
      {props: {deviceID: action.payload.deviceID}, selected: 'revokeDevice'},
    ])
  )

const changeWaiting = (action: DevicesGen.Actions) => {
  let waiting
  switch (action.type) {
    case DevicesGen.deviceRevoke:
    case DevicesGen.devicesLoad:
    case DevicesGen.endangeredTLFsLoad:
    case DevicesGen.paperKeyMake:
      waiting = true
      break
    default:
      waiting = false
  }
  const payload = {key: Constants.waitingKey}
  return Saga.put(
    waiting ? WaitingGen.createIncrementWaiting(payload) : WaitingGen.createDecrementWaiting(payload)
  )
}

const rpcDeviceList = (action: DevicesGen.DevicesLoadPayload, state: TypedState) =>
  state.config.loggedIn ? Saga.call(RPCTypes.deviceDeviceHistoryListRpcPromise) : Saga.identity([])

const dispatchDevicesLoadedError = () => Saga.put(DevicesGen.createDevicesLoadedError())

const dispatchDevicesLoaded = (results: Array<RPCTypes.DeviceDetail>) => {
  const devices = results.map((d: RPCTypes.DeviceDetail) =>
    Constants.makeDeviceDetail({
      created: d.device.cTime,
      currentDevice: d.currentDevice,
      deviceID: Types.stringToDeviceID(d.device.deviceID),
      lastUsed: d.device.lastUsedTime,
      name: d.device.name,
      provisionedAt: d.provisionedAt,
      provisionerName: d.provisioner ? d.provisioner.name : '',
      revokedAt: d.revokedAt,
      revokedByName: d.revokedByDevice ? d.revokedByDevice.name : null,
      type: Types.stringToDeviceType(d.device.type),
    })
  )

  const idToDetail: I.Map<Types.DeviceID, Types.DeviceDetail> = I.Map(devices.map(d => [d.deviceID, d]))
  return Saga.put(DevicesGen.createDevicesLoaded({idToDetail}))
}

function* makePaperKey(): Saga.SagaGenerator<any, any> {
  let channelMap
  try {
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
        const paperKey = new HiddenString(incoming['keybase.1.loginUi.displayPaperKeyPhrase'].params.phrase)
        yield Saga.put(DevicesGen.createPaperKeyCreated({paperKey}))
        break
      }
    }
  } catch (e) {
    channelMap && channelMap.close()
    throw new Error(`Error in generating paper key ${e}`)
  }
}

const showPaperKeyCreatedPage = (action: DevicesGen.PaperKeyCreatedPayload, state: TypedState) =>
  Saga.put(
    RouteActions.putActionIfOnPath(
      Constants.devicesTabLocation,
      RouteActions.navigateTo([
        ...Constants.devicesTabLocation,
        {props: {paperKey: action.payload.paperKey}, selected: 'genPaperKey'},
      ])
    )
  )

function rpcRevoke(action: DevicesGen.DeviceRevokePayload, state: TypedState) {
  const {deviceID} = action.payload
  const device = state.devices.idToDetail.get(deviceID)
  if (!device) {
    throw new Error("Can't find device to remove")
  }
  if (device.currentDevice) {
    const username = state.config ? state.config.username : null
    if (!username) {
      throw new Error('No username in device remove')
    }
    return Saga.all([
      Saga.identity({deviceID, deviceName: device.name, wasCurrentDevice: true}),
      Saga.call(RPCTypes.loginDeprovisionRpcPromise, {doRevoke: true, username}),
    ])
  } else {
    return Saga.all([
      Saga.identity({deviceID, wasCurrentDevice: false}),
      Saga.call(RPCTypes.revokeRevokeDeviceRpcPromise, {
        deviceID,
        forceLast: false,
        forceSelf: false,
      }),
    ])
  }
}

const dispatchRevoked = ([{deviceID, wasCurrentDevice, deviceName}]) =>
  Saga.put(
    DevicesGen.createDeviceRevoked({
      deviceID,
      deviceName,
      wasCurrentDevice,
    })
  )

const navigateAfterRevoked = (action: DevicesGen.DeviceRevokedPayload, state: TypedState) => {
  if (action.payload.wasCurrentDevice) {
    return Saga.sequentially([
      Saga.put(RouteActions.navigateTo([loginTab])),
      Saga.put(LoginGen.createSetRevokedSelf({revoked: action.payload.deviceName})),
    ])
  } else {
    const current = RouteTree.getPath(state.routeTree.routeState)
    // Still on the revoke page waiting?
    if (current.equals(I.List([...Constants.devicesTabLocation, 'devicePage', 'revokeDevice']))) {
      return Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation]))
    }
  }
}

function* deviceSaga(): Saga.SagaGenerator<any, any> {
  // Load devices
  yield Saga.safeTakeLatestPure(
    DevicesGen.devicesLoad,
    rpcDeviceList,
    dispatchDevicesLoaded,
    dispatchDevicesLoadedError
  )

  // Waiting states
  yield Saga.safeTakeEveryPure(
    [
      DevicesGen.devicesLoad,
      DevicesGen.devicesLoaded,
      DevicesGen.endangeredTLFsLoad,
      DevicesGen.endangeredTLFsLoaded,
      DevicesGen.paperKeyMake,
      DevicesGen.paperKeyCreated,
      DevicesGen.deviceRevoke,
      DevicesGen.deviceRevoked,
    ],
    changeWaiting
  )

  // Revoke page
  yield Saga.safeTakeEveryPure(DevicesGen.showRevokePage, requestEndangeredTLFsLoad)
  yield Saga.safeTakeEveryPure(DevicesGen.showRevokePage, showRevokePage)
  yield Saga.safeTakeEveryPure(DevicesGen.endangeredTLFsLoad, rpcEndangeredTlfs, dispatchEndangeredTLFsLoaded)

  // Making Paperkey flow
  yield Saga.safeTakeEvery(DevicesGen.paperKeyMake, makePaperKey)
  yield Saga.safeTakeEveryPure(DevicesGen.paperKeyCreated, showPaperKeyCreatedPage)

  yield Saga.safeTakeEveryPure(DevicesGen.deviceRevoke, rpcRevoke, dispatchRevoked)
  yield Saga.safeTakeEveryPure(DevicesGen.deviceRevoked, navigateAfterRevoked)
}

export const _testing = {
  changeWaiting,
  dispatchDevicesLoaded,
  requestEndangeredTLFsLoad,
}

export default deviceSaga
