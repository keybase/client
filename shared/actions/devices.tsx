import * as Constants from '../constants/devices'
import * as Container from '../util/container'
import * as NotificationsGen from './notifications-gen'

const initDevice = () => {
  Container.listenAction(NotificationsGen.receivedBadgeState, (_, action) => {
    const {setBadges} = Constants.useDevicesState.getState().dispatch
    const {newDevices, revokedDevices} = action.payload.badgeState
    setBadges(new Set([...(newDevices ?? []), ...(revokedDevices ?? [])]))
  })
}

export default initDevice
