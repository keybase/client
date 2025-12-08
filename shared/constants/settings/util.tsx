import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
    case EngineGen.keybase1NotifyUsersPasswordChanged:
    case EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged:
    case EngineGen.keybase1NotifyEmailAddressEmailsChanged:
      {
        const {useSettingsState} = require('.') as typeof Index
        useSettingsState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}

export const refreshNotificationsWaitingKey = 'settingsTabs.refreshNotifications'
export const addEmailWaitingKey = 'settings:addEmail'
export const importContactsWaitingKey = 'settings:importContacts'
