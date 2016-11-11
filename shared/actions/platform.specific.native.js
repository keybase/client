// @flow

// $FlowIssue tell flow about this module
import * as PushNotifications from 'react-native-push-notification'

export function requestPushPermissions (): Promise<*> {
  return PushNotifications.requestPermissions()
}
