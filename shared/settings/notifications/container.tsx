import * as C from '@/constants'
import * as Constants from '@/constants/settings'
import Notifications, {type Props} from '.'
import {Reloadable} from '@/common-adapters'

const ReloadableNotifications = (props: Props) => {
  const loadSettings = C.useSettingsState(s => s.dispatch.loadSettings)
  const refresh = C.useSettingsNotifState(s => s.dispatch.refresh)

  const onRefresh = () => {
    loadSettings()
    refresh()
  }

  return (
    <Reloadable
      onBack={C.isMobile ? props.onBack : undefined}
      waitingKeys={[C.refreshNotificationsWaitingKey, Constants.loadSettingsWaitingKey]}
      onReload={onRefresh}
      reloadOnMount={true}
    >
      <Notifications {...props} />
    </Reloadable>
  )
}

const Container = () => {
  const _groups = C.useSettingsNotifState(s => s.groups)
  const allowEdit = C.useSettingsNotifState(s => s.allowEdit)
  const toggle = C.useSettingsNotifState(s => s.dispatch.toggle)
  const showEmailSection = C.useSettingsEmailState(s => s.emails.size > 0)
  const waitingForResponse = C.Waiting.useAnyWaiting(Constants.settingsWaitingKey)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClickYourAccount = () => {
    navigateAppend(C.Settings.settingsAccountTab)
  }
  const onToggle = toggle
  const onToggleUnsubscribeAll = toggle
  const props = {
    allowEdit,
    groups: _groups,
    onBack,
    onClickYourAccount,
    onToggle,
    onToggleUnsubscribeAll,
    showEmailSection: showEmailSection,
    waitingForResponse: waitingForResponse,
  }
  return <ReloadableNotifications {...props} />
}

export default Container
