import {addNotificationRequest} from 'react-native-kb'

function NotifyPopup(title: string): void {
  console.log('NotifyPopup: ', title)
  addNotificationRequest({
    body: title,
    id: Math.floor(Math.random() * 2 ** 32).toString(),
  }).catch(() => {})
}

export default NotifyPopup
