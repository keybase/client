import * as C from '@/constants'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSettingsNotifState} from '@/stores/settings-notifications'
import {useSettingsState, settingsAccountTab} from '@/stores/settings'

const useNotifications = () => {
  const _groups = useSettingsNotifState(s => s.groups)
  const allowEdit = useSettingsNotifState(s => s.allowEdit)
  const toggle = useSettingsNotifState(s => s.dispatch.toggle)
  const showEmailSection = useSettingsEmailState(s => s.emails.size > 0)
  const waitingForResponse = C.Waiting.useAnyWaiting(C.waitingKeySettingsGeneric)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onClickYourAccount = () => {
    navigateAppend(settingsAccountTab)
  }
  const onToggle = toggle
  const onToggleUnsubscribeAll = toggle
  const loadSettings = useSettingsState(s => s.dispatch.loadSettings)
  const refresh = useSettingsNotifState(s => s.dispatch.refresh)

  const onRefresh = () => {
    loadSettings()
    refresh()
  }

  return {
    allowEdit,
    groups: _groups,
    onBack,
    onClickYourAccount,
    onRefresh,
    onToggle,
    onToggleUnsubscribeAll,
    showEmailSection: showEmailSection,
    waitingForResponse: waitingForResponse,
  }
}

export default useNotifications
