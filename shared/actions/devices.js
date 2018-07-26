// @flow
import * as Constants from '../constants/devices'
import * as DevicesGen from './devices-gen'
import * as I from 'immutable'
import * as LoginGen from './login-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteActions from './route-tree'
import * as RouteTree from '../route-tree'
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

function* makePaperKey(): Saga.SagaGenerator<any, any> {
  let channelMap
  try {
    channelMap = RPCTypes.loginPaperKeyRpcChannelMap([
      'keybase.1.loginUi.promptRevokePaperKeys',
      'keybase.1.loginUi.displayPaperKeyPhrase',
    ])

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

const showRevokePage = (state: TypedState) =>
  Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation, 'devicePage', 'revokeDevice']))

const showDevicePage = (state: TypedState) =>
  Saga.put(RouteActions.navigateTo([...Constants.devicesTabLocation, 'devicePage']))

function* deviceSaga(): Saga.SagaGenerator<any, any> {
  // Load devices
  yield Saga.actionToPromise(DevicesGen.load, load)
  // Load endangered tlfs
  yield Saga.actionToPromise(DevicesGen.endangeredTLFsLoad, endangeredTLFsLoad)

  // Navigation
  yield Saga.actionToAction(DevicesGen.showRevokePage, showRevokePage)
  yield Saga.actionToAction(DevicesGen.showDevicePage, showDevicePage)

  yield Saga.safeTakeEveryPure(DevicesGen.paperKeyCreated, showPaperKeyCreatedPage)
  yield Saga.safeTakeEveryPure(DevicesGen.deviceRevoked, navigateAfterRevoked)

  // Loading data
  yield Saga.safeTakeEveryPure(DevicesGen.showRevokePage, requestEndangeredTLFsLoad)

  // Making Paperkey flow
  yield Saga.safeTakeEvery(DevicesGen.paperKeyMake, makePaperKey)

  yield Saga.safeTakeEveryPure(DevicesGen.deviceRevoke, rpcRevoke, dispatchRevoked)
}

export default deviceSaga
