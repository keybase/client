// @flow
import sharedNotificationActions from './notification-listeners.shared'
import RNPN from 'react-native-push-notification'

// TODO: DESKTOP-6662 - Move notification listeners to their own actions
export default (): void => {
  sharedNotificationActions(count => {
    RNPN.setApplicationIconBadgeNumber(count)
    if (count === 0) {
      RNPN.cancelAllLocalNotifications()
    }
  })
}
