// @flow
import * as PushNotifications from 'react-native-push-notification'

export function requestPushPermissions (): Promise<*> {
  return PushNotifications.requestPermissions()
}
