// @flow
import * as Constants from '../constants/devices'
import * as DevicesGen from './devices-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteActions from './route-tree'
import * as Saga from '../util/saga'
import HiddenString from '../util/hidden-string'
import {loginTab} from '../constants/tabs'
import {type TypedState} from '../constants/reducer'

const requestEndangeredTLFsLoad = (action: DevicesGen.ShowRevokePagePayload) =>
  Saga.put(
    DevicesGen.createEndangeredTLFsLoad({
      deviceID: action.payload.deviceID,
    })
  )

const endangeredTLFsLoad = (state: TypedState, action: DevicesGen.ShowRevokePagePayload) =>
  state.config.deviceID
    ? RPCTypes.rekeyGetRevokeWarningRpcPromise(
        {actingDevice: state.config.deviceID, targetDevice: action.payload.deviceID},
        Constants.waitingKey
      )
        .then((tlfs: RPCTypes.RevokeWarning) =>
          DevicesGen.createEndangeredTLFsLoaded({
            deviceID: action.payload.deviceID,
            tlfs: (tlfs.endangeredTLFs || []).map(t => t.name),
          })
        )
        .catch(() => {})
    : null

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
        'keybase.1.loginUi.promptRevokePaperKeys': (_, response, __) => {
          response.result(false)
        },
      },
      params: undefined,
      waitingKey: Constants.waitingKey,
    })
  })

function rpcRevoke(action: DevicesGen.DeviceRevokePayload, state: TypedState) {
  const {deviceID} = action.payload
  const device = Constants.getDevice(state, deviceID)
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
      Saga.call(RPCTypes.loginDeprovisionRpcPromise, {doRevoke: true, username}, Constants.waitingKey),
    ])
  } else {
    return Saga.all([
      Saga.identity({deviceID, wasCurrentDevice: false}),
      Saga.call(
        RPCTypes.revokeRevokeDeviceRpcPromise,
        {
          deviceID,
          forceLast: false,
          forceSelf: false,
        },
        Constants.waitingKey
      ),
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

const navigateAfterRevoked = (state: TypedState, action: DevicesGen.DeviceRevokedPayload) =>
  action.payload.wasCurrentDevice
    ? Saga.put(RouteActions.navigateTo([loginTab]))
    : Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation]))

const showRevokePage = () =>
  Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation, 'devicePage', 'revokeDevice']))

const showDevicePage = () =>
  Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation, 'devicePage']))

const showPaperKeyPage = () =>
  Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation, 'genPaperKey']))

function* deviceSaga(): Saga.SagaGenerator<any, any> {
  // Load devices
  yield Saga.actionToPromise(DevicesGen.load, load)
  // Load endangered tlfs
  yield Saga.actionToPromise(DevicesGen.endangeredTLFsLoad, endangeredTLFsLoad)

  // Navigation
  yield Saga.actionToAction(DevicesGen.showRevokePage, showRevokePage)
  yield Saga.actionToAction(DevicesGen.showDevicePage, showDevicePage)
  yield Saga.actionToAction(DevicesGen.showPaperKeyPage, showPaperKeyPage)
  yield Saga.actionToAction(DevicesGen.deviceRevoked, navigateAfterRevoked)

  // Loading data
  yield Saga.safeTakeEveryPure(DevicesGen.showRevokePage, requestEndangeredTLFsLoad)
  yield Saga.actionToAction(DevicesGen.showPaperKeyPage, requestPaperKey)

  yield Saga.safeTakeEveryPure(DevicesGen.deviceRevoke, rpcRevoke, dispatchRevoked)
}

export default deviceSaga
