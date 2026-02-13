import {Reloadable} from '@/common-adapters'
import * as C from '@/constants'
import Render from './render'
import {useSettingsNotifState} from '@/stores/settings-notifications'
import {useSettingsState} from '@/stores/settings'

const Notifications = () => {
  const loadSettings = useSettingsState(s => s.dispatch.loadSettings)
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
