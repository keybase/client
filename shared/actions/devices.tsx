import * as Constants from '../constants/devices'
import * as ConfigConstants from '../constants/config'

const initDevice = () => {
  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.badgeState === old.badgeState) return
    if (!s.badgeState) return
    const {setBadges} = Constants.useDevicesState.getState().dispatch
    const {newDevices, revokedDevices} = s.badgeState
    setBadges(new Set([...(newDevices ?? []), ...(revokedDevices ?? [])]))
  })
}

export default initDevice
