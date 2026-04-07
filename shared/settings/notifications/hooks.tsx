import * as C from '@/constants'
import {settingsAccountTab} from '@/constants/settings'
import {useSettingsEmailState} from '@/stores/settings-email'
import type {UseNotificationSettingsResult} from './use-notification-settings'

const useNotifications = (notificationSettings: UseNotificationSettingsResult) => {
  const {allowEdit, groups, toggle} = notificationSettings
  const showEmailSection = useSettingsEmailState(s => s.emails.size > 0)
  const navigateAppend = C.Router2.navigateAppend
  const onClickYourAccount = () => {
    navigateAppend(settingsAccountTab)
  }

  return {
    allowEdit,
    groups,
    onClickYourAccount,
    onToggle: toggle,
    onToggleUnsubscribeAll: toggle,
    showEmailSection,
  }
}

export default useNotifications
