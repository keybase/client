// @flow
import * as Constants from '../constants/devices'
import * as DevicesGen from './devices-gen'
import * as NotificationsGen from './notifications-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as Tabs from '../constants/tabs'
import HiddenString from '../util/hidden-string'
import {logError, type RPCError} from '../util/errors'

const load = state =>
  state.config.loggedIn
    ? RPCTypes.deviceDeviceHistoryListRpcPromise(undefined, Constants.waitingKey)
        .then(results => {
          const devices = (results || []).map(d => Constants.rpcDeviceToDevice(d))
          return DevicesGen.createLoaded({devices})
        })
        .catch(() => {})
    : false

function* requestPaperKey(): Generator<any, void, any> {
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

const requestEndangeredTLFsLoad = state => {
  const actingDevice = state.config.deviceID
  const targetDevice = state.devices.selectedDeviceID
  if (actingDevice && targetDevice) {
    return RPCTypes.rekeyGetRevokeWarningRpcPromise({actingDevice, targetDevice}, Constants.waitingKey)
      .then((tlfs: RPCTypes.RevokeWarning) =>
        DevicesGen.createEndangeredTLFsLoaded({
          deviceID: targetDevice,
          tlfs: (tlfs.endangeredTLFs || []).map(t => t.name),
        })
      )
      .catch((e: RPCError) => {
        console.error(e)
      })
  }
}

const revoke = (state, action) => {
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
    ).then(() => DevicesGen.createRevoked({deviceID, deviceName, wasCurrentDevice}))
  }
}

const navigateAfterRevoked = (state, action) =>
  RouteTreeGen.createNavigateTo({
    path: action.payload.wasCurrentDevice ? [Tabs.loginTab] : [...Constants.devicesTabLocation],
  })

const showRevokePage = () =>
  RouteTreeGen.createNavigateTo({path: [...Constants.devicesTabLocation, 'devicePage', 'revokeDevice']})

const showDevicePage = () =>
  RouteTreeGen.createNavigateTo({path: [...Constants.devicesTabLocation, 'devicePage']})

const showPaperKeyPage = () =>
  RouteTreeGen.createNavigateTo({path: [...Constants.devicesTabLocation, 'paperKey']})

let _wasOnDeviceTab = false
const clearBadgesAfterNav = (state, action) => {
  if (Constants.isLookingAtDevices(state, action)) {
    _wasOnDeviceTab = true
  } else if (_wasOnDeviceTab) {
    _wasOnDeviceTab = false
    // clear badges
    return RPCTypes.deviceDismissDeviceChangeNotificationsRpcPromise().catch(logError)
  }
}

const receivedBadgeState = (state, action) =>
  DevicesGen.createBadgeAppForDevices({
    ids: (action.payload.badgeState.newDevices || []).concat(action.payload.badgeState.revokedDevices || []),
  })

function* deviceSaga(): Saga.SagaGenerator<any, any> {
  // Load devices
  yield* Saga.chainAction<
    DevicesGen.LoadPayload | DevicesGen.RevokedPayload | DevicesGen.PaperKeyCreatedPayload
  >([DevicesGen.load, DevicesGen.revoked, DevicesGen.paperKeyCreated], load)
  // Revoke device
  yield* Saga.chainAction<DevicesGen.RevokePayload>(DevicesGen.revoke, revoke)

  // Navigation
  yield* Saga.chainAction<DevicesGen.ShowRevokePagePayload>(DevicesGen.showRevokePage, showRevokePage)
  yield* Saga.chainAction<DevicesGen.ShowDevicePagePayload>(DevicesGen.showDevicePage, showDevicePage)
  yield* Saga.chainAction<DevicesGen.ShowPaperKeyPagePayload>(DevicesGen.showPaperKeyPage, showPaperKeyPage)
  yield* Saga.chainAction<DevicesGen.RevokedPayload>(DevicesGen.revoked, navigateAfterRevoked)

  // Badges
  yield* Saga.chainAction<NotificationsGen.ReceivedBadgeStatePayload>(
    NotificationsGen.receivedBadgeState,
    receivedBadgeState
  )
  yield* Saga.chainAction<RouteTreeGen.SwitchToPayload>(RouteTreeGen.switchTo, clearBadgesAfterNav)

  // Loading data
  yield* Saga.chainAction<DevicesGen.ShowRevokePagePayload>(
    DevicesGen.showRevokePage,
    requestEndangeredTLFsLoad
  )
  yield* Saga.chainGenerator<DevicesGen.ShowPaperKeyPagePayload>(DevicesGen.showPaperKeyPage, requestPaperKey)
}

export default deviceSaga
