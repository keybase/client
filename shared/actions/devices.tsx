import * as ConfigGen from './config-gen'
import * as Constants from '../constants/devices'
import * as Container from '../util/container'
// import * as DevicesGen from './devices-gen'
import * as NotificationsGen from './notifications-gen'
// import * as RPCTypes from '../constants/types/rpc-gen'
// import * as RouteTreeGen from './route-tree-gen'
// import * as Tabs from '../constants/tabs'
// import {logError} from '../util/errors'

// const requestEndangeredTLFsLoad = async (
//   state: Container.TypedState,
//   action: DevicesGen.ShowRevokePagePayload
// ) => {
//   const actingDevice = state.config.deviceID
//   const targetDevice = action.payload.deviceID
//   if (!actingDevice || !targetDevice) {
//     return false
//   }
//   try {
//     const tlfs = await RPCTypes.rekeyGetRevokeWarningRpcPromise(
//       {actingDevice, targetDevice},
//       Constants.waitingKey
//     )
//     return DevicesGen.createEndangeredTLFsLoaded({
//       deviceID: targetDevice,
//       tlfs: (tlfs.endangeredTLFs || []).map(t => t.name),
//     })
//   } catch (e) {
//     console.error(e)
//     return false
//   }
// }

// const navigateAfterRevoked = (_: unknown, action: DevicesGen.RevokedPayload) =>
//   action.payload.wasCurrentDevice
//     ? RouteTreeGen.createNavigateAppend({path: [Tabs.loginTab]})
//     : RouteTreeGen.createNavUpToScreen({
//         name: Constants.devicesTabLocation[Constants.devicesTabLocation.length - 1],
//       })

// const showRevokePage = (_: unknown, action: DevicesGen.ShowRevokePagePayload) =>
//   RouteTreeGen.createNavigateAppend({
//     path: [
//       ...Constants.devicesTabLocation,
//       {props: {deviceID: action.payload.deviceID}, selected: 'devicePage'},
//       {props: {deviceID: action.payload.deviceID}, selected: 'deviceRevoke'},
//     ],
//   })

// const showDevicePage = (_: unknown, action: DevicesGen.ShowDevicePagePayload) =>
//   RouteTreeGen.createNavigateAppend({
//     path: [
//       ...Constants.devicesTabLocation,
//       {props: {deviceID: action.payload.deviceID}, selected: 'devicePage'},
//     ],
//   })

// const clearNavBadges = async () => RPCTypes.deviceDismissDeviceChangeNotificationsRpcPromise().catch(logError)

const receivedBadgeState = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const {dispatchSetBadges} = Constants.useDevicesState.getState()
  const {newDevices, revokedDevices} = action.payload.badgeState
  dispatchSetBadges(new Set([...(newDevices ?? []), ...(revokedDevices ?? [])]))
}

const resetStore = () => {
  const {dispatchReset} = Constants.useDevicesState.getState()
  dispatchReset()
}

const initDevice = () => {
  Container.listenAction(ConfigGen.resetStore, resetStore)

  // Load devices
  // // TODO revoke
  //  Container.listenAction([DevicesGen.load, DevicesGen.revoked], load)
  // Revoke device
  //   Container.listenAction(DevicesGen.revoke, revoke)

  // Navigation
  // Container.listenAction(DevicesGen.showRevokePage, showRevokePage)
  // Container.listenAction(DevicesGen.showDevicePage, showDevicePage)
  // Container.listenAction(DevicesGen.revoked, navigateAfterRevoked)

  // Badges
  Container.listenAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  // Container.listenAction([DevicesGen.load, DevicesGen.revoked], clearNavBadges)

  // Loading data
  //Container.listenAction([DevicesGen.showRevokePage], requestEndangeredTLFsLoad)
}

export default initDevice
