import {isIOS} from '@/constants/platform'
import PushNotificationIOS from '@react-native-community/push-notification-ios'

function NotifyPopup(title: string): void {
  console.log('NotifyPopup: ', title)
  isIOS &&
    PushNotificationIOS.addNotificationRequest({
      body: title,
      id: Math.floor(Math.random() * 2 ** 32).toString(),
    })
}

export default NotifyPopup
