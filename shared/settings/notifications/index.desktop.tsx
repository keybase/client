import {Reloadable} from '@/common-adapters'
import * as C from '@/constants'
import Render from './render'
import {useSettingsNotifState} from '@/constants/settings-notifications'

const Notifications = () => {
  const loadSettings = C.useSettingsState(s => s.dispatch.loadSettings)
  const refresh = useSettingsNotifState(s => s.dispatch.refresh)
  const onRefresh = () => {
    loadSettings()
    refresh()
  }
  return (
    <Reloadable
      onBack={undefined}
      waitingKeys={[C.refreshNotificationsWaitingKey, C.waitingKeySettingsLoadSettings]}
      onReload={onRefresh}
      reloadOnMount={true}
    >
      <Render />
    </Reloadable>
  )
}

export default Notifications
