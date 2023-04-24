import * as Constants from '../constants/devices'
import * as DevicesGen from './devices-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Tabs from '../constants/tabs'
import * as Container from '../util/container'
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

const navigateAfterRevoked = (_: unknown, action: DevicesGen.RevokedPayload) =>
  action.payload.wasCurrentDevice
    ? RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]})
    : RouteTreeGen.createNavUpToScreen({
        name: Constants.devicesTabLocation[Constants.devicesTabLocation.length - 1],
      })

const showRevokePage = (_: unknown, action: DevicesGen.ShowRevokePagePayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [
      ...Constants.devicesTabLocation,
      'devicePage',
      {props: {deviceID: action.payload.deviceID}, selected: 'deviceRevoke'},
    ],
  })

const showDevicePage = (_: unknown, action: DevicesGen.ShowDevicePagePayload) =>
  RouteTreeGen.createNavigateAppend({
    path: [
      ...Constants.devicesTabLocation,
      {props: {deviceID: action.payload.deviceID}, selected: 'devicePage'},
    ],
  })

const clearNavBadges = async () => RPCTypes.deviceDismissDeviceChangeNotificationsRpcPromise().catch(logError)

const receivedBadgeState = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  DevicesGen.createBadgeAppForDevices({
    ids: [
      ...(action.payload.badgeState.newDevices || []),
      ...(action.payload.badgeState.revokedDevices || []),
    ],
  })

const initDevice = () => {
  // Load devices
  Container.listenAction([DevicesGen.load, DevicesGen.revoked], load)
  // Revoke device
  Container.listenAction(DevicesGen.revoke, revoke)

  // Navigation
  Container.listenAction(DevicesGen.showRevokePage, showRevokePage)
  Container.listenAction(DevicesGen.showDevicePage, showDevicePage)
  Container.listenAction(DevicesGen.revoked, navigateAfterRevoked)

  // Badges
  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  Container.listenAction([DevicesGen.load, DevicesGen.revoked], clearNavBadges)

  // Loading data
  Container.listenAction([DevicesGen.showRevokePage], requestEndangeredTLFsLoad)
}

export default initDevice
