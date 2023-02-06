import {isIOS} from '../constants/platform'
import PushNotificationIOS from '@react-native-community/push-notification-ios'

function NotifyPopup(title: string, opts: Object, _: number = -1, __?: string): void {
  console.log('NotifyPopup: ', title, opts)
  isIOS &&
    PushNotificationIOS.addNotificationRequest({
      body: title,
      id: Math.floor(Math.random() * Math.pow(2, 32)).toString(),
    })
}

export default NotifyPopup
