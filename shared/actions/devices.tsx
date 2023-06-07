import * as ConfigGen from './config-gen'
import * as Constants from '../constants/devices'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'

const initDevice = () => {
  Container.listenAction(ConfigGen.resetStore, () => {
    const {dispatchReset} = Constants.useDevicesState.getState()
    dispatchReset()
  })
  Container.listenAction(NotificationsGen.receivedBadgeState, (_, action) => {
    const {dispatchSetBadges} = Constants.useDevicesState.getState()
    const {newDevices, revokedDevices} = action.payload.badgeState
    dispatchSetBadges(new Set([...(newDevices ?? []), ...(revokedDevices ?? [])]))
  })
}

export default initDevice
