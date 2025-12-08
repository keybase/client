import {Reloadable} from '@/common-adapters'
import * as C from '@/constants'
import Render from './render'
import {refreshNotificationsWaitingKey} from '@/constants/settings/util'

const Notifications = () => {
  const loadSettings = C.useSettingsState(s => s.dispatch.loadSettings)
  const refresh = C.useSettingsNotifState(s => s.dispatch.refresh)
  const onRefresh = () => {
    loadSettings()
    refresh()
  }
  return (
    <Reloadable
      onBack={undefined}
      waitingKeys={[refreshNotificationsWaitingKey, C.Settings.loadSettingsWaitingKey]}
      onReload={onRefresh}
      reloadOnMount={true}
    >
      <Render />
    </Reloadable>
  )
}

export default Notifications
