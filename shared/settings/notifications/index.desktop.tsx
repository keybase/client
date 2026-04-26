import {Reloadable} from '@/common-adapters'
import * as C from '@/constants'
import Render from './render'
import useNotifications from './hooks'
import useNotificationSettings from './use-notification-settings'
import {loadSettings} from '../load-settings'

const Notifications = () => {
  const notificationSettings = useNotificationSettings()
  const props = useNotifications(notificationSettings)
  const onReload = () => {
    loadSettings()
    notificationSettings.refresh()
  }
  return (
    <Reloadable
      waitingKeys={[C.refreshNotificationsWaitingKey, C.waitingKeySettingsLoadSettings]}
      onReload={onReload}
      reloadOnMount={true}
    >
      <Render {...props} />
    </Reloadable>
  )
}

export default Notifications
