import {Reloadable} from '@/common-adapters'
import * as C from '@/constants'
import Render from './render'
import {loadSettings} from '../load-settings'
import {useSettingsNotifState} from '@/stores/settings-notifications'

const Notifications = () => {
  const refresh = useSettingsNotifState(s => s.dispatch.refresh)
  const onReload = () => {
    loadSettings()
    refresh()
  }
  return (
    <Reloadable
      onBack={undefined}
      waitingKeys={[C.refreshNotificationsWaitingKey, C.waitingKeySettingsLoadSettings]}
      onReload={onReload}
      reloadOnMount={true}
    >
      <Render />
    </Reloadable>
  )
}

export default Notifications
