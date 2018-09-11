// @flow
import * as Constants from '../constants/devices'
import * as DevicesGen from './devices-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteActions from './route-tree'
import * as Saga from '../util/saga'
import HiddenString from '../util/hidden-string'
import {loginTab} from '../constants/tabs'
import {type TypedState} from '../constants/reducer'

const load = (state: TypedState) =>
  state.config.loggedIn &&
  RPCTypes.deviceDeviceHistoryListRpcPromise(undefined, Constants.waitingKey)
    .then((results: ?Array<RPCTypes.DeviceDetail>) => {
      const devices = (results || []).map(d => Constants.rpcDeviceToDevice(d))
      return DevicesGen.createLoaded({devices})
    })
    .catch(() => {})

const requestPaperKey = () =>
  Saga.call(function*() {
    yield RPCTypes.loginPaperKeyRpcSaga({
      incomingCallMap: {
        'keybase.1.loginUi.displayPaperKeyPhrase': ({
          phrase,
        }: RPCTypes.LoginUiDisplayPaperKeyPhraseRpcParam) =>
          Saga.put(DevicesGen.createPaperKeyCreated({paperKey: new HiddenString(phrase)})),
        'keybase.1.loginUi.promptRevokePaperKeys': (_, response) => {
          response.result(false)
        },
      },
      params: undefined,
      waitingKey: Constants.waitingKey,
    })
  })

const requestEndangeredTLFsLoad = (state: TypedState) => {
  const actingDevice = state.config.deviceID
  const targetDevice = state.devices.selectedDeviceID
  return actingDevice && targetDevice
    ? RPCTypes.rekeyGetRevokeWarningRpcPromise({actingDevice, targetDevice}, Constants.waitingKey)
        .then((tlfs: RPCTypes.RevokeWarning) =>
          DevicesGen.createEndangeredTLFsLoaded({
            deviceID: targetDevice,
            tlfs: (tlfs.endangeredTLFs || []).map(t => t.name),
          })
        )
        .catch(e => {
          console.error(e)
        })
    : null
}

const revoke = (state: TypedState, action: DevicesGen.RevokePayload) => {
  const {deviceID} = action.payload
  const device = Constants.getDevice(state, deviceID)
  if (!device) {
    throw new Error("Can't find device to remove")
  }
  const username = state.config ? state.config.username : null
  if (!username) {
    throw new Error('No username in device remove')
  }

  const wasCurrentDevice = device.currentDevice
  const deviceName = device.name
  if (wasCurrentDevice) {
    return RPCTypes.loginDeprovisionRpcPromise({doRevoke: true, username}, Constants.waitingKey).then(() =>
      DevicesGen.createRevoked({deviceID, deviceName, wasCurrentDevice})
    )
  } else {
    return RPCTypes.revokeRevokeDeviceRpcPromise(
      {deviceID, forceLast: false, forceSelf: false},
      Constants.waitingKey
    ).then(() => {
      return DevicesGen.createRevoked({deviceID, deviceName, wasCurrentDevice})
    })
  }
}

const navigateAfterRevoked = (state: TypedState, action: DevicesGen.RevokedPayload) =>
  action.payload.wasCurrentDevice
    ? Saga.put(RouteActions.navigateTo([loginTab]))
    : Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation]))

const showRevokePage = () =>
  Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation, 'devicePage', 'revokeDevice']))

const showDevicePage = () =>
  Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation, 'devicePage']))

const showPaperKeyPage = () =>
  Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation, 'paperKey']))

function* deviceSaga(): Saga.SagaGenerator<any, any> {
  // Load devices
  yield Saga.actionToPromise([DevicesGen.load, DevicesGen.revoked, DevicesGen.paperKeyCreated], load)
  // Revoke device
  yield Saga.actionToPromise(DevicesGen.revoke, revoke)

  // Navigation
  yield Saga.actionToAction(DevicesGen.showRevokePage, showRevokePage)
  yield Saga.actionToAction(DevicesGen.showDevicePage, showDevicePage)
  yield Saga.actionToAction(DevicesGen.showPaperKeyPage, showPaperKeyPage)
  yield Saga.actionToAction(DevicesGen.revoked, navigateAfterRevoked)

  // Loading data
  yield Saga.actionToPromise(DevicesGen.showRevokePage, requestEndangeredTLFsLoad)
  yield Saga.actionToAction(DevicesGen.showPaperKeyPage, requestPaperKey)
}

export default deviceSaga
