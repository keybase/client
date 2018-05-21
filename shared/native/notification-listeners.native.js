// @flow
import sharedNotificationActions, {sharedBadgeState} from './notification-listeners.shared'
import RNPN from 'react-native-push-notification'
import * as RPCTypes from '../constants/types/rpc-gen'
import engine from '../engine'

// TODO: DESKTOP-6662 - Move notification listeners to their own actions
export default (): void => {
  sharedNotificationActions()

  engine().setIncomingActionCreators('keybase.1.NotifyBadges.badgeState', ({badgeState}, _, dispatch) => {
    sharedBadgeState(badgeState, dispatch)

    const count = (badgeState.conversations || []).reduce(
      (total, c) => (c.badgeCounts ? total + c.badgeCounts[`${RPCTypes.commonDeviceType.mobile}`] : total),
      0
    )

    RNPN.setApplicationIconBadgeNumber(count)
    if (count === 0) {
      RNPN.cancelAllLocalNotifications()
    }
  })
}
