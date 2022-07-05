import * as PushNotifications from 'react-native-push-notification'

export function NotifyPopup(title: string, opts: Object, _: number = -1, __?: string): void {
  console.log('NotifyPopup: ', title, opts)
  PushNotifications.localNotification({
    message: title,
  })
}
