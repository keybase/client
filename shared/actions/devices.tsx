import * as Constants from '../constants/devices'
import * as DevicesGen from './devices-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as Tabs from '../constants/tabs'
import * as Container from '../util/container'
import HiddenString from '../util/hidden-string'
import {logError} from '../util/errors'

const load = async (state: Container.TypedState) => {
  if (!state.config.loggedIn) {
    return false
  }

  try {
    const results = await RPCTypes.deviceDeviceHistoryListRpcPromise(undefined, Constants.waitingKey)
    return DevicesGen.createLoaded({devices: (results || []).map(d => Constants.rpcDeviceToDevice(d))})
  } catch (_) {
    return false
  }
}

function* requestPaperKey(): Iterable<any> {
  yield* Saga.callRPCs(
    RPCTypes.loginPaperKeyRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.loginUi.promptRevokePaperKeys': (_, response) => {
          response.result(false)
        },
      },
      incomingCallMap: {
        'keybase.1.loginUi.displayPaperKeyPhrase': ({phrase}) =>
          Saga.put(DevicesGen.createPaperKeyCreated({paperKey: new HiddenString(phrase)})),
      },
      params: undefined,
      waitingKey: Constants.waitingKey,
    })
  )
}

const requestEndangeredTLFsLoad = async (
  state: Container.TypedState,
  action: DevicesGen.ShowRevokePagePayload
) => {
  const actingDevice = state.config.deviceID
  const targetDevice = action.payload.deviceID
  if (!actingDevice || !targetDevice) {
    return false
  }
  try {
    const tlfs = await RPCTypes.rekeyGetRevokeWarningRpcPromise(
      {actingDevice, targetDevice},
      Constants.waitingKey
    )
    return DevicesGen.createEndangeredTLFsLoaded({
      deviceID: targetDevice,
      tlfs: (tlfs.endangeredTLFs || []).map(t => t.name),
    })
  } catch (e) {
    console.error(e)
    return false
  }
}

const revoke = async (state: Container.TypedState, action: DevicesGen.RevokePayload) => {
  const {deviceID} = action.payload
  const device = Constants.getDevice(state, deviceID)
  if (!device) {
    throw new Error("Can't find device to remove")
  }
  if (!state.config.username) {
    throw new Error('Not logged in device remove')
  }

  const wasCurrentDevice = device.currentDevice
  const deviceName = device.name
  if (wasCurrentDevice) {
    await RPCTypes.loginDeprovisionRpcPromise(
      {doRevoke: true, username: state.config.username},
      Constants.waitingKey
    )
    return DevicesGen.createRevoked({deviceID, deviceName, wasCurrentDevice})
  } else {
    await RPCTypes.revokeRevokeDeviceRpcPromise(
      {deviceID, forceLast: false, forceSelf: false},
      Constants.waitingKey
    )
    return DevicesGen.createRevoked({deviceID, deviceName, wasCurrentDevice})
  }
}

const navigateAfterRevoked = (_: Container.TypedState, action: DevicesGen.RevokedPayload) =>
  action.payload.wasCurrentDevice
    ? RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]})
    : RouteTreeGen.createNavUpToScreen({
        routeName: Constants.devicesTabLocation[Constants.devicesTabLocation.length - 1],
      })

const showRevokePage = (_: Container.TypedState, action: DevicesGen.ShowRevokePagePayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [
      ...Constants.devicesTabLocation,
      'devicePage',
      {props: {deviceID: action.payload.deviceID}, selected: 'deviceRevoke'},
    ],
  })

const showDevicePage = (_: Container.TypedState, action: DevicesGen.ShowDevicePagePayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [
      ...Constants.devicesTabLocation,
      {props: {deviceID: action.payload.deviceID}, selected: 'devicePage'},
    ],
  })

const showPaperKeyPage = () =>
  RouteTreeGen.createNavigateAppend({path: [...Constants.devicesTabLocation, 'devicePaperKey']})

const clearNavBadges = () => RPCTypes.deviceDismissDeviceChangeNotificationsRpcPromise().catch(logError)

const receivedBadgeState = (_: Container.TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  DevicesGen.createBadgeAppForDevices({
    ids: [
      ...(action.payload.badgeState.newDevices || []),
      ...(action.payload.badgeState.revokedDevices || []),
    ],
  })

function* deviceSaga(): Saga.SagaGenerator<any, any> {
  // Load devices
  yield* Saga.chainAction2([DevicesGen.load, DevicesGen.revoked, DevicesGen.paperKeyCreated], load)
  // Revoke device
  yield* Saga.chainAction2(DevicesGen.revoke, revoke)

  // Navigation
  yield* Saga.chainAction2(DevicesGen.showRevokePage, showRevokePage)
  yield* Saga.chainAction2(DevicesGen.showDevicePage, showDevicePage)
  yield* Saga.chainAction2(DevicesGen.showPaperKeyPage, showPaperKeyPage)
  yield* Saga.chainAction2(DevicesGen.revoked, navigateAfterRevoked)

  // Badges
  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, receivedBadgeState)
  yield* Saga.chainAction2([DevicesGen.load, DevicesGen.revoked, DevicesGen.paperKeyCreated], clearNavBadges)

  // Loading data
  yield* Saga.chainAction2([DevicesGen.showRevokePage], requestEndangeredTLFsLoad)
  yield* Saga.chainGenerator<DevicesGen.ShowPaperKeyPagePayload>(DevicesGen.showPaperKeyPage, requestPaperKey)
}

export default deviceSaga
