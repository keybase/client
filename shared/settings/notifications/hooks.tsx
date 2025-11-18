import * as C from '@/constants'

const useNotifications = () => {
  const _groups = C.useSettingsNotifState(s => s.groups)
  const allowEdit = C.useSettingsNotifState(s => s.allowEdit)
  const toggle = C.useSettingsNotifState(s => s.dispatch.toggle)
  const showEmailSection = C.useSettingsEmailState(s => s.emails.size > 0)
  const waitingForResponse = C.Waiting.useAnyWaiting(C.Settings.settingsWaitingKey)
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
  const loadSettings = C.useSettingsState(s => s.dispatch.loadSettings)
  const refresh = C.useSettingsNotifState(s => s.dispatch.refresh)

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
