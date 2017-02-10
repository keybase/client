// @flow
import * as PushNotifications from 'react-native-push-notification'

function requestPushPermissions (): Promise<*> {
  return PushNotifications.requestPermissions()
}

function showMainWindow () {
  return () => {
    // nothing
  }
}

export {
  requestPushPermissions,
  showMainWindow,
}
