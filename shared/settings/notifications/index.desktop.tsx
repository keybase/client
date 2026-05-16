import {Reloadable} from '@/common-adapters'
import * as C from '@/constants'
import Render from '@/settings/notifications/render'
import useNotifications from '@/settings/notifications/hooks'
import useNotificationSettings from '@/settings/notifications/use-notification-settings'
import {loadSettings} from '@/settings/load-settings'

const Notifications = () => {
  const notificationSettings = useNotificationSettings()
  const props = useNotifications(notificationSettings)
  const onReload = () => {
    loadSettings()
    notificationSettings.refresh()
  }
  return (
    <Reloadable
      onBack={undefined}
      waitingKeys={[C.refreshNotificationsWaitingKey, C.waitingKeySettingsLoadSettings]}
      onReload={onReload}
      reloadOnMount={true}
    >
      <Render {...props} />
    </Reloadable>
  )
}

export default Notifications
